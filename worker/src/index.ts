import { AnalyzeRequest, ExtensionSiteReport } from './types';

export interface Env {
  CLARIFYLAW_CACHE: KVNamespace;
  BACKEND_API_URL: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const inFlight = new Map<string, Promise<ExtensionSiteReport>>();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/api/analyze' && request.method === 'POST') {
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

        const analysisPromise = runAnalysis(domain, policyUrls, env);
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
      return new Response(JSON.stringify({ error: 'Report not found' }), { status: 404, headers: corsHeaders });
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
