import { SiteAnalyzeRequest } from './types';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Best-effort per-isolate rate limit. The Cloudflare isolate is ephemeral, so
// this Map is lost on eviction (a fresh isolate starts with a full token
// bucket). Persisting to KV would cost a write per request and blow the
// free-tier daily quota, so we accept best-effort here and rely on the
// backend's start_or_get_job dedup for correctness (it collapses duplicate
// jobs for the same hostname).
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
        const { siteUrl, policyUrls, policyTexts, forceRefresh } = body;

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
        }

        // Proxy to the backend, which owns the (non-blocking) job. The backend
        // returns 200 for fast/cache-reused jobs, or 202 to signal "poll".
        const backendUrl = env.BACKEND_API_URL || 'http://127.0.0.1:8001';
        const backendRes = await fetch(`${backendUrl}/api/site/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, policy_urls: policyUrls ?? {}, policy_texts: policyTexts ?? {}, force_refresh: forceRefresh ?? false }),
        });

        const backendText = await backendRes.text();
        if (backendRes.status === 200) {
          // Completed analysis -> cache for 30d.
          ctx.waitUntil(
            env.CLARIFYLAW_CACHE.put(cacheKey, backendText, {
              expirationTtl: 30 * 24 * 60 * 60,
            })
          );
        }
        return new Response(backendText, {
          status: backendRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
      const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

      if (!forceRefresh) {
        const cachedStr = await env.CLARIFYLAW_CACHE.get(cacheKey);
        if (cachedStr) {
          return new Response(cachedStr, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Poll the backend job status.
      const backendUrl = env.BACKEND_API_URL || 'http://127.0.0.1:8001';
      const backendRes = await fetch(
        `${backendUrl}/api/site/status?hostname=${encodeURIComponent(hostname)}`
      );
      const backendText = await backendRes.text();
      if (backendRes.status === 200) {
        ctx.waitUntil(
          env.CLARIFYLAW_CACHE.put(cacheKey, backendText, {
            expirationTtl: 30 * 24 * 60 * 60,
          })
        );
      }
      return new Response(backendText, {
        status: backendRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
