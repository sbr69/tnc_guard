import { useState, useEffect, useRef } from 'react';
import type { ExtensionPopupData, PolicyType } from '../../lib/types';
import { Shield, ShieldAlert, ShieldCheck, FileText, CheckCircle2, Search, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { browser } from 'wxt/browser';
import { t } from '../../lib/i18n';
import './style.css';

const EMPTY_POLICY_URLS: Record<PolicyType, string | null> = {
  privacy: null, tos: null, cookie: null, eula: null,
};

const ALL_POLICY_TYPES: PolicyType[] = ['privacy', 'tos', 'cookie', 'eula'];

function daysSince(scanDateStr?: string): number | null {
  if (!scanDateStr) return null;
  const t = Date.parse(scanDateStr);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

export default function App() {
  const [domain, setDomain] = useState<string>('');
  const [data, setData] = useState<ExtensionPopupData | null>(null);
  const [idle, setIdle] = useState<boolean>(true);
  const [loadingMsg, setLoadingMsg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const domainRef = useRef<string>('');
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // On open: do NOT auto-trigger analysis. Just resolve the active tab and
    // show a cached report if one exists; otherwise show the "Analyse" button.
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.url) {
        setError('No active page to analyze.');
        return;
      }
      let url: URL;
      try {
        url = new URL(activeTab.url);
      } catch {
        setError('Invalid page URL.');
        return;
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        setError('Cannot analyze this page type.');
        return;
      }
      domainRef.current = url.hostname;
      setDomain(url.hostname);

      const cacheKey = `report:${url.hostname}`;
      browser.storage.local.get(cacheKey).then((res) => {
        if (res[cacheKey]) {
          setData(res[cacheKey] as ExtensionPopupData);
          setIdle(false);
          setError(null);
        } else {
          setIdle(true);
        }
      });
    });

    // Live cache updates (e.g. background finished a re-scan).
    const storageListener = (changes: any, area: string) => {
      if (area !== 'local') return;
      const cacheKey = `report:${domainRef.current}`;
      if (domainRef.current && changes[cacheKey]?.newValue) {
        setData(changes[cacheKey].newValue as ExtensionPopupData);
        setError(null);
        setIdle(false);
      }
    };
    browser.storage.onChanged.addListener(storageListener);

    const clearWatchdog = () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    };

    const listener = (message: any) => {
      if (message.type === 'REPORT_READY') {
        clearWatchdog();
        setData(message.payload);
        setError(null);
        setIdle(false);
      } else if (message.type === 'REPORT_LOADING') {
        setLoadingMsg(message.payload.stage || 'Analysing...');
        setData((prev) => (prev ? { ...prev, status: 'processing' } : null));
        setError(null);
        setIdle(false);
      } else if (message.type === 'REPORT_ERROR') {
        clearWatchdog();
        setError(message.payload.error || 'Failed to analyse this site.');
        setIdle(false);
      } else if (message.type === 'NO_POLICIES') {
        clearWatchdog();
        setError('No legal documents detected on this page. Try the "Analyse" button again, or open the site\'s homepage first.');
        setIdle(false);
      }
    };
    browser.runtime.onMessage.addListener(listener);

    return () => {
      clearWatchdog();
      browser.storage.onChanged.removeListener(storageListener);
      browser.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const handleAnalyze = async (forceRefresh = false) => {
    setError(null);
    setData(null);
    setIdle(false);
    setLoadingMsg(forceRefresh ? 'Re-scanning and bypassing cache...' : 'Scanning page for policy links...');

    let tab;
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      tab = tabs[0];
    } catch {
      setError('Could not access the active tab.');
      return;
    }
    if (!tab?.url || tab.id == null) {
      setError('No active page to analyze.');
      return;
    }
    let url: URL;
    try {
      url = new URL(tab.url);
    } catch {
      setError('Invalid page URL.');
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      setError('Cannot analyze this page type.');
      return;
    }

    // Ask the content script to scan the page DOM (lazy on-demand scan).
    let scan: {
      policies?: Record<PolicyType, string | null>;
      policyTexts?: Partial<Record<PolicyType, string>>;
      pageUrl?: string;
    } | null = null;
    try {
      scan = await browser.tabs.sendMessage(tab.id, { type: 'SCAN_POLICIES', payload: { timeoutMs: 2000 } });
    } catch {
      setError('Could not scan this page. Reload the tab and try again.');
      return;
    }

    const pageUrl = scan?.pageUrl || tab.url;
    const policyUrls = scan?.policies ?? EMPTY_POLICY_URLS;
    const policyTexts = scan?.policyTexts ?? {};

    // Fire-and-forget; results arrive via REPORT_READY/LOADING/ERROR (#14).
    browser.runtime.sendMessage({
      type: 'GET_CURRENT_REPORT',
      payload: { domain: url.hostname, pageUrl, policyUrls, policyTexts, forceRefresh },
    }).catch(() => {
      setError('Extension background error. Reload the tab and try again.');
      setIdle(false);
    });

    // Watchdog (#15): if the background never reports back (e.g. SW died), show
    // a retry instead of spinning forever.
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      setError('Analysis is taking longer than expected. The free tier may be rate-limited. Try again.');
      setIdle(false);
    }, 6 * 60 * 1000);
  };

  const handleCheckSummary = () => {
    if (domain) {
      browser.runtime.sendMessage({ type: 'OPEN_FULL_REPORT', payload: { domain } });
      window.close();
    }
  };

  const handleRescan = () => {
    setData(null);
    handleAnalyze(true);
  };

  // State 1: Error
  if (error) {
    return (
      <div className="w-87.5 p-5 bg-brand-bg text-brand-ink font-sans flex flex-col items-center text-center">
        <ShieldAlert className="w-12 h-12 text-brand-primary mb-3" />
        <h2 className="text-lg font-bold mb-2">{t('Unmask-Terms')}</h2>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <div className="flex gap-2">
          <button onClick={() => handleAnalyze()} className="clay-btn clay-btn-primary px-4 py-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> {t('Analyse')}
          </button>
          <button onClick={() => window.close()} className="clay-btn clay-btn-secondary px-4 py-2">{t('Close')}</button>
        </div>
      </div>
    );
  }

  // State 2: Idle — Analyse button (extension works on click, not on popup open)
  if (idle && !data) {
    return (
      <div className="w-87.5 p-5 bg-brand-bg text-brand-ink font-sans flex flex-col items-center text-center min-h-75 justify-center">
        <img src="/icon/TnC_favicon.png" className="w-12 h-12 object-contain mb-3" alt="Logo" />
        <h2 className="text-lg font-bold mb-1">{t('Unmask-Terms')}</h2>
        <p className="text-sm text-gray-600 mb-4">
          {domain ? `${t('Analyse')} ${domain}` : t('Analyse')}
        </p>
        <button onClick={() => handleAnalyze()} className="clay-btn clay-btn-primary px-5 py-2.5 flex items-center gap-2 text-sm">
          <Search className="w-4 h-4" /> {t('Analyse this site')}
        </button>
      </div>
    );
  }

  // State 3: Loading / Analyzing
  if (!data || data.status === 'processing') {
    return (
      <div className="w-87.5 p-5 bg-brand-bg text-brand-ink font-sans flex flex-col items-center justify-center min-h-75">
        <Search className="w-12 h-12 text-brand-primary animate-pulse mb-4" />
        <h2 className="text-lg font-bold mb-1">{t('Analysing')} {domain || '...'}</h2>
        <p className="text-sm text-gray-500 mb-4 text-center">{loadingMsg}</p>
        {data?.status === 'processing' && (
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden">
            <div className="bg-brand-primary h-2.5 rounded-full w-2/3 animate-pulse"></div>
          </div>
        )}
      </div>
    );
  }

  // Determine risk profile
  const isSafe = data.overallScore >= 7.5;
  const isWarning = data.overallScore >= 5.0 && data.overallScore < 7.5;
  const staleDays = daysSince(data.scanDate);
  const isStale = staleDays !== null && staleDays > 7;

  const scoreColor = isSafe ? 'text-green-600' : isWarning ? 'text-yellow-600' : 'text-red-600';
  const ScoreIcon = isSafe ? ShieldCheck : isWarning ? ShieldAlert : AlertTriangle;

  // State 4: Results
  return (
    <div className="w-95 bg-brand-bg text-brand-ink font-sans">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-brand-border">
        <div className="flex items-center gap-2">
          <img src="/icon/TnC_favicon.png" className="w-5 h-5 object-contain" alt="Logo" />
          <span className="font-bold text-sm">{t('Unmask-Terms')}</span>
        </div>
        <button onClick={handleRescan} className="text-gray-400 hover:text-brand-primary transition-colors" title={t('Re-scan')}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stale-cache hint (#16) */}
      {isStale && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 text-yellow-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{t('Scanned {{days}} days ago — results may be outdated.', { days: staleDays })}</span>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Score Card */}
        <div className="clay-card p-4 flex flex-col items-center justify-center">
          <ScoreIcon className={`w-10 h-10 mb-2 ${scoreColor}`} />
          <div className="flex items-end gap-1">
            <span className={`text-4xl font-extrabold ${scoreColor}`}>{data.overallScore.toFixed(1)}</span>
            <span className="text-xl text-gray-400 font-semibold mb-1">/ 10</span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">{t('Safety Score')}</span>
          <span className="text-sm font-medium mt-1 truncate max-w-62.5">{data.siteName || data.domain}</span>
        </div>

        {/* Risk Flags (only risky + caution — safe terms are not surfaced) */}
        {data.riskFlags && data.riskFlags.length > 0 ? (
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {t('Risk Flags')}
            </h3>
            <div className="space-y-2">
              {data.riskFlags.map((flag, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-white rounded-lg p-2 border border-gray-100 shadow-sm">
                  {flag.severity === 'high' ? (
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  ) : flag.severity === 'medium' ? (
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-yellow-500 shrink-0" />
                  ) : (
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-green-500 shrink-0" />
                  )}
                  <span className="text-sm font-medium leading-tight">{flag.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="clay-card-low p-3 flex flex-col items-center text-center">
            <CheckCircle2 className="w-6 h-6 text-green-600 mb-1" />
            <p className="text-sm font-medium text-green-800">{t('No significant risks detected.')}</p>
            <p className="text-xs text-green-700 mt-1">{t("This site's policies appear fair and standard.")}</p>
          </div>
        )}

        {/* Policies: found ones highlighted, missing ones surfaced (#17) */}
        <div className="flex flex-wrap gap-2 text-xs font-medium pt-1">
          {ALL_POLICY_TYPES.map((pt) => {
            const found = data.policiesFound.find((p) => p.type === pt && p.found);
            return found ? (
              <div key={pt} className="flex items-center gap-1 px-2 py-1 rounded-full bg-brand-accent-light text-brand-hover">
                <CheckCircle2 className="w-3 h-3" />
                <span className="capitalize">{pt === 'tos' ? 'T&C' : pt}</span>
              </div>
            ) : (
              <div key={pt} className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-400 border border-gray-200" title="Not found on this site">
                <span className="capitalize">{pt === 'tos' ? 'T&C' : pt}</span>
                <span className="text-[10px]">· {t('Not found')}</span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <button
          onClick={handleCheckSummary}
          className="clay-btn clay-btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2 text-sm"
        >
          <FileText className="w-4 h-4" /> {t('Check Summary')}
          <ExternalLink className="w-3 h-3 opacity-70" />
        </button>

        {/* Footer */}
        <div className="text-center text-[10px] text-gray-400 font-mono mt-2">
          {t('Scanned')}: {data.scanDate} • v{browser.runtime.getManifest().version}
        </div>
      </div>
    </div>
  );
}
