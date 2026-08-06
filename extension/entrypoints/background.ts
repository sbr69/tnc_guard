import { defineBackground } from 'wxt/utils/define-background';
import { ExtensionPopupData, PolicyType, ExtensionSiteReport } from '../lib/types';

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
      
      // Store manually discovered policy
      await browser.storage.local.set(Object.fromEntries([[`discovered_${domain}`, payload.policies]]));
      
      // Force popup open (not always possible from background without user interaction, but we can set state)
      // We will trigger analysis immediately
      triggerAnalysis(payload.domain, payload.policies);
    }
  });

  // Handle messages
  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'POLICIES_DETECTED') {
      const { domain, policies } = message.payload;
      // Merge with any existing discovered policies for this domain
      const key = `discovered_${domain}`;
      const existing = await browser.storage.local.get(key);
      const merged = existing[key] || {
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
      const forceRefresh = message.payload.forceRefresh || false;
      
      triggerAnalysis(domain, await getDiscoveredPolicies(domain), forceRefresh).then((data) => {
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
    return result[key] || { privacy: null, tos: null, cookie: null, eula: null };
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

  async function triggerAnalysis(domain: string, policyUrls: Record<PolicyType, string | null>, forceRefresh = false): Promise<ExtensionPopupData> {
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
    
    // If no policies found at all
    if (Object.values(policyUrls).every(url => url === null)) {
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
    
    await updateBadge(null, 'processing');
    browser.runtime.sendMessage({ type: 'REPORT_LOADING', payload: { domain, stage: 'Analyzing via Cloudflare...' } }).catch(() => {});
    
    // 2. Call Cloudflare Worker (Tier 2)
    // TODO: Update URL when deployed. Using localhost for dev.
    const WORKER_URL = 'http://127.0.0.1:8787/api/analyze'; 
    
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, policyUrls, forceRefresh })
      });
      
      if (!res.ok) {
        throw new Error(`Worker returned ${res.status}`);
      }
      
      const report: ExtensionSiteReport = await res.json();
      
      const policiesFound = Object.entries(report.policies).map(([type, policy]) => ({
        type: type as PolicyType,
        found: !!Reflect.get(policyUrls, type as PolicyType),
        score: policy?.score ?? null,
        documentId: policy?.documentId ?? null
      }));
      
      const popupData: ExtensionPopupData = {
        domain: report.domain,
        siteName: report.siteName,
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
