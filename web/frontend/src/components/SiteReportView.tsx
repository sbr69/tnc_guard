import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, CheckCircle, ShieldAlert,
  Copy, Check, Search,
  Sparkles, FileCode,
} from 'lucide-react';
import { ClayCard } from './ClayCard';
import { ClayButton } from './ClayButton';
import { t } from '../i18n';
import type { ExtensionSiteData, ExtensionPolicyData, ExtensionReportClause, PolicyType } from '../api/site';

interface SiteReportViewProps {
  site: ExtensionSiteData;
  onReset?: () => void;
}

const VALID_POLICY_TYPES: PolicyType[] = ['privacy', 'tos', 'cookie', 'eula'];

export const SiteReportView: React.FC<SiteReportViewProps> = ({ site, onReset }) => {
  const [activeTab, setActiveTab] = useState<PolicyType>('privacy');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClause, setSelectedClause] = useState<ExtensionReportClause | null>(null);
  const [viewMode, setViewMode] = useState<'compare' | 'original' | 'simplified'>('compare');
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

  // Pick the first available policy tab by default / when the site changes.
  useEffect(() => {
    const availableTabs = (Object.keys(site.policies) as PolicyType[]).filter(
      (k) => VALID_POLICY_TYPES.includes(k) && site.policies[k]
    );
    if (availableTabs.length > 0 && !site.policies[activeTab]) {
      setActiveTab(availableTabs[0]);
    }
  }, [site]);

  const safeActiveTab = VALID_POLICY_TYPES.includes(activeTab) && site.policies[activeTab]
    ? activeTab
    : (Object.keys(site.policies)[0] as PolicyType | undefined) ?? null;

  const currentPolicy: ExtensionPolicyData | null =
    safeActiveTab ? site.policies[safeActiveTab] ?? null : null;

  // Auto-select the first clause when the active policy tab changes.
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
      // Safe (low) terms are not displayed in the summary — only caution + risky.
      if (clause.riskLevel === 'low') return false;
      if (filterLevel !== 'all' && clause.riskLevel !== filterLevel) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = clause.title?.toLowerCase().includes(query);
        const matchOriginal = clause.originalText?.toLowerCase().includes(query);
        const matchSimplified = clause.simplifiedText?.toLowerCase().includes(query);
        const matchCategory = clause.category?.toLowerCase().includes(query);
        if (!matchTitle && !matchOriginal && !matchSimplified && !matchCategory) return false;
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

  const highRiskCount = useMemo(
    () => currentPolicy?.clauses?.filter(c => c.riskLevel === 'high').length ?? 0,
    [currentPolicy]
  );
  const cautionCount = useMemo(
    () => currentPolicy?.clauses?.filter(c => c.riskLevel === 'medium').length ?? 0,
    [currentPolicy]
  );

  return (
    <div className="space-y-8">
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

      {/* Executive Overview Banner & Health Gauge Header */}
      <ClayCard className="p-6 border-2 border-orange-200/80 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-3 flex flex-col items-center justify-center text-center p-3 border-r-0 md:border-r border-orange-100">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              {t('overallSiteSafetyRating')}
            </span>
            <div className="relative inline-flex items-center justify-center">
              <div className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-inner ${
                site.overallScore >= 7.5
                  ? 'bg-emerald-50/50 border-emerald-300'
                  : site.overallScore >= 5.0
                  ? 'bg-amber-50/50 border-amber-300'
                  : 'bg-red-50/50 border-red-300'
              }`}>
                <span className={`text-3xl font-black tracking-tight ${
                  site.overallScore >= 7.5 ? 'text-emerald-600' : site.overallScore >= 5.0 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {site.overallScore}
                </span>
                <span className="text-[9px] uppercase font-bold text-gray-400 mt-0.5">{t('outOf10')}</span>
              </div>
            </div>
            <div className="mt-3">
              <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border ${getScoreBadgeColor(site.overallScore)}`}>
                {site.overallScore >= 7.5 ? 'Safe Site' : site.overallScore >= 5.0 ? 'Caution Advised' : 'High Risk Site'}
              </span>
            </div>
          </div>

          <div className="md:col-span-9 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest bg-orange-100/70 px-2 py-0.5 rounded-md">
                  {t('extensionReportHeader')}
                </span>
                <h2 className="text-xl font-black text-brand-ink mt-1 flex items-center space-x-2">
                  <span>{site.siteName}</span>
                  <span className="text-xs font-normal text-gray-400">({site.domain})</span>
                </h2>
              </div>
              <span className="text-xs text-gray-400 font-mono">
                {t('scanDateLabel')}{site.scanDate}
              </span>
            </div>

            <p className="text-xs md:text-sm text-gray-700 leading-relaxed bg-orange-50/40 p-3.5 rounded-2xl border border-orange-100">
              {t('scanned4Policies')} ClarifyLaw isolated provisions across active policies and mapped them against standard consumer protection baselines.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
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
            </div>
          </div>
        </div>
      </ClayCard>

      {/* Policy Switcher Tabs (only found policies) */}
      <div className="flex space-x-2 border-b border-orange-100 pb-3 overflow-x-auto">
        {Object.entries(site.policies).map(([id, policy]) => {
          if (!policy) return null;
          const isActive = safeActiveTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id as PolicyType)}
              className={`flex items-center space-x-2.5 px-5 py-3 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-orange-500 text-white shadow-[0_4px_12px_rgba(249,115,22,0.3),inset_0_1.5px_2px_rgba(255,255,255,0.4)] scale-[1.02]'
                  : 'bg-white text-gray-600 border border-orange-100 hover:border-orange-300 hover:bg-orange-50/50 shadow-sm'
              }`}
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
        {/* Left Column: Clause Explorer Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <ClayCard className="p-4 border-2 border-orange-100/80 bg-white space-y-3.5">
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

            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">{t('riskSeverity')}</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'all', label: 'All', count: highRiskCount + cautionCount },
                  { key: 'high', label: 'High', count: highRiskCount },
                  { key: 'medium', label: 'Caution', count: cautionCount }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilterLevel(item.key as any)}
                    className={`px-2.5 py-1 rounded-full text-xs font-extrabold transition-all duration-150 cursor-pointer flex items-center space-x-1 ${
                      filterLevel === item.key
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-orange-100 hover:bg-orange-50/50'
                    }`}
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

          <div className="space-y-2.5 max-h-140 overflow-y-auto pr-1">
            {filteredClauses.length === 0 ? (
              <div className="text-center py-12 text-xs font-semibold text-gray-400 bg-white rounded-2xl border border-orange-100 p-6">
                {t('noClausesMatchFilter')}
              </div>
            ) : (
              filteredClauses.map((clause) => {
                const isActive = selectedClause?.id === clause.id;
                const isHigh = clause.riskLevel === 'high';
                const isMedium = clause.riskLevel === 'medium';
                return (
                  <div key={clause.id} onClick={() => setSelectedClause(clause)} className="cursor-pointer">
                    <ClayCard
                      className={`p-3.5 border-2 transition-all duration-200 bg-white relative overflow-hidden ${
                        isActive
                          ? 'border-orange-500 scale-[1.01] shadow-md bg-orange-50/20'
                          : 'border-orange-100/70 hover:border-orange-300 hover:bg-orange-50/10'
                      }`}
                    >
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
                        <h4 className="font-bold text-xs text-brand-ink leading-snug line-clamp-1">{clause.title}</h4>
                        <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{clause.simplifiedText}</p>
                      </div>
                    </ClayCard>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Comparison Studio */}
        <div className="lg:col-span-8">
          {selectedClause ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 rounded-2xl border border-orange-100 shadow-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest bg-orange-100 px-2 py-0.5 rounded-md">
                    {selectedClause.category}
                  </span>
                  <h3 className="font-black text-base text-brand-ink">{selectedClause.title}</h3>
                </div>
                <div className="flex p-1 bg-orange-50 rounded-xl border border-orange-100">
                  <button type="button" onClick={() => setViewMode('compare')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'compare' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-600 hover:text-orange-600'}`}>{t('viewModeCompare')}</button>
                  <button type="button" onClick={() => setViewMode('original')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'original' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-600 hover:text-orange-600'}`}>{t('viewModeOriginal')}</button>
                  <button type="button" onClick={() => setViewMode('simplified')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'simplified' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-600 hover:text-orange-600'}`}>{t('viewModeSimplified')}</button>
                </div>
              </div>

              {viewMode === 'compare' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ClayCard className="border-2 border-orange-100/70 bg-[#FDFBF9] flex flex-col justify-between h-full">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                        <div className="flex items-center space-x-2">
                          <FileCode size={16} className="text-gray-500" />
                          <h3 className="font-bold text-xs text-gray-600 uppercase tracking-widest">{t('originalLegalese')}</h3>
                        </div>
                        {selectedClause.sectionLocation && (
                          <span className="text-[10px] font-mono text-gray-400 bg-white px-2 py-0.5 rounded-md border border-orange-100">{selectedClause.sectionLocation}</span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-gray-700 leading-relaxed bg-white p-4 rounded-2xl border border-orange-100 shadow-inner max-h-80 overflow-y-auto whitespace-pre-wrap">"{selectedClause.originalText}"</p>
                    </div>
                    <div className="flex justify-end pt-4">
                      <ClayButton variant="secondary" className="px-3.5! py-1.5! text-xs" onClick={() => handleCopyText(selectedClause.originalText, 'orig')}>
                        {copiedId === 'orig' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        <span className="ml-1.5">{t('copyOriginal')}</span>
                      </ClayButton>
                    </div>
                  </ClayCard>

                  <ClayCard className="border-2 border-orange-200 bg-[#FFFDFB] flex flex-col justify-between h-full">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                        <div className="flex items-center space-x-2">
                          <Sparkles size={16} className="text-orange-500" />
                          <h3 className="font-bold text-xs text-orange-800 uppercase tracking-widest">{t('plainEnglishSummary')}</h3>
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">{t('plainEnglishSummary')}</span>
                      </div>
                      <div className="p-4 bg-orange-50/40 rounded-2xl border border-orange-100 space-y-2">
                        <p className="text-sm font-semibold text-brand-ink leading-relaxed">{selectedClause.simplifiedText}</p>
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <ClayButton variant="secondary" className="px-3.5! py-1.5! text-xs" onClick={() => handleCopyText(selectedClause.simplifiedText, 'simp')}>
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
                    <ClayButton variant="secondary" className="px-3.5! py-1.5! text-xs" onClick={() => handleCopyText(selectedClause.originalText, 'orig')}>
                      {copiedId === 'orig' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span className="ml-1.5">{t('copy')}</span>
                    </ClayButton>
                  </div>
                  <p className="font-mono text-xs text-gray-800 leading-relaxed bg-[#FFFDFB] p-5 rounded-2xl border border-orange-100 whitespace-pre-wrap">"{selectedClause.originalText}"</p>
                </ClayCard>
              )}

              {viewMode === 'simplified' && (
                <ClayCard className="border-2 border-orange-100 bg-white p-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                    <h3 className="font-bold text-sm text-orange-800 uppercase tracking-widest">{t('plainEnglishSummary')}</h3>
                    <ClayButton variant="secondary" className="px-3.5! py-1.5! text-xs" onClick={() => handleCopyText(selectedClause.simplifiedText, 'simp')}>
                      {copiedId === 'simp' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span className="ml-1.5">{t('copy')}</span>
                    </ClayButton>
                  </div>
                  <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100">
                    <p className="text-sm font-semibold text-brand-ink leading-relaxed">{selectedClause.simplifiedText}</p>
                  </div>
                  {selectedClause.explanation && (
                    <div className="space-y-1.5">
                      <strong className="text-orange-900 block uppercase tracking-wider text-[11px] font-extrabold">{t('whyThisMatters')}</strong>
                      <p className="text-xs text-gray-700 leading-relaxed bg-white p-4 rounded-xl border border-orange-100">{selectedClause.explanation}</p>
                    </div>
                  )}
                  {selectedClause.ragComparison && (
                    <div className="p-4 bg-orange-100/40 rounded-2xl border border-orange-200 text-xs text-orange-950 italic">
                      <strong className="not-italic font-bold block mb-1 text-orange-900 text-[10px] uppercase tracking-wider">{t('ragStandardBaselineComparison')}</strong>
                      {selectedClause.ragComparison}
                    </div>
                  )}
                </ClayCard>
              )}

              {viewMode === 'compare' && (
                <ClayCard className="border-2 border-orange-100 bg-white p-5 space-y-3.5">
                  {selectedClause.explanation && (
                    <div className="space-y-1">
                      <strong className="text-orange-900 block uppercase tracking-wider text-[11px] font-extrabold">{t('whyThisMatters')}</strong>
                      <p className="text-xs text-gray-700 leading-relaxed bg-orange-50/30 p-3.5 rounded-xl border border-orange-100/80">{selectedClause.explanation}</p>
                    </div>
                  )}
                  {selectedClause.ragComparison && (
                    <div className="p-4 bg-orange-100/40 rounded-2xl border border-orange-200 text-xs text-orange-950 italic">
                      <strong className="not-italic font-bold block mb-1 text-orange-900 text-[10px] uppercase tracking-wider">{t('ragStandardBaselineComparison')}</strong>
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

      {onReset && (
        <div className="flex justify-center pt-2">
          <ClayButton variant="primary" onClick={onReset} className="text-xs px-6 py-3 min-h-11 justify-center">
            {t('scanNewDomain')}
          </ClayButton>
        </div>
      )}
    </div>
  );
};
