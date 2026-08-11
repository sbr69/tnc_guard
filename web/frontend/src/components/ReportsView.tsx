import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ShieldAlert,
  Sparkles, RefreshCw, ChevronRight,
  Globe, ShieldCheck,
} from 'lucide-react';
import { ClayCard } from './ClayCard';
import { ClayButton } from './ClayButton';
import { t } from '../i18n';
import {
  analyzeSite,
  getSiteReport,
  hydrateSiteReport,
  type ExtensionSiteData,
  type PolicyType,
} from '../api/site';
import { SiteReportView } from './SiteReportView';

interface ReportsViewProps {
  onBackToHome?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onBackToHome }) => {
  const [selectedDomain, setSelectedDomain] = useState<string>('acme-cloud.com');
  const [customInputUrl, setCustomInputUrl] = useState<string>('');
  const [liveData, setLiveData] = useState<ExtensionSiteData | null>(null);
  const [scannedDomains, setScannedDomains] = useState<string[]>(['acme-cloud.com', 'github.com', 'notion.so']);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStep, setScanStep] = useState<string>('Connecting to site...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const domainParam = params.get('domain');
    const targetDomain = domainParam ? domainParam.replace(/^https?:\/\//, '').split('/')[0] : selectedDomain;
    if (domainParam) {
      setSelectedDomain(targetDomain);
    }
    fetchLiveReport(targetDomain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const simulateScanProgress = async () => {
    setIsScanning(true);
    setScanProgress(10);
    setScanStep('Discovering legal documents...');
    await new Promise(r => setTimeout(r, 400));
    setScanProgress(35);
    setScanStep('Parsing Privacy Policy & ToS...');
    await new Promise(r => setTimeout(r, 500));
    setScanProgress(65);
    setScanStep('Comparing against RAG Industry Baseline...');
    await new Promise(r => setTimeout(r, 500));
    setScanProgress(90);
    setScanStep('Generating Risk Score Matrix...');
    await new Promise(r => setTimeout(r, 400));
    setScanProgress(100);
  };

  const fetchLiveReport = async (domain: string) => {
    setErrorMsg(null);
    await simulateScanProgress();

    try {
      // Try cached site report first (worker GET).
      let report = await getSiteReport(domain);

      // Cache miss -> trigger fresh discovery + analysis via the site endpoint.
      if (!report) {
        report = await analyzeSite(`https://${domain}/`);
      }

      const siteData = await hydrateSiteReport(report);

      setLiveData(siteData);
      setScannedDomains(prev => (prev.includes(domain) ? prev : [...prev, domain]));
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to scan extension report for this domain.');
    } finally {
      setIsScanning(false);
    }
  };

  const resetReport = () => {
    setLiveData(null);
    setErrorMsg(null);
    setIsScanning(false);
  };

  const VALID_POLICY_TYPES: PolicyType[] = ['privacy', 'tos', 'cookie', 'eula'];
  void VALID_POLICY_TYPES;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 min-h-screen">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 sm:mb-8 gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-orange-100/60">
        <div className="flex items-center space-x-3 sm:space-x-3.5">
          {onBackToHome && (
            <ClayButton
              variant="secondary"
              onClick={onBackToHome}
              className="p-2.5 sm:p-3! rounded-2xl shrink-0 min-h-10.5"
            >
              <Globe size={18} />
            </ClayButton>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-orange-600 uppercase tracking-widest bg-orange-100/80 px-2 py-0.5 rounded-md">
                {t('browserExtensionBridge')}
              </span>
              {liveData && (
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  • {liveData.domain}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-brand-ink tracking-tight mt-0.5 leading-snug">
              {liveData ? `${t('legalSummaryReportFor')} ${liveData.siteName}` : t('extensionReportHeader')}
            </h1>
          </div>
        </div>

        {liveData && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <ClayButton
              variant="primary"
              onClick={resetReport}
              icon={<RefreshCw size={15} />}
              className="text-xs px-4 py-2.5 w-full sm:w-auto min-h-10.5 justify-center"
            >
              {t('scanNewDomain')}
            </ClayButton>
          </div>
        )}
      </div>

      {(!liveData || isScanning || errorMsg) ? (
        <div className="space-y-6">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border-2 border-red-200 text-red-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center space-x-2">
                <ShieldAlert size={18} className="text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={resetReport}
                className="bg-red-200 text-red-900 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-300 cursor-pointer transition-colors"
              >
                {t('clear')}
              </button>
            </motion.div>
          )}

          {isScanning ? (
            <ClayCard className="flex flex-col items-center justify-center py-16 text-center space-y-6 border-2 border-orange-200/80 bg-white">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
                <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-orange-600">
                  <Sparkles className="animate-pulse" size={28} />
                </div>
              </div>
              <div className="space-y-3 max-w-sm">
                <span className="text-[10px] font-extrabold text-orange-500 uppercase tracking-widest bg-orange-50 border border-orange-100 px-3 py-1 rounded-full">
                  {t('browserExtensionBridge')}
                </span>
                <h3 className="font-extrabold text-lg text-brand-ink">{scanStep}</h3>
                <div className="space-y-1.5">
                  <div className="w-64 bg-orange-100/70 h-2.5 rounded-full mx-auto overflow-hidden p-0.5 border border-orange-200/40">
                    <div className="bg-orange-500 h-full rounded-full transition-all duration-300 shadow-sm" style={{ width: `${scanProgress}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{scanProgress}% Complete</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-[11px] font-semibold text-gray-600 pt-2 text-left max-w-xs">
                <div className="flex items-center space-x-1.5">
                  {scanProgress >= 25 ? <Sparkles size={13} className="text-orange-500 shrink-0" /> : <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />}
                  <span className={scanProgress >= 25 ? 'text-gray-800 font-bold' : ''}>{t('fetchingSitePolicies')}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  {scanProgress >= 50 ? <Sparkles size={13} className="text-orange-500 shrink-0" /> : <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />}
                  <span className={scanProgress >= 50 ? 'text-gray-800 font-bold' : ''}>{t('parsingPrivacy')}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  {scanProgress >= 75 ? <Sparkles size={13} className="text-orange-500 shrink-0" /> : <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />}
                  <span className={scanProgress >= 75 ? 'text-gray-800 font-bold' : ''}>{t('ragBaselineComparison')}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  {scanProgress >= 100 ? <Sparkles size={13} className="text-orange-500 shrink-0" /> : <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />}
                  <span className={scanProgress >= 100 ? 'text-gray-800 font-bold' : ''}>{t('generatingRiskScore')}</span>
                </div>
              </div>
              <button onClick={resetReport} className="text-xs text-gray-400 underline hover:text-gray-600 cursor-pointer pt-2">
                {t('clear')}
              </button>
            </ClayCard>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <ClayCard className="lg:col-span-7 flex flex-col justify-between p-4 sm:p-6 border-2 border-orange-100 bg-white shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-orange-100/60">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                        <Globe size={15} />
                      </div>
                      <h3 className="font-extrabold text-sm sm:text-base text-brand-ink">{t('extensionPolicyScanner')}</h3>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-1.5">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-gray-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 uppercase">{t('privacyTab')}</span>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-gray-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 uppercase">{t('tosTab')}</span>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-gray-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 uppercase">{t('eulaTab')}</span>
                    </div>
                  </div>

                  <div className="my-4 sm:my-6 space-y-3.5 sm:space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] sm:text-xs font-extrabold text-gray-700 uppercase tracking-wider block">
                        {t('targetWebsiteDomain')}
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={customInputUrl}
                          onChange={(e) => setCustomInputUrl(e.target.value)}
                          placeholder="e.g. github.com or acme-cloud.com"
                          className="flex-1 clay-input rounded-full! px-4 py-2.5 sm:py-3 text-xs font-mono focus:border-orange-500 text-gray-800 bg-[#FFFDFB] min-h-10.5"
                        />
                        <ClayButton
                          variant="primary"
                          onClick={() => {
                            if (customInputUrl.trim()) {
                              const cleanDomain = customInputUrl.trim().replace(/^https?:\/\//, '').split('/')[0];
                              setSelectedDomain(cleanDomain);
                              fetchLiveReport(cleanDomain);
                              setCustomInputUrl('');
                            }
                          }}
                          disabled={!customInputUrl.trim() || isScanning}
                          className="p-2.5! rounded-full! shrink-0 min-w-11 min-h-11 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={18} />
                        </ClayButton>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block">
                        {t('quickScanPresets')}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {['acme-cloud.com', 'github.com', 'notion.so', 'figma.com'].map((dom) => (
                          <button
                            key={dom}
                            type="button"
                            onClick={() => {
                              setSelectedDomain(dom);
                              fetchLiveReport(dom);
                            }}
                            className="px-3 py-1.5 rounded-full text-xs font-bold bg-orange-50/70 hover:bg-orange-100 text-brand-ink border border-orange-200/60 transition-all cursor-pointer flex items-center space-x-1.5 min-h-9"
                          >
                            <Globe size={12} className="text-orange-500 shrink-0" />
                            <span>{dom}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pt-3 border-t border-orange-100/50">
                    <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs">
                      {t('extensionSimBanner')}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const target = customInputUrl.trim() ? customInputUrl.trim().replace(/^https?:\/\//, '').split('/')[0] : selectedDomain;
                        fetchLiveReport(target);
                      }}
                      className="px-5 py-2.5 rounded-full bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer w-full sm:w-auto min-h-11 justify-center"
                    >
                      <span>{t('simulateExtensionScan')}</span>
                    </button>
                  </div>
                </ClayCard>

                <ClayCard className="lg:col-span-5 p-4 sm:p-6 border-2 border-orange-100 bg-white flex flex-col justify-between space-y-4 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2.5 pb-2 border-b border-orange-100/50">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                        <Sparkles size={15} />
                      </div>
                      <h3 className="font-extrabold text-xs sm:text-sm text-brand-ink">{t('browserExtensionBridge')}</h3>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {t('interceptsDesc')}
                    </p>
                    <div className="space-y-2 pt-2">
                      <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-100 flex items-start space-x-2.5">
                        <ShieldCheck size={16} className="text-orange-500 shrink-0 mt-0.5" />
                        <span className="text-[11px] text-gray-700 font-medium leading-normal">
                          {t('scanned4Policies')}
                        </span>
                      </div>
                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-start space-x-2.5">
                        <Sparkles size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-[11px] text-emerald-900 font-medium leading-normal">
                          {t('matchesProvisionsDesc')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-orange-100/40">
                    <span className="text-[10px] text-gray-400 font-semibold block">
                      {t('poweredByRAG')}
                    </span>
                  </div>
                </ClayCard>
              </div>

              {scannedDomains.length > 0 && (
                <div className="bg-white/90 border-2 border-orange-100 rounded-2xl p-3 sm:p-3.5 px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-5 shadow-xs">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">
                    {t('scannedDomainsLabel')}
                  </span>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {scannedDomains.map((dom) => (
                      <button
                        key={dom}
                        onClick={() => {
                          setSelectedDomain(dom);
                          fetchLiveReport(dom);
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-all flex items-center space-x-2 cursor-pointer shadow-2xs min-h-9 ${
                          selectedDomain === dom
                            ? 'bg-orange-500 text-white border-orange-600'
                            : 'bg-orange-50/70 hover:bg-orange-100 text-brand-ink border-orange-200/60'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{dom}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <SiteReportView site={liveData} onReset={resetReport} />
      )}
    </div>
  );
};
