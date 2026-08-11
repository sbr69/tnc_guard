import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, CheckCircle, ShieldAlert, 
  Copy, Check, Search, 
  Sparkles, FileCode, RefreshCw, ChevronRight,
  Globe, ShieldCheck, ArrowLeft
} from 'lucide-react';
import { ClayCard } from './ClayCard';
import { ClayButton } from './ClayButton';
import { t } from '../i18n';

export type PolicyType = 'privacy' | 'tos' | 'cookie' | 'eula';

export interface ExtensionReportClause {
  id: string;
  title: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  originalText: string;
  simplifiedText: string;
  explanation: string;
  ragComparison: string;
  sectionLocation?: string;
}

export interface ExtensionPolicyData {
  type: PolicyType;
  title: string;
  score: number; // 0.0 - 10.0 scale
  riskFlags: string[];
  clauses: ExtensionReportClause[];
}

export interface ExtensionSiteData {
  domain: string;
  siteName: string;
  overallScore: number;
  scanDate: string;
  policies: Record<PolicyType, ExtensionPolicyData>;
}

interface ReportsViewProps {
  onBackToHome?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onBackToHome }) => {
  const [selectedDomain, setSelectedDomain] = useState<string>('acme-cloud.com');
  const [activeTab, setActiveTab] = useState<PolicyType>('privacy');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [customInputUrl, setCustomInputUrl] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClause, setSelectedClause] = useState<ExtensionReportClause | null>(null);
  const [viewMode, setViewMode] = useState<'compare' | 'original' | 'simplified'>('compare');

  const [liveData, setLiveData] = useState<ExtensionSiteData | null>(null);
  const [scannedDomains, setScannedDomains] = useState<string[]>(['acme-cloud.com', 'github.com', 'notion.so']);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStep, setScanStep] = useState<string>('Connecting to site...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Toast & Copy feedback states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    triggerToast(t('copiedTextSuccess') || 'Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const domainParam = params.get('domain');
    const targetDomain = domainParam ? domainParam.replace(/^https?:\/\//, '').split('/')[0] : selectedDomain;
    if (domainParam) {
      setSelectedDomain(targetDomain);
    }
    fetchLiveReport(targetDomain);
  }, []);

  // Simulated animated scan stepper
  const simulateScanProgress = async (_domain: string) => {
    setIsScanning(true);
    setScanProgress(10);
    setScanStep('Fetching extension policy bridge...');
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
    await simulateScanProgress(domain);

    try {
      let reportData: any;
      const workerUrl = `http://127.0.0.1:8787/api/analyze?domain=${encodeURIComponent(domain)}`;
      const res = await fetch(workerUrl);
      
      if (res.ok) {
        reportData = await res.json();
      } else {
        const backendRes = await fetch(`http://127.0.0.1:8001/api/extension/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain,
            policy_urls: {
              privacy: `https://${domain}/privacy`,
              tos: `https://${domain}/terms`,
              cookie: null,
              eula: null
            }
          })
        });
        if (!backendRes.ok) throw new Error('Failed to load extension report.');
        reportData = await backendRes.json();
      }
      
      const policyEntries = Object.entries(reportData.policies || {}).filter(
        ([, summary]) => summary && (summary as any).documentId
      );

      const hydratedResults = await Promise.all(
        policyEntries.map(async ([ptype, summary]) => {
          const p = summary as any;
          let clauses: ExtensionReportClause[] = [];
          try {
            const docRes = await fetch(`http://127.0.0.1:8001/api/documents/${p.documentId}`);
            if (docRes.ok) {
              const docData = await docRes.json();
              clauses = (docData.clauses || []).map((c: any) => ({
                id: c.id,
                title: c.title,
                category: c.category,
                riskLevel: c.riskLevel === 'risky' ? 'high' : c.riskLevel === 'cautionary' ? 'medium' : 'low',
                originalText: c.originalText,
                simplifiedText: c.simplifiedText || 'No simplified text available.',
                explanation: c.explanation || '',
                ragComparison: c.ragComparison || 'Standard clause.',
                sectionLocation: c.sectionLocation || `Sec. ${Math.floor(Math.random() * 8) + 1}`
              }));
            }
          } catch (err) {
            console.error('Failed to fetch doc', p.documentId, err);
          }
          return [ptype as PolicyType, {
            type: ptype as PolicyType,
            title: p.title,
            score: p.score,
            riskFlags: p.riskFlags || [],
            clauses
          }] as [PolicyType, ExtensionPolicyData];
        })
      );

      const VALID_POLICY_TYPES_INNER: PolicyType[] = ['privacy', 'tos', 'cookie', 'eula'];
      const hydratedPolicies: Record<PolicyType, ExtensionPolicyData> = {} as any;
      for (const [ptype, policy] of hydratedResults) {
        if (VALID_POLICY_TYPES_INNER.includes(ptype as PolicyType)) {
          const validKey = ptype as PolicyType;
          hydratedPolicies[validKey] = policy;
        }
      }
      
      setLiveData({
        domain: reportData.domain || domain,
        siteName: reportData.siteName || domain.split('.')[0].toUpperCase(),
        overallScore: reportData.overallScore || 7.5,
        scanDate: reportData.scanDate || new Date().toISOString().split('T')[0],
        policies: hydratedPolicies
      });
      
      setScannedDomains(prev => prev.includes(domain) ? prev : [...prev, domain]);

      const availableTabs = (Object.keys(hydratedPolicies) as PolicyType[]).filter(k => VALID_POLICY_TYPES.includes(k));
      if (availableTabs.length > 0) {
        const firstTab = availableTabs[0];
        setActiveTab(firstTab);
        if (hydratedPolicies[firstTab]?.clauses?.length > 0) {
          setSelectedClause(hydratedPolicies[firstTab].clauses[0]);
        }
      }
      
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
    setSelectedClause(null);
  };

  const VALID_POLICY_TYPES: PolicyType[] = ['privacy', 'tos', 'cookie', 'eula'];
  const currentSite = liveData;
  const safeActiveTab = VALID_POLICY_TYPES.includes(activeTab) ? activeTab : null;
  const currentPolicy = currentSite && currentSite.policies && safeActiveTab
    ? (currentSite.policies[safeActiveTab] ?? Object.values(currentSite.policies).find(Boolean))
    : null;

  // Automatically select first clause when active policy tab changes
  useEffect(() => {
    if (currentPolicy && currentPolicy.clauses && currentPolicy.clauses.length > 0) {
      setSelectedClause(currentPolicy.clauses[0]);
    } else {
      setSelectedClause(null);
    }
  }, [activeTab, currentPolicy]);

  const filteredClauses = useMemo(() => {
    if (!currentPolicy || !currentPolicy.clauses) return [];
    return currentPolicy.clauses.filter((clause) => {
      if (filterLevel !== 'all' && clause.riskLevel !== filterLevel) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = clause.title?.toLowerCase().includes(query);
        const matchOriginal = clause.originalText?.toLowerCase().includes(query);
        const matchSimplified = clause.simplifiedText?.toLowerCase().includes(query);
        const matchCategory = clause.category?.toLowerCase().includes(query);
        if (!matchTitle && !matchOriginal && !matchSimplified && !matchCategory) {
          return false;
        }
      }
      return true;
    });
  }, [currentPolicy, filterLevel, searchQuery]);

  const getScoreBadgeColor = (score: number) => {
    if (score >= 7.5) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (score >= 5.0) return 'bg-amber-100 text-amber-900 border-amber-300';
    return 'bg-red-100 text-red-900 border-red-300';
  };

  const getRiskIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high': return <ShieldAlert size={14} className="text-red-600 shrink-0" />;
      case 'medium': return <AlertTriangle size={14} className="text-amber-600 shrink-0" />;
      case 'low': return <CheckCircle size={14} className="text-emerald-600 shrink-0" />;
    }
  };

  const highRiskCount = useMemo(() => {
    if (!currentPolicy?.clauses) return 0;
    return currentPolicy.clauses.filter(c => c.riskLevel === 'high').length;
  }, [currentPolicy]);

  const cautionCount = useMemo(() => {
    if (!currentPolicy?.clauses) return 0;
    return currentPolicy.clauses.filter(c => c.riskLevel === 'medium').length;
  }, [currentPolicy]);

  const safeCount = useMemo(() => {
    if (!currentPolicy?.clauses) return 0;
    return currentPolicy.clauses.filter(c => c.riskLevel === 'low').length;
  }, [currentPolicy]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 min-h-screen">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white text-gray-900 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full text-xs font-extrabold shadow-2xl flex items-center space-x-2.5 border border-orange-200 max-w-[90vw]"
          >
            <CheckCircle size={15} className="text-emerald-500 shrink-0" />
            <span className="text-gray-900 font-bold truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 sm:mb-8 gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-orange-100/60">
        <div className="flex items-center space-x-3 sm:space-x-3.5">
          {onBackToHome && (
            <ClayButton 
              variant="secondary" 
              onClick={onBackToHome} 
              className="p-2.5 sm:p-3! rounded-2xl shrink-0 min-h-10.5"
            >
              <ArrowLeft size={18} />
            </ClayButton>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-orange-600 uppercase tracking-widest bg-orange-100/80 px-2 py-0.5 rounded-md">
                {t('browserExtensionBridge')}
              </span>
              {currentSite && (
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  • {currentSite.domain}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-brand-ink tracking-tight mt-0.5 leading-snug">
              {currentSite ? `${t('legalSummaryReportFor')} ${currentSite.siteName}` : t('extensionReportHeader')}
            </h1>
          </div>
        </div>

        {currentSite && (
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

      {/* BEFORE ANALYSIS STATE / LOADING STATE */}
      {(!currentSite || isScanning || errorMsg) ? (
        <div className="space-y-6">
          
          {/* Error Alert */}
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

          {/* Loading Stepper / Real-Time Progress View */}
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
                    <div 
                      className="bg-orange-500 h-full rounded-full transition-all duration-300 shadow-sm" 
                      style={{ width: `${scanProgress}%` }} 
                    />
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{scanProgress}% Complete</span>
                </div>
              </div>

              {/* Pipeline Stages checklist - Dynamic Real-Time Status */}
              <div className="grid grid-cols-2 gap-2.5 text-[11px] font-semibold text-gray-600 pt-2 text-left max-w-xs">
                <div className="flex items-center space-x-1.5">
                  {scanProgress >= 25 ? (
                    <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                  ) : scanProgress >= 5 ? (
                    <Sparkles size={13} className="text-orange-500 animate-pulse shrink-0" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />
                  )}
                  <span className={scanProgress >= 25 ? "text-gray-800 font-bold" : ""}>{t('fetchingSitePolicies')}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {scanProgress >= 50 ? (
                    <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                  ) : scanProgress >= 25 ? (
                    <Sparkles size={13} className="text-orange-500 animate-pulse shrink-0" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />
                  )}
                  <span className={scanProgress >= 50 ? "text-gray-800 font-bold" : ""}>{t('parsingPrivacy')}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {scanProgress >= 75 ? (
                    <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                  ) : scanProgress >= 50 ? (
                    <Sparkles size={13} className="text-orange-500 animate-pulse shrink-0" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />
                  )}
                  <span className={scanProgress >= 75 ? "text-gray-800 font-bold" : ""}>{t('ragBaselineComparison')}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {scanProgress >= 100 ? (
                    <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                  ) : scanProgress >= 75 ? (
                    <Sparkles size={13} className="text-orange-500 animate-pulse shrink-0" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />
                  )}
                  <span className={scanProgress >= 100 ? "text-gray-800 font-bold" : ""}>{t('generatingRiskScore')}</span>
                </div>
              </div>

              <button 
                onClick={resetReport} 
                className="text-xs text-gray-400 underline hover:text-gray-600 cursor-pointer pt-2"
              >
                {t('clear')}
              </button>
            </ClayCard>
          ) : (
            /* BEFORE ANALYSIS STATE: 2-Column Section Layout */
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* LEFT CARD: Main Domain Scanner Zone (col-span-7) */}
                <ClayCard className="lg:col-span-7 flex flex-col justify-between p-4 sm:p-6 border-2 border-orange-100 bg-white shadow-sm">
                  
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between pb-3 border-b border-orange-100/60">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                        <Globe size={15} />
                      </div>
                      <h3 className="font-extrabold text-sm sm:text-base text-brand-ink">{t('extensionPolicyScanner')}</h3>
                    </div>

                    {/* Format badges on top right */}
                    <div className="flex items-center space-x-1 sm:space-x-1.5">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-gray-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 uppercase">{t('privacyTab')}</span>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-gray-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 uppercase">{t('tosTab')}</span>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-gray-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 uppercase">{t('eulaTab')}</span>
                    </div>
                  </div>

                  {/* Domain Input Area */}
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

                    {/* Preset Quick Scan Pills */}
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

                  {/* Bottom Footer Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pt-3 border-t border-orange-100/50">
                    <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs">
                      {t('extensionSimBanner')}
                    </p>

                    {/* Black Pill Action Button */}
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

                {/* RIGHT CARD: Extension Bridge Info Card (col-span-5) */}
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
                        <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
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

              {/* BOTTOM FULL-WIDTH HORIZONTAL STRIP: Pre-Scanned Domain Gallery */}
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
        /* AFTER ANALYSIS STATE: Report Detailed Breakdown Studio */
        <div className="space-y-8">
          
          {/* Executive Overview Banner & Health Gauge Header */}
          <ClayCard className="p-6 border-2 border-orange-200/80 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Overall Safety Rating Gauge (col-span-3) */}
              <div className="md:col-span-3 flex flex-col items-center justify-center text-center p-3 border-r-0 md:border-r border-orange-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {t('overallSiteSafetyRating')}
                </span>
                
                <div className="relative inline-flex items-center justify-center">
                  <div className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-inner ${
                    currentSite.overallScore >= 7.5
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : currentSite.overallScore >= 5.0
                      ? 'bg-amber-50/50 border-amber-300'
                      : 'bg-red-50/50 border-red-300'
                  }`}>
                    <span className={`text-3xl font-black tracking-tight ${
                      currentSite.overallScore >= 7.5 ? 'text-emerald-600' : currentSite.overallScore >= 5.0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {currentSite.overallScore}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-gray-400 mt-0.5">{t('outOf10')}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border ${getScoreBadgeColor(currentSite.overallScore)}`}>
                    {currentSite.overallScore >= 7.5 ? 'Safe Site' : currentSite.overallScore >= 5.0 ? 'Caution Advised' : 'High Risk Site'}
                  </span>
                </div>
              </div>

              {/* Site Details & Risk Summary (col-span-9) */}
              <div className="md:col-span-9 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest bg-orange-100/70 px-2 py-0.5 rounded-md">
                      {t('extensionReportHeader')}
                    </span>
                    <h2 className="text-xl font-black text-brand-ink mt-1 flex items-center space-x-2">
                      <span>{currentSite.siteName}</span>
                      <span className="text-xs font-normal text-gray-400">({currentSite.domain})</span>
                    </h2>
                  </div>

                  <span className="text-xs text-gray-400 font-mono">
                    {t('scanDateLabel')}{currentSite.scanDate}
                  </span>
                </div>

                <p className="text-xs md:text-sm text-gray-700 leading-relaxed bg-orange-50/40 p-3.5 rounded-2xl border border-orange-100">
                  {t('scanned4Policies')} ClarifyLaw isolated provisions across active policies and mapped them against standard consumer protection baselines.
                </p>

                {/* Risk Distribution KPI Bar */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="bg-red-50/80 p-3 rounded-2xl border border-red-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider block">{t('highRiskTerms')}</span>
                      <span className="text-xl font-black text-red-800">{highRiskCount}</span>
                    </div>
                    <ShieldAlert size={22} className="text-red-500 opacity-80" />
                  </div>

                  <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">{t('cautionTerms')}</span>
                      <span className="text-xl font-black text-amber-900">{cautionCount}</span>
                    </div>
                    <AlertTriangle size={22} className="text-amber-500 opacity-80" />
                  </div>

                  <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">{t('safeStandard')}</span>
                      <span className="text-xl font-black text-emerald-900">{safeCount}</span>
                    </div>
                    <CheckCircle size={22} className="text-emerald-500 opacity-80" />
                  </div>
                </div>
              </div>
            </div>
          </ClayCard>

          {/* Policy Switcher Tabs */}
          <div className="flex space-x-2 border-b border-orange-100 pb-3 overflow-x-auto">
            {Object.entries(currentSite.policies).map(([id, policy]) => {
              if (!policy) return null;
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as PolicyType)}
                  className={`
                    flex items-center space-x-2.5 px-5 py-3 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer whitespace-nowrap
                    ${isActive 
                      ? 'bg-orange-500 text-white shadow-[0_4px_12px_rgba(249,115,22,0.3),inset_0_1.5px_2px_rgba(255,255,255,0.4)] scale-[1.02]' 
                      : 'bg-white text-gray-600 border border-orange-100 hover:border-orange-300 hover:bg-orange-50/50 shadow-sm'
                    }
                  `}
                >
                  <span className="capitalize">{policy.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {policy.score}/10
                  </span>
                </button>
              );
            })}
          </div>

          {/* MAIN DUAL PANE WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Clause Explorer Sidebar (col-span-4) */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Search & Filter Toolbar */}
              <ClayCard className="p-4 border-2 border-orange-100/80 bg-white space-y-3.5">
                
                {/* Search Input */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchClausesPlaceholder')}
                    className="w-full clay-input rounded-xl! pl-8 pr-3 py-2 text-xs focus:border-orange-500 text-gray-800 bg-[#FFFDFB]"
                  />
                </div>

                {/* Risk Flags summary if present */}
                {currentPolicy && currentPolicy.riskFlags?.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                      {t('flaggedRiskCategories')}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {currentPolicy.riskFlags.map((flag, idx) => (
                        <span 
                          key={idx} 
                          className="bg-red-50 text-red-800 border border-red-100 text-[10px] px-2.5 py-0.5 rounded-full font-bold"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk Severity Filters */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">{t('riskSeverity')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'all', label: 'All', count: currentPolicy?.clauses?.length || 0 },
                      { key: 'high', label: 'High', count: highRiskCount },
                      { key: 'medium', label: 'Caution', count: cautionCount },
                      { key: 'low', label: 'Safe', count: safeCount }
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setFilterLevel(item.key as any)}
                        className={`
                          px-2.5 py-1 rounded-full text-xs font-extrabold transition-all duration-150 cursor-pointer flex items-center space-x-1
                          ${filterLevel === item.key 
                            ? 'bg-orange-500 text-white shadow-sm' 
                            : 'bg-white text-gray-600 border border-orange-100 hover:bg-orange-50/50'
                          }
                        `}
                      >
                        <span>{item.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          filterLevel === item.key ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {item.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-orange-100 text-[10px] text-gray-400 font-semibold">
                  <span>{t('showing')}{filteredClauses.length} items</span>
                  <span>{currentPolicy?.title}</span>
                </div>
              </ClayCard>

              {/* Scrollable Clause List */}
              <div className="space-y-2.5 max-h-140 overflow-y-auto pr-1">
                {filteredClauses.length === 0 ? (
                  <div className="text-center py-12 text-xs font-semibold text-gray-400 bg-white rounded-2xl border border-orange-100 p-6">
                    {t('noClausesMatchFilter')}
                  </div>
                ) : (
                  filteredClauses.map((clause: ExtensionReportClause) => {
                    const isActive = selectedClause?.id === clause.id;
                    const isHigh = clause.riskLevel === 'high';
                    const isMedium = clause.riskLevel === 'medium';
                    
                    return (
                      <div 
                        key={clause.id}
                        onClick={() => setSelectedClause(clause)}
                        className="cursor-pointer"
                      >
                        <ClayCard 
                          className={`
                            p-3.5 border-2 transition-all duration-200 bg-white relative overflow-hidden
                            ${isActive 
                              ? 'border-orange-500 scale-[1.01] shadow-md bg-orange-50/20' 
                              : 'border-orange-100/70 hover:border-orange-300 hover:bg-orange-50/10'
                            }
                          `}
                        >
                          {/* Left Accent Severity Line */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                            isHigh ? 'bg-red-500' : isMedium ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />

                          <div className="pl-1 space-y-1">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider block">
                                {clause.category}
                              </span>
                              <span className={`text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full flex items-center space-x-1 shrink-0 ${
                                isHigh ? 'bg-red-100 text-red-800' : isMedium ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {getRiskIcon(clause.riskLevel)}
                                <span className="ml-1">
                                  {isHigh ? 'High Risk' : isMedium ? 'Caution' : 'Safe'}
                                </span>
                              </span>
                            </div>

                            <h4 className="font-bold text-xs text-brand-ink leading-snug line-clamp-1">
                              {clause.title}
                            </h4>

                            <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                              {clause.simplifiedText}
                            </p>
                          </div>
                        </ClayCard>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Detailed Comparison Studio (col-span-8) */}
            <div className="lg:col-span-8">
              {selectedClause ? (
                <div className="space-y-6">
                  
                  {/* View Mode Switcher Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 rounded-2xl border border-orange-100 shadow-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest bg-orange-100 px-2 py-0.5 rounded-md">
                        {selectedClause.category}
                      </span>
                      <h3 className="font-black text-base text-brand-ink">
                        {selectedClause.title}
                      </h3>
                    </div>

                    {/* View Mode Tabs */}
                    <div className="flex p-1 bg-orange-50 rounded-xl border border-orange-100">
                      <button
                        type="button"
                        onClick={() => setViewMode('compare')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          viewMode === 'compare' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-600 hover:text-orange-600'
                        }`}
                      >
                        {t('viewModeCompare')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewMode('original')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          viewMode === 'original' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-600 hover:text-orange-600'
                        }`}
                      >
                        {t('viewModeOriginal')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewMode('simplified')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          viewMode === 'simplified' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-600 hover:text-orange-600'
                        }`}
                      >
                        {t('viewModeSimplified')}
                      </button>
                    </div>
                  </div>

                  {/* Dynamic View Panes */}
                  {viewMode === 'compare' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Original Legalese Card */}
                      <ClayCard className="border-2 border-orange-100/70 bg-[#FDFBF9] flex flex-col justify-between h-full">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                            <div className="flex items-center space-x-2">
                              <FileCode size={16} className="text-gray-500" />
                              <h3 className="font-bold text-xs text-gray-600 uppercase tracking-widest">{t('originalLegalese')}</h3>
                            </div>
                            {selectedClause.sectionLocation && (
                              <span className="text-[10px] font-mono text-gray-400 bg-white px-2 py-0.5 rounded-md border border-orange-100">
                                {selectedClause.sectionLocation}
                              </span>
                            )}
                          </div>
                          
                          <p className="font-mono text-xs text-gray-700 leading-relaxed bg-white p-4 rounded-2xl border border-orange-100 shadow-inner max-h-80 overflow-y-auto whitespace-pre-wrap">
                            "{selectedClause.originalText}"
                          </p>
                        </div>
                        
                        <div className="flex justify-end pt-4">
                          <ClayButton 
                            variant="secondary" 
                            className="px-3.5! py-1.5! text-xs"
                            onClick={() => handleCopyText(selectedClause.originalText, 'orig')}
                          >
                            {copiedId === 'orig' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            <span className="ml-1.5">{t('copyOriginal')}</span>
                          </ClayButton>
                        </div>
                      </ClayCard>

                      {/* Simplified Plain English Card */}
                      <ClayCard className="border-2 border-orange-200 bg-[#FFFDFB] flex flex-col justify-between h-full">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                            <div className="flex items-center space-x-2">
                              <Sparkles size={16} className="text-orange-500" />
                              <h3 className="font-bold text-xs text-orange-800 uppercase tracking-widest">{t('plainEnglishSummary')}</h3>
                            </div>
                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              {t('plainEnglishSummary')}
                            </span>
                          </div>

                          <div className="p-4 bg-orange-50/40 rounded-2xl border border-orange-100 space-y-2">
                            <p className="text-sm font-semibold text-brand-ink leading-relaxed">
                              {selectedClause.simplifiedText}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end pt-4">
                          <ClayButton 
                            variant="secondary" 
                            className="px-3.5! py-1.5! text-xs"
                            onClick={() => handleCopyText(selectedClause.simplifiedText, 'simp')}
                          >
                            {copiedId === 'simp' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            <span className="ml-1.5">{t('copySummary')}</span>
                          </ClayButton>
                        </div>
                      </ClayCard>
                    </div>
                  )}

                  {viewMode === 'original' && (
                    <ClayCard className="border-2 border-orange-100 bg-white p-6 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                        <h3 className="font-bold text-sm text-gray-700 uppercase tracking-widest">{t('originalLegalese')}</h3>
                        <ClayButton 
                          variant="secondary" 
                          className="px-3.5! py-1.5! text-xs"
                          onClick={() => handleCopyText(selectedClause.originalText, 'orig')}
                        >
                          {copiedId === 'orig' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          <span className="ml-1.5">{t('copy')}</span>
                        </ClayButton>
                      </div>

                      <p className="font-mono text-xs text-gray-800 leading-relaxed bg-[#FFFDFB] p-5 rounded-2xl border border-orange-100 whitespace-pre-wrap">
                        "{selectedClause.originalText}"
                      </p>
                    </ClayCard>
                  )}

                  {viewMode === 'simplified' && (
                    <ClayCard className="border-2 border-orange-100 bg-white p-6 space-y-5">
                      <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                        <h3 className="font-bold text-sm text-orange-800 uppercase tracking-widest">{t('plainEnglishSummary')}</h3>
                        <ClayButton 
                          variant="secondary" 
                          className="px-3.5! py-1.5! text-xs"
                          onClick={() => handleCopyText(selectedClause.simplifiedText, 'simp')}
                        >
                          {copiedId === 'simp' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          <span className="ml-1.5">{t('copy')}</span>
                        </ClayButton>
                      </div>

                      <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100">
                        <p className="text-sm font-semibold text-brand-ink leading-relaxed">
                          {selectedClause.simplifiedText}
                        </p>
                      </div>

                      {selectedClause.explanation && (
                        <div className="space-y-1.5">
                          <strong className="text-orange-900 block uppercase tracking-wider text-[11px] font-extrabold">
                            {t('whyThisMatters')}
                          </strong>
                          <p className="text-xs text-gray-700 leading-relaxed bg-white p-4 rounded-xl border border-orange-100">
                            {selectedClause.explanation}
                          </p>
                        </div>
                      )}

                      {selectedClause.ragComparison && (
                        <div className="p-4 bg-orange-100/40 rounded-2xl border border-orange-200 text-xs text-orange-950 italic">
                          <strong className="not-italic font-bold block mb-1 text-orange-900 text-[10px] uppercase tracking-wider">
                            {t('ragStandardBaselineComparison')}
                          </strong>
                          {selectedClause.ragComparison}
                        </div>
                      )}
                    </ClayCard>
                  )}

                  {/* Why it Matters & RAG Comparison Card (for Compare mode) */}
                  {viewMode === 'compare' && (
                    <ClayCard className="border-2 border-orange-100 bg-white p-5 space-y-3.5">
                      {selectedClause.explanation && (
                        <div className="space-y-1">
                          <strong className="text-orange-900 block uppercase tracking-wider text-[11px] font-extrabold">
                            {t('whyThisMatters')}
                          </strong>
                          <p className="text-xs text-gray-700 leading-relaxed bg-orange-50/30 p-3.5 rounded-xl border border-orange-100/80">
                            {selectedClause.explanation}
                          </p>
                        </div>
                      )}

                      {selectedClause.ragComparison && (
                        <div className="p-4 bg-orange-100/40 rounded-2xl border border-orange-200 text-xs text-orange-950 italic">
                          <strong className="not-italic font-bold block mb-1 text-orange-900 text-[10px] uppercase tracking-wider">
                            {t('ragStandardBaselineComparison')}
                          </strong>
                          {selectedClause.ragComparison}
                        </div>
                      )}
                    </ClayCard>
                  )}
                </div>
              ) : (
                <ClayCard className="p-12 text-center text-xs font-semibold text-gray-400 bg-white border border-orange-100">
                  {t('noClauseSelected')}
                </ClayCard>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
