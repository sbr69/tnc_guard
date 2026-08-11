import { AnalyzeRequest, ExtensionSiteReport, SiteAnalyzeRequest } from './types';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const inFlight = new Map<string, Promise<ExtensionSiteReport>>();
const siteInFlight = new Map<string, Promise<ExtensionSiteReport>>();

const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_REFILL_RATE = 3;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { tokens: RATE_LIMIT_MAX, lastRefill: now };

  const elapsed = (now - entry.lastRefill) / 1000;
  entry.tokens = Math.min(RATE_LIMIT_MAX, entry.tokens + elapsed / RATE_LIMIT_REFILL_RATE);
  entry.lastRefill = now;

  if (entry.tokens < 1) return false;
  entry.tokens -= 1;
  rateLimitMap.set(ip, entry);
  return true;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/api/analyze' && request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!checkRateLimit(ip)) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const body: AnalyzeRequest = await request.json();
        const { domain, policyUrls, forceRefresh } = body;

        if (!domain) {
          return new Response('Missing domain', { status: 400, headers: corsHeaders });
        }

        const cacheKey = `report:${domain}`;

        if (!forceRefresh) {
          const cachedStr = await env.CLARIFYLAW_CACHE.get(cacheKey);
          if (cachedStr) {
            return new Response(cachedStr, {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        if (!forceRefresh && inFlight.has(domain)) {
          const result = await inFlight.get(domain)!;
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const analysisPromise = Promise.race([
          runAnalysis(domain, policyUrls, env),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Analysis timeout')), 300_000)
          )
        ]);
        inFlight.set(domain, analysisPromise);

        try {
          const result = await analysisPromise;
          ctx.waitUntil(
            env.CLARIFYLAW_CACHE.put(cacheKey, JSON.stringify(result), {
              expirationTtl: 30 * 24 * 60 * 60,
            })
          );
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } finally {
          inFlight.delete(domain);
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    if (url.pathname === '/api/analyze' && request.method === 'GET') {
      const domain = url.searchParams.get('domain');
      if (!domain) {
        return new Response('Missing domain', { status: 400, headers: corsHeaders });
      }
      const cacheKey = `report:${domain}`;
      const cachedStr = await env.CLARIFYLAW_CACHE.get(cacheKey);
      if (cachedStr) {
        return new Response(cachedStr, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Report not found', cacheMiss: true }), { status: 404, headers: corsHeaders });
    }

    if (url.pathname === '/api/site/analyze' && request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!checkRateLimit(ip)) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const body: SiteAnalyzeRequest = await request.json();
        const { siteUrl, policyUrls, forceRefresh } = body;

        if (!siteUrl) {
          return new Response(JSON.stringify({ error: 'Missing siteUrl' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let hostname = '';
        try {
          hostname = new URL(siteUrl).hostname;
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid siteUrl' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const cacheKey = `site:${hostname}`;

        if (!forceRefresh) {
          const cachedStr = await env.CLARIFYLAW_CACHE.get(cacheKey);
          if (cachedStr) {
            return new Response(cachedStr, {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          if (siteInFlight.has(hostname)) {
            const result = await siteInFlight.get(hostname)!;
            return new Response(JSON.stringify(result), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        const analysisPromise = Promise.race([
          runSiteAnalysis(siteUrl, policyUrls, env),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Analysis timeout')), 300_000)
          )
        ]);
        siteInFlight.set(hostname, analysisPromise);

        try {
          const result = await analysisPromise;
          ctx.waitUntil(
            env.CLARIFYLAW_CACHE.put(cacheKey, JSON.stringify(result), {
              expirationTtl: 30 * 24 * 60 * 60,
            })
          );
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } finally {
          siteInFlight.delete(hostname);
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/api/site/analyze' && request.method === 'GET') {
      const hostname = url.searchParams.get('hostname') || url.searchParams.get('domain');
      if (!hostname) {
        return new Response('Missing hostname', { status: 400, headers: corsHeaders });
      }
      const cacheKey = `site:${hostname}`;
      const cachedStr = await env.CLARIFYLAW_CACHE.get(cacheKey);
      if (cachedStr) {
        return new Response(cachedStr, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Report not found', cacheMiss: true }), { status: 404, headers: corsHeaders });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

async function runAnalysis(domain: string, policyUrls: AnalyzeRequest['policyUrls'], env: Env): Promise<ExtensionSiteReport> {
  const backendUrl = env.BACKEND_API_URL || 'http://127.0.0.1:8001'; 
  
  const res = await fetch(`${backendUrl}/api/extension/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, policy_urls: policyUrls }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error: ${res.status} - ${text}`);
  }

  return await res.json();
}

async function runSiteAnalysis(siteUrl: string, policyUrls: SiteAnalyzeRequest['policyUrls'], env: Env): Promise<ExtensionSiteReport> {
  const backendUrl = env.BACKEND_API_URL || 'http://127.0.0.1:8001';

  const res = await fetch(`${backendUrl}/api/site/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteUrl, policy_urls: policyUrls ?? {} }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error: ${res.status} - ${text}`);
  }

  return await res.json();
}
