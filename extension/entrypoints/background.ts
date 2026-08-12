import { defineBackground } from 'wxt/utils/define-background';
import type { ExtensionPopupData, PolicyType, ExtensionSiteReport } from '../lib/types';
import { classifyByUrl } from '../lib/policyPatterns';

// Build-time config with dev fallbacks (#22): avoid hardcoding localhost in
// shipped bundles.
const WORKER_URL =
  ((import.meta.env.VITE_WORKER_URL as string | undefined) ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const WEB_APP_URL =
  ((import.meta.env.VITE_APP_URL as string | undefined) ?? 'http://localhost:5173').replace(/\/$/, '');

// Per-domain write lock so the POLICIES_DETECTED read-modify-write on
// storage.local is serialized within the service worker (#10). In-memory is
// sufficient: an MV3 SW restart also kills in-flight messages, so there is no
// cross-restart race to guard.
const domainLocks = new Map<string, Promise<void>>();
async function withDomainLock<T>(domain: string, fn: () => Promise<T>): Promise<T> {
  const prev = domainLocks.get(domain) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => { release = r; });
  domainLocks.set(domain, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (domainLocks.get(domain) === next) domainLocks.delete(domain);
  }
}

export default defineBackground(() => {
  console.log('Unmask-Terms Background Worker loaded.');

  // Context menu created once on install (idempotent against SW restarts) (#12).
  browser.runtime.onInstalled.addListener(() => {
    try {
      browser.contextMenus.create({
        id: 'unmask-terms-analyze-link',
        title: 'Analyse this policy with Unmask-Terms',
        contexts: ['link'],
      });
    } catch {
      // Already exists (update) -- safe to ignore.
    }
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== 'unmask-terms-analyze-link' || !info.linkUrl) return;
    if (!tab?.url) return;
    const domain = new URL(tab.url).hostname;

    // Classify by URL pattern instead of a fragile includes() check (#4).
    // Falls back to 'tos' when the URL matches no known policy pattern.
    const type: PolicyType = classifyByUrl(info.linkUrl) ?? 'tos';

    const merged = { ...(await getDiscoveredPolicies(domain)) };
    merged[type] = info.linkUrl;
    await browser.storage.local.set(Object.fromEntries([[`discovered_${domain}`, merged]]));

    triggerAnalysis(tab.url, domain, merged, {}, true)
      .then((data) => {
        if (data.status !== 'error') {
          browser.runtime.sendMessage({ type: 'REPORT_READY', payload: data }).catch(() => { });
        }
      })
      .catch((err) => {
        browser.runtime.sendMessage({ type: 'REPORT_ERROR', payload: { domain, error: err.message } }).catch(() => { });
      });
  });

  // Unified message listener. Deliberately non-async and returns false for
  // every branch: the popup drives state via out-of-band REPORT_* messages
  // rather than the sendMessage response, so we never need to keep the channel
  // open -- this avoids the async / return-true channel footgun (#9).
  browser.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.type === 'POLICIES_DETECTED') {
      const { domain, policies } = message.payload as {
        domain: string; policies: Record<PolicyType, string | null>;
      };
      handlePoliciesDetected(domain, policies).catch(() => { });
      return false;
    }

    if (message.type === 'GET_CURRENT_REPORT') {
      const { domain, pageUrl, policyUrls, policyTexts, forceRefresh } = message.payload as {
        domain: string;
        pageUrl: string;
        policyUrls: Record<PolicyType, string | null>;
        policyTexts?: Partial<Record<PolicyType, string>>;
        forceRefresh?: boolean;
      };
      const siteUrl = pageUrl || (domain ? `https://${domain}/` : undefined);
      if (!siteUrl) {
        browser.runtime.sendMessage({ type: 'REPORT_ERROR', payload: { domain, error: 'No page URL to analyse.' } }).catch(() => { });
        return false;
      }
      triggerAnalysis(siteUrl, domain, policyUrls, policyTexts ?? {}, forceRefresh ?? false)
        .then((data) => {
          if (data.status !== 'error') {
            browser.runtime.sendMessage({ type: 'REPORT_READY', payload: data }).catch(() => { });
          }
        })
        .catch((err) => {
          browser.runtime.sendMessage({ type: 'REPORT_ERROR', payload: { domain, error: err.message } }).catch(() => { });
        });
      return false;
    }

    if (message.type === 'OPEN_FULL_REPORT') {
      const { domain } = message.payload as { domain: string };
      browser.tabs.create({ url: `${WEB_APP_URL}/reports?domain=${encodeURIComponent(domain)}&source=extension` });
    }
    return false;
  });

  async function handlePoliciesDetected(domain: string, policies: Record<PolicyType, string | null>) {
    const key = `discovered_${domain}`;
    // Serialize per-domain so concurrent messages don't clobber (#10).
    await withDomainLock(domain, async () => {
      const existing = await getDiscoveredPolicies(domain);
      const merged: Record<PolicyType, string | null> = { ...existing };
      let changed = false;
      // Explicit per-key comparisons using fixed string literals — avoids any
      // variable-key bracket notation (e.g. obj[k]) which static scanners flag
      // as a prototype-pollution risk regardless of runtime allowlist guards.
      if (policies.privacy && !merged.privacy) { merged.privacy = policies.privacy; changed = true; }
      if (policies.tos && !merged.tos) { merged.tos = policies.tos; changed = true; }
      if (policies.cookie && !merged.cookie) { merged.cookie = policies.cookie; changed = true; }
      if (policies.eula && !merged.eula) { merged.eula = policies.eula; changed = true; }
      if (changed) {
        await browser.storage.local.set(Object.fromEntries([[key, merged]]));
      }
    });
  }

  async function getDiscoveredPolicies(domain: string): Promise<Record<PolicyType, string | null>> {
    const key = `discovered_${domain}`;
    const result = await browser.storage.local.get(key);
    return (result[key] as Record<PolicyType, string | null>) || { privacy: null, tos: null, cookie: null, eula: null };
  }

  async function updateBadge(score: number | null, status: 'done' | 'processing' | 'error' | 'no-policies') {
    if (status === 'processing') {
      await browser.action.setBadgeBackgroundColor({ color: '#9CA3AF' }); // Gray
      await browser.action.setBadgeText({ text: '...' });
    } else if (status === 'error' || status === 'no-policies' || score === null) {
      await browser.action.setBadgeText({ text: '' });
    } else {
      let color = '#B91C1C'; // Red
      if (score >= 7.5) color = '#15803D'; // Green
      else if (score >= 5.0) color = '#A16207'; // Yellow

      await browser.action.setBadgeBackgroundColor({ color });
      await browser.action.setBadgeText({ text: score.toFixed(1) });
    }
  }

  async function triggerAnalysis(
    siteUrl: string,
    domain: string,
    policyUrls: Record<PolicyType, string | null>,
    policyTexts: Partial<Record<PolicyType, string>>,
    forceRefresh = false
  ): Promise<ExtensionPopupData> {
    const cacheKey = `report:${domain}`;

    // 1. Check local cache (Tier 1)
    if (!forceRefresh) {
      const cached = await browser.storage.local.get(cacheKey);
      if (cached[cacheKey]) {
        const data = cached[cacheKey] as ExtensionPopupData;
        await updateBadge(data.overallScore, data.status);
        return data;
      }
    }

    await updateBadge(null, 'processing');
    browser.runtime.sendMessage({ type: 'REPORT_LOADING', payload: { domain, stage: 'Discovering & analysing policies...' } }).catch(() => { });

    // Worker (Tier 2) -> backend /api/site/analyze (non-blocking job).
    const post = () => fetch(`${WORKER_URL}/api/site/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteUrl, policyUrls, policyTexts, forceRefresh }),
    });

    const buildPopupData = (report: ExtensionSiteReport): ExtensionPopupData => {
      const foundPolicyEntries = Object.entries(report.policies || {});
      const policiesFound = foundPolicyEntries.map(([type, policy]) => ({
        type: type as PolicyType,
        found: true,
        score: policy?.score ?? null,
        documentId: policy?.documentId ?? null,
      }));
      return {
        domain: report.domain || domain,
        siteName: report.siteName || domain,
        overallScore: report.overallScore,
        scanDate: report.scanDate,
        status: report.status,
        riskFlags: report.topRiskFlags,
        policiesFound,
      };
    };

    try {
      let report: ExtensionSiteReport | null = null;

      const res = await post();
      if (res.status === 200) {
        report = await res.json();
      } else if (res.status === 202) {
        const hostname = new URL(siteUrl).hostname;
        const deadline = Date.now() + 5 * 60 * 1000;
        let restarted = false;
        const pollUrl = `${WORKER_URL}/api/site/analyze?hostname=${encodeURIComponent(hostname)}${forceRefresh ? '&forceRefresh=true' : ''}`;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 4000));
          browser.runtime.sendMessage({ type: 'REPORT_LOADING', payload: { domain, stage: 'Analysing policies (RAG pipeline)...' } }).catch(() => { });
          const g = await fetch(pollUrl);
          if (g.status === 200) {
            report = await g.json();
            break;
          }
          if (g.status === 404) {
            if (restarted) throw new Error('Analysis job was lost. Try again.');
            restarted = true;
            const r2 = await post();
            if (r2.status === 200) { report = await r2.json(); break; }
            if (r2.status !== 202) {
              const e = await r2.json().catch(() => null);
              throw new Error(e?.error || `Worker returned ${r2.status}`);
            }
            continue;
          }
          if (g.status >= 500) {
            const e = await g.json().catch(() => null);
            throw new Error(e?.error || e?.detail || `Analysis failed (${g.status})`);
          }
        }
        // Soft failure (#13): distinguish "still running" from a hard error so
        // the user can retry rather than seeing a generic timeout.
        if (!report) throw new Error('Analysis is taking longer than usual on the free tier. Try again or check back shortly.');
      } else {
        const errJson = await res.json().catch(() => null);
        const detail = errJson?.error || errJson?.detail || (await res.text().catch(() => ''));
        throw new Error(detail ? `Analysis Error: ${detail}` : `Worker returned ${res.status}`);
      }

      const foundPolicyEntries = Object.entries(report!.policies || {});
      if (foundPolicyEntries.length === 0) {
        await updateBadge(null, 'no-policies');
        browser.runtime.sendMessage({ type: 'NO_POLICIES', payload: { domain } }).catch(() => { });
        return {
          domain,
          siteName: domain,
          overallScore: 0,
          scanDate: new Date().toLocaleDateString(),
          status: 'error',
          riskFlags: [],
          policiesFound: [],
        };
      }

      const popupData = buildPopupData(report!);

      // Store in Tier 1 cache
      await browser.storage.local.set(Object.fromEntries([[cacheKey, popupData]]));
      await updateBadge(popupData.overallScore, popupData.status);

      return popupData;
    } catch (err) {
      console.error('Analysis failed:', err);
      await updateBadge(null, 'error');
      throw err;
    }
  }
});
