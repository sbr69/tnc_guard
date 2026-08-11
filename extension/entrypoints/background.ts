import { defineBackground } from 'wxt/utils/define-background';
import type { ExtensionPopupData, PolicyType, ExtensionSiteReport } from '../lib/types';

export default defineBackground(() => {
  console.log('ClarifyLaw Background Worker loaded.');

  // Context Menu Setup
  browser.contextMenus.create({
    id: 'clarifylaw-analyze-link',
    title: 'Analyze this policy with ClarifyLaw',
    contexts: ['link'],
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'clarifylaw-analyze-link' && info.linkUrl) {
      if (!tab?.url) return;
      const domain = new URL(tab.url).hostname;
      
      // Attempt to guess policy type from URL, fallback to 'tos'
      let type: PolicyType = 'tos';
      const linkUrl = info.linkUrl.toLowerCase();
      if (linkUrl.includes('privacy')) type = 'privacy';
      else if (linkUrl.includes('cookie')) type = 'cookie';
      else if (linkUrl.includes('eula')) type = 'eula';
      
      const payload = {
        domain: domain,
        pageUrl: tab.url,
        policies: {
          privacy: type === 'privacy' ? info.linkUrl : null,
          tos: type === 'tos' ? info.linkUrl : null,
          cookie: type === 'cookie' ? info.linkUrl : null,
          eula: type === 'eula' ? info.linkUrl : null,
        }
      };
      
      // Fetch existing discovered policies and merge
      const existing = await getDiscoveredPolicies(domain);
      const merged = { ...existing };
      
      if (type === 'privacy') merged.privacy = info.linkUrl;
      else if (type === 'tos') merged.tos = info.linkUrl;
      else if (type === 'cookie') merged.cookie = info.linkUrl;
      else if (type === 'eula') merged.eula = info.linkUrl;
      
      // Store merged discovered policies
      await browser.storage.local.set(Object.fromEntries([[`discovered_${domain}`, merged]]));
      
      // Force popup open (not always possible from background without user interaction, but we can set state)
      // We will trigger analysis immediately
      triggerAnalysis(tab.url, domain, merged, true);
    }
  });

  // Handle messages
  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'POLICIES_DETECTED') {
      const { domain, policies } = message.payload as { domain: string; policies: Record<PolicyType, string | null> };
      // Merge with any existing discovered policies for this domain
      const key = `discovered_${domain}`;
      const existing = await browser.storage.local.get(key);
      const merged: Record<PolicyType, string | null> = (existing[key] as Record<PolicyType, string | null>) || {
        privacy: null, tos: null, cookie: null, eula: null
      };
      
      let changed = false;
      for (const k of Object.keys(policies)) {
        const pt = k as PolicyType;
        if (policies[pt] && !merged[pt]) {
          merged[pt] = policies[pt];
          changed = true;
        }
      }
      
      if (changed) {
        await browser.storage.local.set(Object.fromEntries([[key, merged]]));
      }
    }
    
    if (message.type === 'GET_CURRENT_REPORT') {
      const domain = message.payload.domain;
      const siteUrl = message.payload.pageUrl || (domain ? `https://${domain}/` : undefined);
      const forceRefresh = message.payload.forceRefresh || false;
      if (!siteUrl) {
        browser.runtime.sendMessage({ type: 'REPORT_ERROR', payload: { domain, error: 'No page URL to analyze.' } }).catch(() => {});
        return true;
      }
      triggerAnalysis(siteUrl, domain, await getDiscoveredPolicies(domain), forceRefresh).then((data) => {
        if (data.status !== 'error') {
          browser.runtime.sendMessage({ type: 'REPORT_READY', payload: data }).catch(() => {});
        }
      }).catch(err => {
        browser.runtime.sendMessage({ type: 'REPORT_ERROR', payload: { domain, error: err.message } }).catch(() => {});
      });
      return true;
    }

    if (message.type === 'OPEN_FULL_REPORT') {
      const domain = message.payload.domain;
      // TODO: Replace with production web app URL when deployed (dev runs on localhost:5173).
      const url = `http://localhost:5173/reports?domain=${encodeURIComponent(domain)}&source=extension`;
      browser.tabs.create({ url });
    }
  });
  
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

  async function triggerAnalysis(siteUrl: string, domain: string, policyUrls: Record<PolicyType, string | null>, forceRefresh = false): Promise<ExtensionPopupData> {
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
    browser.runtime.sendMessage({ type: 'REPORT_LOADING', payload: { domain, stage: 'Discovering & analyzing policies via Cloudflare...' } }).catch(() => {});
    
    // 2. Call Cloudflare Worker (Tier 2) -> backend /api/site/analyze
    //    The backend merges client-discovered policyUrls with server-side
    //    discovery (homepage scrape + path guessing) for any missing types.
    // TODO: Update URL when deployed. Using localhost for dev.
    const WORKER_URL = 'http://127.0.0.1:8787/api/site/analyze'; 
    
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, policyUrls, forceRefresh })
      });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const detail = errJson?.error || (await res.text().catch(() => ''));
        throw new Error(detail ? `Analysis Error: ${detail}` : `Worker returned ${res.status}`);
      }
      
      const report: ExtensionSiteReport = await res.json();
      
      // Backend returns only the policies it actually found. If none were found
      // anywhere, surface a clean "no policies" state (no per-type errors).
      const foundPolicyEntries = Object.entries(report.policies || {});
      if (foundPolicyEntries.length === 0) {
        await updateBadge(null, 'no-policies');
        browser.runtime.sendMessage({ type: 'NO_POLICIES', payload: { domain } }).catch(() => {});
        return {
          domain,
          siteName: domain,
          overallScore: 0,
          scanDate: new Date().toLocaleDateString(),
          status: 'error',
          riskFlags: [],
          policiesFound: []
        };
      }
      
      const policiesFound = foundPolicyEntries.map(([type, policy]) => ({
        type: type as PolicyType,
        found: true,
        score: policy?.score ?? null,
        documentId: policy?.documentId ?? null
      }));
      
      const popupData: ExtensionPopupData = {
        domain: report.domain || domain,
        siteName: report.siteName || domain,
        overallScore: report.overallScore,
        scanDate: report.scanDate,
        status: report.status,
        riskFlags: report.topRiskFlags,
        policiesFound,
      };
      
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
