import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, FileText, ArrowLeft, AlertTriangle, CheckCircle, 
  ShieldAlert, Copy, Check, Link, Search, 
  Sparkles, FileCode, RefreshCw, ChevronRight, Clock, X
} from 'lucide-react';
import { ClayCard } from './ClayCard';
import { ClayButton } from './ClayButton';
import { components } from '../api/types';
import { getDemoDocuments } from '../api/client';
import { analyzeSite, hydrateSiteReport, type ExtensionSiteData } from '../api/site';
import { useDocumentAnalysis } from '../hooks/useDocumentAnalysis';
import { t } from '../i18n';
import { saveAnalysisToHistory, getAnalysisHistory, deleteHistoryEntry, type HistoryEntry } from '../utils/analysisHistory';
import { SiteReportView } from './SiteReportView';

type AnalyzedClause = components['schemas']['AnalyzedClause'];

interface AnalyzerWorkspaceProps {
  initialDocId?: string;
  onBackToHome: () => void;
}

export const AnalyzerWorkspace: React.FC<AnalyzerWorkspaceProps> = ({ 
  initialDocId, 
  onBackToHome 
}) => {
  const {
    document: currentDoc,
    loading: isAnalyzing,
    error: analysisError,
    progressStep,
    progressPercentage,
    startFileAnalysis,
    startTextAnalysis,
    startDemoAnalysis,
    loadResult,
    reset: resetAnalysis
  } = useDocumentAnalysis();

  // Filter & Search State
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Active Clause Selection
  const [selectedClause, setSelectedClause] = useState<AnalyzedClause | null>(null);

  // View Mode State for Comparison Studio (side-by-side, original only, simplified only)
  const [viewMode, setViewMode] = useState<'compare' | 'original' | 'simplified'>('compare');

  // Drag/Drop & Input States
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [pastedUrl, setPastedUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Site (multi-policy) analysis state — triggered by pasting a website URL.
  const [siteReport, setSiteReport] = useState<ExtensionSiteData | null>(null);
  const [siteAnalyzing, setSiteAnalyzing] = useState(false);
  const [siteProgress, setSiteProgress] = useState<number | null>(null);
  const [siteStep, setSiteStep] = useState<string>('');
  const [siteError, setSiteError] = useState<string | null>(null);

  // Toast & Error States
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Demo Documents list
  const [demoDocs, setDemoDocs] = useState<any[]>([]);

  // History state
  const [analysisHistory, setAnalysisHistory] = useState<HistoryEntry[]>([]);

  // Track whether the current doc was loaded from history or is a demo (skip re-saving)
  const skipNextSaveRef = useRef(false);

  // Load demo documents on mount
  useEffect(() => {
    async function fetchDemos() {
      try {
        const liveDemos = await getDemoDocuments();
        setDemoDocs(liveDemos);
      } catch (e) {
        console.warn("Failed to fetch pre-analyzed demo documents list:", e);
      }
    }
    fetchDemos();
  }, []);

  // Load history from IndexedDB on mount
  useEffect(() => {
    getAnalysisHistory().then(setAnalysisHistory).catch(console.warn);
  }, []);

  // Save to history whenever a new analysis result lands (skip demos and history reloads)
  useEffect(() => {
    if (!currentDoc) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveAnalysisToHistory(currentDoc).then(() => {
      getAnalysisHistory().then(setAnalysisHistory).catch(console.warn);
    });
  }, [currentDoc?.id]);

  // Trigger demo document parsing if initialDocId is provided
  useEffect(() => {
    if (initialDocId) {
      startDemoAnalysis(initialDocId);
    }
  }, [initialDocId, startDemoAnalysis]);

  // Automatically select the first clause when a document finishes loading
  useEffect(() => {
    if (currentDoc && currentDoc.clauses.length > 0) {
      setSelectedClause(currentDoc.clauses[0]);
    } else {
      setSelectedClause(null);
    }
  }, [currentDoc]);

  // Trigger brief visual toasts
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    triggerToast(t('copiedTextSuccess'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setStagedFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setStagedFile(files[0]);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    startTextAnalysis(pastedText);
  };

  const handleUrlSubmit = async () => {
    const trimmed = pastedUrl.trim();
    if (!trimmed) return;

    // Accept bare domains / paths (e.g. github.com or github.com/pricing) by
    // normalizing to https://. Per the spec, any link belonging to a website
    // triggers auto-discovery (homepage scrape + path guessing) for the
    // exact subdomain of the pasted URL.
    let siteUrl = trimmed;
    if (!/^https?:\/\//i.test(siteUrl)) {
      siteUrl = 'https://' + siteUrl;
    }
    try {
      // eslint-disable-next-line no-new
      new URL(siteUrl);
    } catch {
      const errMsg = 'Please enter a valid website URL (e.g. github.com or https://github.com/pricing).';
      setUrlError(errMsg);
      triggerToast(errMsg);
      return;
    }

    setUrlError(null);
    setSiteError(null);
    setSiteReport(null);
    resetAnalysis(); // clear any single-doc state
    setSiteAnalyzing(true);
    setSiteProgress(10);
    setSiteStep('Discovering legal documents on this site...');

    try {
      const report = await analyzeSite(siteUrl);
      setSiteProgress(55);
      setSiteStep('Analyzing discovered policies with the RAG pipeline...');
      const data = await hydrateSiteReport(report);
      if (!data || Object.keys(data.policies || {}).length === 0) {
        setSiteError('No legal documents (Privacy / Terms / Cookie / EULA) could be found for this site.');
      } else {
        setSiteReport(data);
      }
      setSiteProgress(100);
    } catch (err: any) {
      setSiteError(err.message || 'Failed to analyze this site.');
    } finally {
      setSiteAnalyzing(false);
      setSiteProgress(null);
    }
  };

  const resetSiteAnalysis = () => {
    setSiteReport(null);
    setSiteAnalyzing(false);
    setSiteError(null);
    setSiteStep('');
    setSiteProgress(null);
    setPastedUrl('');
  };

  // Risk Level Icon Helpers
  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'high':
      case 'risky':
        return <ShieldAlert className="text-red-600 shrink-0" size={18} />;
      case 'medium':
      case 'cautionary':
        return <AlertTriangle className="text-amber-600 shrink-0" size={18} />;
      case 'low':
      case 'standard':
      default:
        return <CheckCircle className="text-emerald-600 shrink-0" size={18} />;
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'high':
      case 'risky':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'medium':
      case 'cautionary':
        return 'bg-amber-100 text-amber-900 border border-amber-200';
      case 'low':
      case 'standard':
      default:
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    }
  };

  // Metrics computation
  const { riskyCount, cautionaryCount, standardCount, categories } = useMemo(() => {
    let risky = 0, cautionary = 0, standard = 0;
    const catSet = new Set<string>();
    if (currentDoc) {
      for (const clause of currentDoc.clauses) {
        if (clause.category) catSet.add(clause.category);
        if (clause.riskLevel === 'risky') risky++;
        else if (clause.riskLevel === 'cautionary') cautionary++;
        else standard++;
      }
    }
    return { 
      riskyCount: risky, 
      cautionaryCount: cautionary, 
      standardCount: standard,
      categories: Array.from(catSet)
    };
  }, [currentDoc?.clauses]);

  // Filtered clauses list
  const filteredClauses = useMemo(() => {
    if (!currentDoc) return [];
    return currentDoc.clauses.filter((clause: AnalyzedClause) => {
      // Risk filter
      if (filterLevel !== 'all') {
        if (filterLevel === 'low') {
          if (clause.riskLevel !== 'standard') return false;
        } else if (filterLevel === 'medium') {
          if (clause.riskLevel !== 'cautionary') return false;
        } else if (filterLevel === 'high') {
          if (clause.riskLevel !== 'risky') return false;
        }
      }
      
      // Category filter
      if (selectedCategory !== 'all' && clause.category !== selectedCategory) {
        return false;
      }

      // Keyword search filter
      if (searchQuery.trim() !== '') {
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
  }, [currentDoc?.clauses, filterLevel, selectedCategory, searchQuery]);

  // Keyboard navigation through clauses
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentDoc || filteredClauses.length === 0) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const currentIndex = selectedClause 
        ? filteredClauses.findIndex(c => c.id === selectedClause.id)
        : -1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, filteredClauses.length - 1);
        setSelectedClause(filteredClauses[nextIndex]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        setSelectedClause(filteredClauses[prevIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDoc, filteredClauses, selectedClause]);

  const getClayCardVariant = (level: string): 'default' | 'low' | 'medium' | 'high' => {
    switch (level) {
      case 'high':
      case 'risky':
        return 'high';
      case 'medium':
      case 'cautionary':
        return 'medium';
      case 'low':
      case 'standard':
        return 'low';
      default:
        return 'default';
    }
  };



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
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            <span className="text-gray-900 font-bold truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 sm:mb-8 gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-orange-100/60">
        <div className="flex items-center space-x-3 sm:space-x-3.5">
          <ClayButton 
            variant="secondary" 
            onClick={() => {
              resetAnalysis();
              resetSiteAnalysis();
              onBackToHome();
            }} 
            className="p-2.5 sm:p-3! rounded-2xl shrink-0 min-h-10.5"
          >
            <ArrowLeft size={18} />
          </ClayButton>
          <div>
            {currentDoc && (
              <div className="flex items-center space-x-2">
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  • {currentDoc.clauses.length} Clauses Analyzed
                </span>
              </div>
            )}
            {siteReport && (
              <div className="flex items-center space-x-2">
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  • Site Policy Report
                </span>
              </div>
            )}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-brand-ink tracking-tight mt-0.5 leading-snug">
              {siteReport ? siteReport.siteName : currentDoc ? currentDoc.filename : t('dynamicUpload')}
            </h1>
          </div>
        </div>

        {(currentDoc || siteReport) && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <ClayButton 
              variant="primary" 
              onClick={() => { resetAnalysis(); resetSiteAnalysis(); }}
              icon={<RefreshCw size={15} />}
              className="text-xs px-4 py-2.5 w-full sm:w-auto min-h-10.5 justify-center"
            >
              {t('analyzeNew')}
            </ClayButton>
          </div>
        )}
      </div>

      {/* SITE ANALYSIS: loading state */}
      {siteAnalyzing ? (
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
              {t('analyzingStage')}
            </span>
            <h3 className="font-extrabold text-lg text-brand-ink">{siteStep || t('readingFile')}</h3>
            {siteProgress !== null && (
              <div className="space-y-1.5">
                <div className="w-64 bg-orange-100/70 h-2.5 rounded-full mx-auto overflow-hidden p-0.5 border border-orange-200/40">
                  <div className="bg-orange-500 h-full rounded-full transition-all duration-300 shadow-sm" style={{ width: `${siteProgress}%` }} />
                </div>
                <span className="text-[11px] font-bold text-gray-500">{siteProgress}% Complete</span>
              </div>
            )}
          </div>
          <button
            onClick={resetSiteAnalysis}
            className="text-xs text-gray-400 underline hover:text-gray-600 cursor-pointer pt-2"
          >
            {t('cancelAnalysis')}
          </button>
        </ClayCard>
      ) : siteError ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 border-2 border-red-200 text-red-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center space-x-2">
            <ShieldAlert size={18} className="text-red-600 shrink-0" />
            <span>{siteError}</span>
          </div>
          <button
            onClick={resetSiteAnalysis}
            className="bg-red-200 text-red-900 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-300 cursor-pointer transition-colors"
          >
            {t('clear')}
          </button>
        </motion.div>
      ) : siteReport ? (
        <SiteReportView site={siteReport} onReset={resetSiteAnalysis} />
      ) : !currentDoc ? (
        <div className="space-y-6">
          {/* Analysis Error Alert */}
          {analysisError && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border-2 border-red-200 text-red-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center space-x-2">
                <ShieldAlert size={18} className="text-red-600 shrink-0" />
                <span>{analysisError}</span>
              </div>
              <button 
                onClick={resetAnalysis} 
                className="bg-red-200 text-red-900 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-300 cursor-pointer transition-colors"
              >
                {t('clear')}
              </button>
            </motion.div>
          )}

          {/* Loading Stepper / Pipeline Progress View */}
          {isAnalyzing ? (
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
                  {t('analyzingStage')}
                </span>
                <h3 className="font-extrabold text-lg text-brand-ink">{progressStep || t('readingFile')}</h3>
                
                {progressPercentage !== null && (
                  <div className="space-y-1.5">
                    <div className="w-64 bg-orange-100/70 h-2.5 rounded-full mx-auto overflow-hidden p-0.5 border border-orange-200/40">
                      <div 
                        className="bg-orange-500 h-full rounded-full transition-all duration-300 shadow-sm" 
                        style={{ width: `${progressPercentage}%` }} 
                      />
                    </div>
                    <span className="text-[11px] font-bold text-gray-500">{progressPercentage}% Complete</span>
                  </div>
                )}
              </div>

              {/* Pipeline Stages checklist - Dynamic Real-Time Status */}
              <div className="grid grid-cols-2 gap-2.5 text-[11px] font-semibold text-gray-600 pt-2 text-left max-w-xs">
                {/* Stage 1: Parsing structure (0-25%) */}
                <div className="flex items-center space-x-1.5">
                  {(progressPercentage ?? 0) >= 25 ? (
                    <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                  ) : (progressPercentage ?? 0) >= 5 ? (
                    <Sparkles size={13} className="text-orange-500 animate-pulse shrink-0" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />
                  )}
                  <span className={(progressPercentage ?? 0) >= 25 ? "text-gray-800 font-bold" : ""}>{t('parsingStructure')}</span>
                </div>

                {/* Stage 2: Hashing clauses (25-50%) */}
                <div className="flex items-center space-x-1.5">
                  {(progressPercentage ?? 0) >= 50 ? (
                    <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                  ) : (progressPercentage ?? 0) >= 25 ? (
                    <Sparkles size={13} className="text-orange-500 animate-pulse shrink-0" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />
                  )}
                  <span className={(progressPercentage ?? 0) >= 50 ? "text-gray-800 font-bold" : ""}>{t('hashingClauses')}</span>
                </div>

                {/* Stage 3: RAG Standard match (50-75%) */}
                <div className="flex items-center space-x-1.5">
                  {(progressPercentage ?? 0) >= 75 ? (
                    <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                  ) : (progressPercentage ?? 0) >= 50 ? (
                    <Sparkles size={13} className="text-orange-500 animate-pulse shrink-0" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />
                  )}
                  <span className={(progressPercentage ?? 0) >= 75 ? "text-gray-800 font-bold" : ""}>{t('ragMatch')}</span>
                </div>

                {/* Stage 4: Risk scoring (75-100%) */}
                <div className="flex items-center space-x-1.5">
                  {(progressPercentage ?? 0) >= 100 ? (
                    <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                  ) : (progressPercentage ?? 0) >= 75 ? (
                    <Sparkles size={13} className="text-orange-500 animate-pulse shrink-0" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />
                  )}
                  <span className={(progressPercentage ?? 0) >= 100 ? "text-gray-800 font-bold" : ""}>{t('riskScoring')}</span>
                </div>
              </div>

              <button 
                onClick={resetAnalysis} 
                className="text-xs text-gray-400 underline hover:text-gray-600 cursor-pointer pt-2"
              >
                {t('cancelAnalysis')}
              </button>
            </ClayCard>
          ) : (
            /* Main 2-Column Section Layout */
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* LEFT CARD: Main Upload Zone (col-span-7) */}
                <ClayCard className="lg:col-span-7 flex flex-col justify-between p-4 sm:p-6 border-2 border-orange-100 bg-white shadow-sm">
                  
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between pb-3 border-b border-orange-100/60">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                        <Upload size={15} />
                      </div>
                      <h3 className="font-extrabold text-sm sm:text-base text-brand-ink">{t('chooseAgreement')}</h3>
                    </div>

                    {/* Format badges on top right */}
                    <div className="flex items-center space-x-1 sm:space-x-1.5">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-gray-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 uppercase">{t('pdfFormat')}</span>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-gray-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 uppercase">{t('docxFormat')}</span>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-gray-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 uppercase">{t('txtFormat')}</span>
                    </div>
                  </div>

                  {/* Inner Dashed Drag & Drop Box */}
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      my-3.5 sm:my-5 cursor-pointer text-center py-8 sm:py-12 px-4 sm:px-6 rounded-2xl border-2 border-dashed
                      transition-all duration-200 flex flex-col items-center justify-center space-y-3.5
                      ${isDragging 
                        ? 'border-orange-500 bg-orange-50/70 scale-[1.01]' 
                        : 'border-orange-200/80 bg-[#FFFDFB] hover:border-orange-400 hover:bg-orange-50/20'
                      }
                    `}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.txt" 
                      className="hidden" 
                    />

                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-orange-100/70 text-orange-600 flex items-center justify-center shadow-xs">
                      <Upload size={20} />
                    </div>

                    <div className="space-y-1 max-w-sm">
                      <h4 className="text-sm sm:text-base font-extrabold text-brand-ink leading-snug">{t('dragDropFile')}</h4>
                      <p className="text-[11px] sm:text-xs text-gray-400">{t('fileLimits')}</p>
                    </div>

                    {/* Staged File Badge or Browse Button */}
                    {stagedFile ? (
                      <div className="flex items-center space-x-2 bg-orange-100/80 text-orange-950 px-3.5 py-1.5 rounded-full border border-orange-200 text-xs font-bold max-w-full">
                        <FileText size={14} className="text-orange-600 shrink-0" />
                        <span className="truncate max-w-45 sm:max-w-50">{stagedFile.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStagedFile(null);
                          }}
                          className="hover:text-red-600 font-bold ml-1 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      /* Black Pill Browse Button */
                      <button
                        type="button"
                        className="mt-1 px-5 py-2.5 rounded-full bg-black hover:bg-gray-900 text-white text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer min-h-10.5 w-full sm:w-auto justify-center"
                      >
                        <span>{t('browseFiles')}</span>
                      </button>
                    )}
                  </div>

                  {/* Bottom Footer Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pt-2 border-t border-orange-100/50">
                    <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs">
                      {t('filesProcessedSecurely')}
                    </p>

                    <ClayButton
                      variant="primary"
                      onClick={() => {
                        if (stagedFile) {
                          startFileAnalysis(stagedFile);
                        } else {
                          fileInputRef.current?.click();
                        }
                      }}
                      disabled={!stagedFile || isAnalyzing}
                      className="text-xs px-6 py-3 w-full sm:w-auto shadow-md disabled:opacity-40 disabled:cursor-not-allowed min-h-11 justify-center"
                    >
                      {t('analyzeAgreement')}
                    </ClayButton>
                  </div>
                </ClayCard>

                {/* RIGHT COLUMN: Stacked Paste Text + Web URL Cards (col-span-5) */}
                <div className="lg:col-span-5 space-y-4 sm:space-y-6 flex flex-col justify-between">
                  
                  {/* Top Right Card: Paste Raw Text */}
                  <ClayCard className="p-4 sm:p-5 border-2 border-orange-100 bg-white space-y-3 sm:space-y-3.5 flex-1 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-orange-100/50">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                            <FileText size={15} />
                          </div>
                          <h3 className="font-extrabold text-xs sm:text-sm text-brand-ink">{t('pasteAgreement')}</h3>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400 font-bold">{pastedText.length} CHARS</span>
                      </div>

                      <div className="relative mt-2.5 sm:mt-3">
                        <textarea
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                          placeholder="Paste contract clauses or agreement sections for targeted risk assessment..."
                          rows={4}
                          className="w-full clay-input rounded-2xl! p-3 text-xs resize-none font-mono focus:border-orange-500 text-gray-700 leading-relaxed bg-[#FFFDFB]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-orange-100/40 mt-2">
                      <span className="text-[10px] text-gray-400 font-semibold">{t('minWordsRecommended')}</span>
                      <ClayButton
                        variant="primary"
                        onClick={handlePasteSubmit}
                        disabled={!pastedText.trim() || isAnalyzing}
                        className="text-[11px] px-4 py-2.5 w-full sm:w-auto min-h-10.5 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t('analyzePasted')}
                      </ClayButton>
                    </div>
                  </ClayCard>

                  {/* Bottom Right Card: Web URL Input */}
                  <ClayCard className="p-4 sm:p-5 border-2 border-orange-100 bg-white space-y-3 shadow-sm">
                    <div className="flex items-center space-x-2.5 pb-2 border-b border-orange-100/50">
                      <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                        <Link size={15} />
                      </div>
                      <h3 className="font-extrabold text-xs sm:text-sm text-brand-ink">{t('pasteWebsiteUrl')}</h3>
                    </div>

                    {/* URL Input Row with Right Arrow Circle Button */}
                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="url"
                        value={pastedUrl}
                        onChange={(e) => {
                          setPastedUrl(e.target.value);
                          if (urlError) setUrlError(null);
                        }}
                        placeholder="e.g. github.com or github.com/pricing"
                        className="flex-1 clay-input rounded-full! px-4 py-2.5 text-xs font-mono focus:border-orange-500 text-gray-700 bg-[#FFFDFB] min-h-10.5"
                      />
                      <ClayButton
                        variant="primary"
                        onClick={handleUrlSubmit}
                        disabled={!pastedUrl.trim() || isAnalyzing}
                        className="p-2.5! rounded-full! shrink-0 min-w-11 min-h-11 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronRight size={18} />
                      </ClayButton>
                    </div>

                    {urlError && (
                      <p className="text-xs font-extrabold text-gray-900 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg flex items-center space-x-1.5">
                        <AlertTriangle size={14} className="text-red-600 shrink-0" />
                        <span className="text-gray-900">{urlError}</span>
                      </p>
                    )}

                    <p className="text-[11px] text-gray-400 leading-relaxed pt-0.5">
                      {t('fetchTermsDirectlyDesc')}
                    </p>
                  </ClayCard>
                </div>
              </div>

              {/* BOTTOM FULL-WIDTH STRIP: History + Demo Presets */}
              {(analysisHistory.length > 0 || demoDocs.length > 0) && (
                <div className="bg-white/90 border-2 border-orange-100 rounded-2xl p-3 sm:p-3.5 px-4 sm:px-6 space-y-3 shadow-xs">

                  {/* Recent Analyses */}
                  {analysisHistory.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 sm:space-x-5">
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <Clock size={11} className="text-gray-400" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {t('recentLabel')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {analysisHistory.map((entry) => {
                          const doc = entry.result;
                          const isHealthy = (doc.healthScore ?? 0) > 60;
                          return (
                            <div key={entry.historyId} className="flex items-center">
                              <button
                                onClick={() => {
                                  skipNextSaveRef.current = true;
                                  loadResult(doc);
                                }}
                                className="px-3.5 py-1.5 rounded-l-full text-xs font-extrabold bg-orange-50/70 hover:bg-orange-100 text-brand-ink border border-r-0 border-orange-200/60 transition-all flex items-center space-x-2 cursor-pointer shadow-2xs min-h-8.5"
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  isHealthy ? 'bg-emerald-500' : 'bg-red-400'
                                }`} />
                                <span className="max-w-32.5 truncate">{doc.filename || 'Untitled'}</span>
                                <span className="text-[9px] font-mono text-gray-400 font-bold shrink-0">({doc.healthScore}%)</span>
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await deleteHistoryEntry(entry.historyId);
                                  setAnalysisHistory(prev => prev.filter(h => h.historyId !== entry.historyId));
                                }}
                                title="Remove from history"
                                className="px-2 py-1.5 rounded-r-full text-[10px] bg-orange-50/70 hover:bg-red-50 hover:text-red-500 text-gray-400 border border-orange-200/60 transition-all cursor-pointer shadow-2xs min-h-8.5 flex items-center"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Divider when both sections present */}
                  {analysisHistory.length > 0 && demoDocs.length > 0 && (
                    <div className="border-t border-orange-100/60" />
                  )}

                  {/* Demo Presets */}
                  {demoDocs.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 sm:space-x-5">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">
                        {t('demosLabel')}
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        {demoDocs.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => {
                              skipNextSaveRef.current = true;
                              startDemoAnalysis(doc.id);
                              triggerToast(t('sampleContractLoaded'));
                            }}
                            className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-orange-50/70 hover:bg-orange-100 text-brand-ink border border-orange-200/60 transition-all flex items-center space-x-2 cursor-pointer shadow-2xs min-h-8.5"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span>{doc.filename || doc.title}</span>
                            <span className="text-[9px] font-mono text-gray-400 font-bold">({doc.healthScore}%)</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* AFTER ANALYSIS STATE: Document Analyzer Workspace & Executive Inspector */
        <div className="space-y-8">
          
          {/* Executive Overview Banner & Health Gauge Header */}
          <ClayCard className="p-6 border-2 border-orange-200/80 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Health Score Circular Gauge (col-span-3) */}
              <div className="md:col-span-3 flex flex-col items-center justify-center text-center p-3 border-r-0 md:border-r border-orange-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('healthScoreOverview')}</span>
                
                <div className="relative inline-flex items-center justify-center">
                  <div className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-inner ${
                    (currentDoc.healthScore ?? 0) > 60 
                      ? 'bg-emerald-50/50 border-emerald-300' 
                      : 'bg-red-50/50 border-red-300'
                  }`}>
                    <span className={`text-3xl font-black tracking-tight ${
                      (currentDoc.healthScore ?? 0) > 60 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {currentDoc.healthScore}%
                    </span>
                    <span className="text-[9px] uppercase font-bold text-gray-400 mt-0.5">{t('ratingLabel')}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                    (currentDoc.healthScore ?? 0) > 60 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                      : 'bg-red-100 text-red-800 border-red-200'
                  }`}>
                    {(currentDoc.healthScore ?? 0) > 60 ? 'Fair Agreement' : 'High Risk Gotchas'}
                  </span>
                </div>
              </div>

              {/* Document Summary & Executive Breakdown (col-span-9) */}
              <div className="md:col-span-9 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest bg-orange-100/70 px-2 py-0.5 rounded-md">
                      {t('executiveSummaryTitle')}
                    </span>
                    <h2 className="text-xl font-black text-brand-ink mt-1">
                      {currentDoc.filename}
                    </h2>
                  </div>

                  <span className="text-xs text-gray-400 font-mono">
                    {t('uploadDateLabel')}{new Date(currentDoc.uploadDate || Date.now()).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs md:text-sm text-gray-700 leading-relaxed bg-orange-50/40 p-3.5 rounded-2xl border border-orange-100">
                  {currentDoc.summary || (
                    (currentDoc.healthScore ?? 0) > 60 
                      ? 'This agreement contains mostly balanced provisions, but several specific terms require careful review prior to signing.' 
                      : 'Warning: ClarifyLaw identified severe gotchas including unilateral modification rights and asymmetric liability terms.'
                  )}
                </p>

                {/* Risk Distribution KPI Bar */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="bg-red-50/80 p-3 rounded-2xl border border-red-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider block">{t('riskyGotchas')}</span>
                      <span className="text-xl font-black text-red-800">{riskyCount}</span>
                    </div>
                    <ShieldAlert size={22} className="text-red-500 opacity-80" />
                  </div>

                  <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">{t('cautionTerms')}</span>
                      <span className="text-xl font-black text-amber-900">{cautionaryCount}</span>
                    </div>
                    <AlertTriangle size={22} className="text-amber-500 opacity-80" />
                  </div>

                  <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">{t('safeStandard')}</span>
                      <span className="text-xl font-black text-emerald-900">{standardCount}</span>
                    </div>
                    <CheckCircle size={22} className="text-emerald-500 opacity-80" />
                  </div>
                </div>
              </div>
            </div>
          </ClayCard>

          {/* MAIN DUAL PANE WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Clause Explorer Sidebar (col-span-4) */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Search & Filter Toolbar */}
              <ClayCard className="p-4 border border-orange-100 bg-[#FFFDFB] space-y-3">
                
                {/* Search Input */}
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchClausesPlaceholder')}
                    className="w-full clay-input pl-9 pr-4 py-2 text-xs focus:border-orange-500 text-gray-700"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Severity Risk Filters */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">{t('riskSeverity')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'all', label: 'All', count: currentDoc.clauses.length },
                      { key: 'high', label: 'Risky', count: riskyCount },
                      { key: 'medium', label: 'Caution', count: cautionaryCount },
                      { key: 'low', label: 'Safe', count: standardCount }
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

                {/* Category Filter Dropdown (if multiple categories exist) */}
                {categories.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">{t('riskCategoryFilter')}</span>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full clay-input rounded-xl! px-3 py-1.5 text-xs font-semibold text-gray-700 cursor-pointer bg-white"
                    >
                      <option value="all">{t('allCategories')}</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.replace(/_/g, ' ').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-orange-100 text-[10px] text-gray-400 font-semibold">
                  <span>{t('showing')}{filteredClauses.length} of {currentDoc.clauses.length} items</span>
                  <span>{t('clauseNavigationHint')}</span>
                </div>
              </ClayCard>

              {/* Scrollable Clause List */}
              <div className="space-y-2.5 max-h-140 overflow-y-auto pr-1">
                {filteredClauses.length === 0 ? (
                  <div className="text-center py-12 text-xs font-semibold text-gray-400 bg-white rounded-2xl border border-orange-100 p-6">
                    {t('noClausesMatch')}
                  </div>
                ) : (
                  filteredClauses.map((clause: AnalyzedClause) => {
                    const isActive = selectedClause?.id === clause.id;
                    const isRisky = clause.riskLevel === 'risky';
                    const isCaution = clause.riskLevel === 'cautionary';
                    
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
                            isRisky ? 'bg-red-500' : isCaution ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />

                          <div className="pl-1 space-y-1">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider block">
                                {clause.category.replace(/_/g, ' ')}
                              </span>
                              <span className={`text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full flex items-center space-x-1 shrink-0 ${
                                getRiskBadgeColor(clause.riskLevel)
                              }`}>
                                {getRiskIcon(clause.riskLevel)}
                                <span className="ml-1">
                                  {isCaution ? 'Caution' : isRisky ? 'Risky' : 'Safe'}
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
                        {selectedClause.category.replace(/_/g, ' ')}
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
                              <h3 className="font-bold text-xs text-gray-600 uppercase tracking-widest">{t('originalProvision')}</h3>
                            </div>
                            {selectedClause.sectionLocation && (
                              <span className="text-[10px] font-mono text-gray-400 bg-white px-2 py-0.5 rounded-md border border-orange-100">
                                {t('locationLabel')}{selectedClause.sectionLocation}
                              </span>
                            )}
                          </div>
                          
                          <p className="font-mono text-xs text-gray-700 leading-relaxed bg-white p-4 rounded-2xl border border-orange-100 shadow-inner max-h-80 overflow-y-auto whitespace-pre-wrap">
                            {selectedClause.originalText}
                          </p>
                        </div>
                        
                        <div className="flex justify-end pt-4">
                          <ClayButton 
                            variant="secondary" 
                            className="px-3.5! py-1.5! text-xs"
                            onClick={() => handleCopyText(selectedClause.originalText, 'orig')}
                          >
                            {copiedId === 'orig' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            <span className="ml-1.5">{t('copyOriginalText')}</span>
                          </ClayButton>
                        </div>
                      </ClayCard>

                      {/* Simplified Plain English Card */}
                      <ClayCard className="border-2 border-orange-200 bg-[#FFFDFB] flex flex-col justify-between h-full">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                            <div className="flex items-center space-x-2">
                              <Sparkles size={16} className="text-orange-500" />
                              <h3 className="font-bold text-xs text-orange-800 uppercase tracking-widest">{t('simplifiedTranslation')}</h3>
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
                            <span className="ml-1.5">{t('copySimplifiedText')}</span>
                          </ClayButton>
                        </div>
                      </ClayCard>
                    </div>
                  )}

                  {viewMode === 'original' && (
                    <ClayCard className="border-2 border-orange-100 bg-white p-6 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                        <h3 className="font-bold text-sm text-gray-700 uppercase tracking-widest">{t('originalProvision')}</h3>
                        <ClayButton 
                          variant="secondary" 
                          className="px-3.5! py-1.5! text-xs"
                          onClick={() => handleCopyText(selectedClause.originalText, 'orig')}
                        >
                          {copiedId === 'orig' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          <span className="ml-1.5">{t('copy')}</span>
                        </ClayButton>
                      </div>

                      <p className="font-mono text-sm text-gray-800 leading-relaxed bg-[#FDFBF9] p-5 rounded-2xl border border-orange-100 whitespace-pre-wrap">
                        {selectedClause.originalText}
                      </p>
                    </ClayCard>
                  )}

                  {viewMode === 'simplified' && (
                    <ClayCard className="border-2 border-orange-200 bg-[#FFFDFB] p-6 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                        <h3 className="font-bold text-sm text-orange-800 uppercase tracking-widest">{t('simplifiedTranslation')}</h3>
                        <ClayButton 
                          variant="secondary" 
                          className="px-3.5! py-1.5! text-xs"
                          onClick={() => handleCopyText(selectedClause.simplifiedText, 'simp')}
                        >
                          {copiedId === 'simp' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          <span className="ml-1.5">{t('copyTranslation')}</span>
                        </ClayButton>
                      </div>

                      <p className="text-base font-semibold text-gray-900 leading-relaxed bg-orange-50/50 p-5 rounded-2xl border border-orange-100">
                        {selectedClause.simplifiedText}
                      </p>
                    </ClayCard>
                  )}

                  {/* RAG Reference & Gotcha Analysis Card (Bottom) */}
                  <ClayCard 
                    variant={getClayCardVariant(selectedClause.riskLevel)}
                    className="space-y-4 p-6"
                  >
                    <div className="flex items-center space-x-2.5">
                      {getRiskIcon(selectedClause.riskLevel)}
                      <h3 className="font-black text-base uppercase tracking-wide">
                        {selectedClause.riskLevel === 'risky'
                          ? 'High-Risk Gotcha Identified' 
                          : selectedClause.riskLevel === 'cautionary'
                          ? 'Clause Deviation Flagged'
                          : 'Standard Safe Terms Confirmed'}
                      </h3>
                    </div>

                    <div className="space-y-4 text-xs md:text-sm">
                      <div>
                        <span className="font-extrabold block mb-1 text-[11px] uppercase tracking-wider text-gray-600">
                          {t('whyThisMatters')}
                        </span>
                        <p className="font-semibold text-gray-800 leading-relaxed">
                          {selectedClause.explanation}
                        </p>
                      </div>
                      
                      {selectedClause.ragComparison && (
                        <div className="p-4 bg-white/80 rounded-2xl border border-white/80 shadow-xs space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-950 block">
                            {t('ragDatabaseAlternative')}
                          </span>
                          <p className="text-gray-700 italic text-xs leading-relaxed font-mono">
                            "{selectedClause.ragComparison}"
                          </p>
                        </div>
                      )}

                      {/* Rule Flags if any exist */}
                      {selectedClause.ruleFlags && selectedClause.ruleFlags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('triggerFlags')}</span>
                          {selectedClause.ruleFlags.map((flag, idx) => (
                            <span key={idx} className="text-[10px] font-bold bg-white/70 text-gray-700 px-2 py-0.5 rounded-md border border-gray-200">
                              {flag.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </ClayCard>
                </div>
              ) : (
                <div className="h-96 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-orange-100 shadow-xs p-8 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center text-orange-300">
                    <FileText size={36} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-700">{t('noClauseSelected')}</h3>
                  <p className="text-xs text-gray-400 max-w-xs">{t('selectClauseDesc')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
