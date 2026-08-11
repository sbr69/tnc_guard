import { useState, useEffect, useRef } from 'react';
import type { ExtensionPopupData } from '../../lib/types';
import { Shield, ShieldAlert, ShieldCheck, FileText, CheckCircle2, XCircle, Search, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { browser } from 'wxt/browser';
import { t } from '../../lib/i18n';
import './style.css';

export default function App() {
  const [domain, setDomain] = useState<string>('');
  const [data, setData] = useState<ExtensionPopupData | null>(null);
  const [loadingMsg, setLoadingMsg] = useState<string>('Checking...');
  const [error, setError] = useState<string | null>(null);
  const domainRef = useRef<string>('');

  useEffect(() => {
    // 1. Get current tab domain
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.url) {
        try {
          const url = new URL(activeTab.url);
          // Only process http/https
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            setError('Cannot analyze this page type.');
            return;
          }
          domainRef.current = url.hostname;
          setDomain(url.hostname);
          
          // 2. Ask background for data (send the active tab URL so the backend
          //    can do server-side discovery for any policy types the content
          //    script didn't find on the page).
          browser.runtime.sendMessage({ type: 'GET_CURRENT_REPORT', payload: { domain: url.hostname, pageUrl: url.href } });
        } catch (e) {
          setError('Invalid URL.');
        }
      }
    });

    const storageListener = (changes: any, area: string) => {
      if (area !== 'local') return;
      const cacheKey = `report:${domainRef.current}`;
      if (domainRef.current && changes[cacheKey]?.newValue) {
        setData(changes[cacheKey].newValue as ExtensionPopupData);
        setError(null);
      }
    };
    browser.storage.onChanged.addListener(storageListener);

    // 3. Listen for responses
    const listener = (message: any) => {
      if (message.type === 'REPORT_READY') {
        setData(message.payload);
        setError(null);
      } else if (message.type === 'REPORT_LOADING') {
        setLoadingMsg(message.payload.stage || 'Analyzing...');
        setData(prev => prev ? { ...prev, status: 'processing' } : null);
        setError(null);
      } else if (message.type === 'REPORT_ERROR') {
        setError(message.payload.error || 'Failed to analyze this site.');
      } else if (message.type === 'NO_POLICIES') {
        setError('No legal documents detected on this page. Try right-clicking a link and selecting "Analyze with ClarifyLaw".');
      }
    };
    
    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.storage.onChanged.removeListener(storageListener);
      browser.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const handleCheckSummary = () => {
    if (domain) {
      browser.runtime.sendMessage({ type: 'OPEN_FULL_REPORT', payload: { domain } });
      window.close(); // Close popup
    }
  };

  const handleRescan = () => {
    if (domain) {
      setData(null);
      setLoadingMsg('Re-scanning and bypassing cache...');
      browser.runtime.sendMessage({ type: 'GET_CURRENT_REPORT', payload: { domain, forceRefresh: true } });
    }
  };

  // State 1: Error
  if (error) {
    return (
      <div className="w-87.5 p-5 bg-brand-bg text-brand-ink font-sans flex flex-col items-center text-center">
        <ShieldAlert className="w-12 h-12 text-brand-primary mb-3" />
        <h2 className="text-lg font-bold mb-2">{t('ClarifyLaw')}</h2>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <div className="flex gap-2">
          <button onClick={handleRescan} className="clay-btn clay-btn-primary px-4 py-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> {t('Re-scan')}
          </button>
          <button onClick={() => window.close()} className="clay-btn clay-btn-secondary px-4 py-2">{t('Close')}</button>
        </div>
      </div>
    );
  }

  // State 2: Loading / Analyzing
  if (!data || data.status === 'processing') {
    return (
      <div className="w-87.5 p-5 bg-brand-bg text-brand-ink font-sans flex flex-col items-center justify-center min-h-75">
        <Search className="w-12 h-12 text-brand-primary animate-pulse mb-4" />
        <h2 className="text-lg font-bold mb-1">{t('Analyzing')} {domain || '...'}</h2>
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

  const scoreColor = isSafe ? 'text-green-600' : isWarning ? 'text-yellow-600' : 'text-red-600';
  const ScoreIcon = isSafe ? ShieldCheck : isWarning ? ShieldAlert : XCircle;

  // State 3 & 4: Results (Risks Found or Safe)
  return (
    <div className="w-95 bg-brand-bg text-brand-ink font-sans">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-brand-border">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-primary" />
          <span className="font-bold text-sm">{t('ClarifyLaw')}</span>
        </div>
        <button onClick={handleRescan} className="text-gray-400 hover:text-brand-primary transition-colors" title="Force Re-scan">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

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

        {/* Risk Flags */}
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

        {/* Policies Found (only documents that were actually found/analyzed) */}
        <div className="flex flex-wrap gap-2 text-xs font-medium pt-1">
          {data.policiesFound.filter(p => p.found).map(p => (
            <div key={p.type} className="flex items-center gap-1 px-2 py-1 rounded-full bg-brand-accent-light text-brand-hover">
              <CheckCircle2 className="w-3 h-3" />
              <span className="capitalize">{p.type === 'tos' ? 'T&C' : p.type}</span>
            </div>
          ))}
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
          {t('Scanned')}: {data.scanDate} • v1.0
        </div>
      </div>
    </div>
  );
}
