import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, FileText, ArrowLeft, AlertTriangle, CheckCircle, 
  ShieldAlert, Printer, Copy, Check, Filter, Link
} from 'lucide-react';
import { ClayCard } from './ClayCard';
import { ClayButton } from './ClayButton';
import { components } from '../api/types';
import { getDemoDocuments } from '../api/client';
import { useDocumentAnalysis } from '../hooks/useDocumentAnalysis';
import { t } from '../i18n';

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
    startUrlAnalysis,
    startDemoAnalysis,
    reset: resetAnalysis
  } = useDocumentAnalysis();

  // Filter State
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low' | 'standard' | 'cautionary' | 'risky'>('all');

  // Active Clause Selection
  const [selectedClause, setSelectedClause] = useState<AnalyzedClause | null>(null);

  // Drag/Drop & Clipboard States
  const [isDragging, setIsDragging] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [pastedUrl, setPastedUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // General Notification / Toast States
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Demo Documents list
  const [demoDocs, setDemoDocs] = useState<any[]>([]);

  // Load demo documents on mount
  useEffect(() => {
    async function fetchDemos() {
      try {
        const liveDemos = await getDemoDocuments();
        setDemoDocs(liveDemos);
      } catch (e) {
        console.warn("Using offline mock documents list:", e);
      }
    }
    fetchDemos();
  }, []);

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
    triggerToast('Copied to clipboard!');
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
      startFileAnalysis(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      startFileAnalysis(files[0]);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    startTextAnalysis(pastedText);
    setPastedText('');
  };

  const handleUrlSubmit = () => {
    const trimmed = pastedUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setToastMessage('Please enter a valid URL starting with http:// or https://');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    startUrlAnalysis(trimmed);
    setPastedUrl('');
  };

  // Risk Level Icon Helpers (mapped to support both mock 'low' and backend 'standard')
  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'high':
      case 'risky':
        return <ShieldAlert className="text-red-600" size={18} />;
      case 'medium':
      case 'cautionary':
        return <AlertTriangle className="text-yellow-600" size={18} />;
      case 'low':
      case 'standard':
      default:
        return <CheckCircle className="text-green-600" size={18} />;
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'high':
      case 'risky':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'medium':
      case 'cautionary':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'low':
      case 'standard':
      default:
        return 'bg-green-100 text-green-800 border border-green-200';
    }
  };

  const filteredClauses = currentDoc?.clauses.filter((clause: AnalyzedClause) => {
    if (filterLevel === 'all') return true;
    
    if (filterLevel === 'low' || filterLevel === 'standard') {
      return clause.riskLevel === 'standard';
    }
    if (filterLevel === 'medium' || filterLevel === 'cautionary') {
      return clause.riskLevel === 'cautionary';
    }
    if (filterLevel === 'high' || filterLevel === 'risky') {
      return clause.riskLevel === 'risky';
    }
    return clause.riskLevel === filterLevel;
  }) || [];

  const countRisks = (level: 'high' | 'medium' | 'low') => {
    if (!currentDoc) return 0;
    if (level === 'high') {
      return currentDoc.clauses.filter((c: AnalyzedClause) => c.riskLevel === 'risky').length;
    }
    if (level === 'medium') {
      return currentDoc.clauses.filter((c: AnalyzedClause) => c.riskLevel === 'cautionary').length;
    }
    if (level === 'low') {
      return currentDoc.clauses.filter((c: AnalyzedClause) => c.riskLevel === 'standard').length;
    }
    return 0;
  };

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
    <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-brand-ink text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-lg flex items-center space-x-2"
          >
            <CheckCircle size={14} className="text-green-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <ClayButton 
            variant="secondary" 
            onClick={() => {
              resetAnalysis();
              onBackToHome();
            }} 
            className="p-3!"
          >
            <ArrowLeft size={16} />
          </ClayButton>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('simplificationSuite')}</span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800">
              {currentDoc ? currentDoc.filename : t('dynamicUpload')}
            </h1>
          </div>
        </div>

        {currentDoc && (
          <div className="flex space-x-3">
            <ClayButton 
              variant="secondary" 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                triggerToast(t('shareLinkToast'));
              }}
              icon={<Link size={15} />}
            >
              {t('shareLink')}
            </ClayButton>
            <ClayButton 
              variant="secondary" 
              onClick={() => window.print()}
              icon={<Printer size={15} />}
            >
              {t('print')}
            </ClayButton>
          </div>
        )}
      </div>

      {/* Main Switch: Upload Screen vs. Workspace Dashboard */}
      {!currentDoc ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* File Upload Zone */}
          <div className="lg:col-span-7 space-y-6">
            <h2 className="text-xl font-bold text-gray-700">{t('chooseAgreement')}</h2>
            
            {analysisError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-sm font-semibold flex items-center justify-between shadow-xs">
                <span>{analysisError}</span>
                <button 
                  onClick={resetAnalysis} 
                  className="bg-red-200 text-red-900 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-300 cursor-pointer transition-colors"
                >
                  {t('clear')}
                </button>
              </div>
            )}
            
            {isAnalyzing ? (
              <ClayCard className="flex flex-col items-center justify-center py-20 text-center space-y-4 border border-orange-100">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-lg text-gray-700">{progressStep}</h3>
                  {progressPercentage !== null && (
                    <div className="w-48 bg-orange-100 h-2 rounded-full mx-auto overflow-hidden p-px">
                      <div className="bg-orange-500 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
                    </div>
                  )}
                </div>
              </ClayCard>
            ) : (
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  cursor-pointer text-center py-20 px-6 rounded-3xl border-3 border-dashed
                  transition-all duration-300 flex flex-col items-center justify-center space-y-4
                  ${isDragging 
                    ? 'border-orange-500 bg-orange-50/50 scale-[1.01]' 
                    : 'border-orange-200 bg-white hover:border-orange-400 hover:scale-[1.005]'
                  }
                  shadow-[0_12px_24px_-10px_rgba(249,115,22,0.05),inset_2px_2px_5px_rgba(255,255,255,0.9),inset_-4px_-4px_10px_rgba(249,115,22,0.04)]
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt" 
                  className="hidden" 
                />
                <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center clay-inner-ring">
                  <Upload size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-700">{t('dragDropFile')}</h3>
                  <p className="text-xs text-gray-400">{t('fileLimits')}</p>
                </div>
                <span className="text-xs font-semibold text-orange-500 bg-orange-50 border border-orange-100 rounded-full px-4 py-1.5 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.8)]">
                  {t('browseFiles')}
                </span>
              </div>
            )}

            {/* Pasted Text Option */}
            <ClayCard className="space-y-4 p-6 border border-orange-100 bg-[#FFFDFB]">
              <div className="flex items-center space-x-2">
                <FileText size={18} className="text-orange-500" />
                <h3 className="font-bold text-gray-700">{t('pasteAgreement')}</h3>
              </div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste the lease clauses, liability declarations, terms rules here..."
                rows={6}
                className="w-full clay-input rounded-2xl! p-4 text-sm resize-none font-mono focus:border-orange-500"
              />
              <div className="flex justify-end">
                <ClayButton 
                  variant="primary" 
                  onClick={handlePasteSubmit}
                  disabled={!pastedText.trim() || isAnalyzing}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('analyzePasted')}
                </ClayButton>
              </div>
            </ClayCard>

            {/* Pasted URL Option */}
            <ClayCard className="space-y-4 p-6 border border-orange-100 bg-[#FFFDFB]">
              <div className="flex items-center space-x-2">
                <Link size={18} className="text-orange-500" />
                <h3 className="font-bold text-gray-700">{t('pasteWebsiteUrl')}</h3>
              </div>
              <input
                type="url"
                value={pastedUrl}
                onChange={(e) => setPastedUrl(e.target.value)}
                placeholder="https://example.com/terms"
                className="w-full clay-input rounded-2xl! p-4 text-sm font-mono focus:border-orange-500"
              />
              <div className="flex justify-end">
                <ClayButton 
                  variant="primary" 
                  onClick={handleUrlSubmit}
                  disabled={!pastedUrl.trim() || isAnalyzing}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('fetchAndAnalyze')}
                </ClayButton>
              </div>
            </ClayCard>
          </div>

          {/* Quick Start Presets */}
          <div className="lg:col-span-5 space-y-6">
            <h2 className="text-xl font-bold text-gray-700">{t('tryStandard')}</h2>
            <div className="grid gap-4">
              {demoDocs.map((doc) => (
                <div 
                  key={doc.id}
                  onClick={() => {
                    startDemoAnalysis(doc.id);
                  }}
                  className="cursor-pointer group"
                >
                  <ClayCard className="p-5 border-2 border-orange-100 hover:border-orange-300 bg-white transition-all duration-300">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                        {doc.filename || doc.title}
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        doc.documentType === 'tos' || doc.type === 'tos' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                      }`}>
                        {doc.documentType === 'tos' || doc.type === 'tos' ? 'Terms' : 'Lease'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mt-2">{doc.summary}</p>
                    <div className="mt-4 flex items-center space-x-4 text-xs font-semibold">
                      <span className="text-gray-400">{t('healthLabel')}</span>
                      <span className={`font-extrabold ${doc.healthScore > 60 ? 'text-green-600' : 'text-red-500'}`}>
                        {doc.healthScore}/100
                      </span>
                    </div>
                  </ClayCard>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Document Analyzer Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Sidebar Area: Health Metrics & Clause List (col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Health Score Overview Widget */}
            <ClayCard className="p-6 border border-orange-100 bg-[#FFFDFB] text-center space-y-4">
              <span className="text-sm font-semibold text-gray-500">{t('healthScoreOverview')}</span>
              
              <div className="relative inline-flex items-center justify-center p-3">
                {/* Visual Circular Clay Dial */}
                <div className="w-28 h-28 rounded-full bg-orange-50 border-4 border-orange-200 flex items-center justify-center shadow-[inset_0_4px_8px_rgba(0,0,0,0.06),0_10px_20px_-5px_rgba(249,115,22,0.1)]">
                  <span className={`text-3xl font-extrabold ${
                    (currentDoc.healthScore ?? 0) > 60 ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {currentDoc.healthScore}%
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-500 text-center leading-relaxed">
                {(currentDoc.healthScore ?? 0) > 60 
                  ? 'This document is mostly balanced, but features a few sections to review.' 
                  : 'Warning: This document contains heavily asymmetrical liability or gotcha clauses.'}
              </div>

              {/* Quick counts */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-bold uppercase tracking-wider">
                <div className="bg-red-50 text-red-800 p-2 rounded-xl border border-red-100">
                  <span className="block text-sm font-black">{countRisks('high')}</span>
                  High
                </div>
                <div className="bg-yellow-50 text-yellow-800 p-2 rounded-xl border border-yellow-100">
                  <span className="block text-sm font-black">{countRisks('medium')}</span>
                  Caution
                </div>
                <div className="bg-green-50 text-green-800 p-2 rounded-xl border border-green-100">
                  <span className="block text-sm font-black">{countRisks('low')}</span>
                  Safe
                </div>
              </div>
            </ClayCard>

            {/* Clause List Filter Toolbar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-600 flex items-center">
                  <Filter size={14} className="mr-1.5 text-orange-500" /> Filter Clauses
                </span>
                <span className="text-xs text-gray-400 font-bold">{filteredClauses.length} items</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'high', label: 'High Risk' },
                  { key: 'medium', label: 'Caution' },
                  { key: 'low', label: 'Safe' }
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setFilterLevel(item.key as any)}
                    className={`
                      px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 cursor-pointer
                      ${filterLevel === item.key 
                        ? 'bg-orange-500 text-white border-orange-600 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.4),0_4px_8px_-2px_rgba(249,115,22,0.3)]' 
                        : 'bg-white text-gray-600 border-orange-100 hover:border-orange-300 hover:bg-orange-50/25 shadow-sm'
                      }
                    `}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Clause list */}
            <div className="space-y-3 max-h-120 overflow-y-auto pr-1">
              {filteredClauses.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400 bg-white rounded-2xl border border-orange-100 p-6">
                  {t('noClausesMatch')}
                </div>
              ) : (
                filteredClauses.map((clause: AnalyzedClause) => {
                  const isActive = selectedClause?.id === clause.id;
                  return (
                    <div 
                      key={clause.id}
                      onClick={() => setSelectedClause(clause)}
                      className="cursor-pointer"
                    >
                      <ClayCard 
                        className={`
                          p-4 border-2 transition-all duration-300 bg-white
                          ${isActive 
                            ? 'border-orange-500 scale-[1.01] shadow-[0_12px_24px_-8px_rgba(249,115,22,0.15)]' 
                            : 'border-orange-100/60 hover:border-orange-300'
                          }
                        `}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] text-gray-400 block mb-1 font-bold uppercase tracking-wider">
                              {clause.category.replace(/_/g, ' ')}
                            </span>
                            <h4 className="font-bold text-sm text-gray-800 leading-tight">
                              {clause.title}
                            </h4>
                          </div>
                          <span className={`text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full flex items-center space-x-1 shrink-0 ${
                            getRiskBadgeColor(clause.riskLevel)
                          }`}>
                            {getRiskIcon(clause.riskLevel)}
                            <span className="ml-1">
                              {clause.riskLevel === 'cautionary' ? 'Caution' :
                               clause.riskLevel === 'standard' ? 'Safe' : 'Risky'}
                            </span>
                          </span>
                        </div>
                      </ClayCard>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detailed Compare Pane (col-span-8) */}
          <div className="lg:col-span-8">
            {selectedClause ? (
              <div className="space-y-6">
                
                {/* Side-by-Side Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Original Legalese */}
                  <ClayCard className="border-2 border-orange-100/50 bg-[#FDFBF9] flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-orange-100/50">
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                        <h3 className="font-bold text-sm text-gray-600 uppercase tracking-widest">{t('originalProvision')}</h3>
                      </div>
                      <p className="font-mono text-xs text-gray-600 leading-relaxed bg-white p-4 rounded-xl border border-orange-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] wrap-break-word max-h-72 overflow-y-auto">
                        {selectedClause.originalText}
                      </p>
                    </div>
                    
                    <div className="flex justify-end pt-4">
                      <ClayButton 
                        variant="secondary" 
                        className="px-3.5! py-2!"
                        onClick={() => handleCopyText(selectedClause.originalText, 'orig')}
                      >
                        {copiedId === 'orig' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        <span className="text-xs ml-1.5">{t('copy')}</span>
                      </ClayButton>
                    </div>
                  </ClayCard>

                  {/* Plain English Translation */}
                  <ClayCard className="border-2 border-orange-100 flex flex-col justify-between h-full bg-[#FFFDFB]">
                    <div>
                      <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-orange-100">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                        <h3 className="font-bold text-sm text-orange-800 uppercase tracking-widest">{t('simplifiedTranslation')}</h3>
                      </div>
                      <p className="text-base font-semibold text-gray-800 leading-relaxed p-4 bg-orange-50/30 rounded-xl border border-orange-100">
                        {selectedClause.simplifiedText}
                      </p>
                    </div>

                    <div className="flex justify-end pt-4">
                      <ClayButton 
                        variant="secondary" 
                        className="px-3.5! py-2!"
                        onClick={() => handleCopyText(selectedClause.simplifiedText, 'simp')}
                      >
                        {copiedId === 'simp' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        <span className="text-xs ml-1.5">{t('copyTranslation')}</span>
                      </ClayButton>
                    </div>
                  </ClayCard>
                </div>

                {/* RAG Reference comparison card (Bottom) */}
                <ClayCard 
                  variant={getClayCardVariant(selectedClause.riskLevel)}
                  className="space-y-4 p-6"
                >
                  <div className="flex items-center space-x-2">
                    {getRiskIcon(selectedClause.riskLevel)}
                    <h3 className="font-extrabold text-lg uppercase tracking-wide">
                      {selectedClause.riskLevel === 'risky'
                        ? 'High-Risk Gotcha Identified' 
                        : selectedClause.riskLevel === 'cautionary'
                        ? 'Clause Deviation Flagged'
                        : 'Standard Terms Confirmed'}
                    </h3>
                  </div>

                  <div className="space-y-3 text-sm">
                    <p className="font-medium text-gray-800">
                      <span className="font-bold block mb-1 text-xs uppercase tracking-wider text-gray-600">{t('whyThisMatters')}</span>
                      {selectedClause.explanation}
                    </p>
                    
                    <div className="p-4 bg-white/70 rounded-xl border border-white/60 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.7)] space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-orange-950 block">{t('ragDatabaseAlternative')}</span>
                      <p className="text-gray-700 italic text-xs leading-relaxed">
                        {selectedClause.ragComparison}
                      </p>
                    </div>
                  </div>
                </ClayCard>
              </div>
            ) : (
              <div className="h-96 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-orange-100 shadow-sm p-8">
                <FileText size={48} className="text-orange-200 mb-4" />
                <h3 className="text-lg font-bold text-gray-600">{t('noClauseSelected')}</h3>
                <p className="text-sm text-gray-400 mt-1">{t('selectClauseDesc')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
