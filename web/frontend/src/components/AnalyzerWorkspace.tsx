import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, FileText, ArrowLeft, AlertTriangle, CheckCircle, 
  ShieldAlert, Download, Printer, Copy, Check, Filter 
} from 'lucide-react';
import { ClayCard } from './ClayCard';
import { ClayButton } from './ClayButton';
import { mockDocuments, Document, Clause } from '../mockData';
import { t } from '../i18n';

interface AnalyzerWorkspaceProps {
  initialDocId?: string;
  onBackToHome: () => void;
}

export const AnalyzerWorkspace: React.FC<AnalyzerWorkspaceProps> = ({ 
  initialDocId, 
  onBackToHome 
}) => {
  // Loaded Document State
  const [currentDoc, setCurrentDoc] = useState<Document | null>(() => {
    if (initialDocId) {
      return mockDocuments.find(d => d.id === initialDocId) || null;
    }
    return null;
  });

  // Filter State
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Active Clause Selection
  const [selectedClause, setSelectedClause] = useState<Clause | null>(() => {
    if (initialDocId) {
      const doc = mockDocuments.find(d => d.id === initialDocId);
      return doc && doc.clauses.length > 0 ? doc.clauses[0] : null;
    }
    return null;
  });

  // Upload/Processing States
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [processStep, setProcessStep] = useState<string>('');
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // General Notification / Toast States
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      processUploadedFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processUploadedFile(files[0]);
    }
  };

  // Mock processing simulation for uploaded document
  const processUploadedFile = (file: File) => {
    setUploadProgress(0);
    setProcessStep('Reading file contents...');

    let progress = 0;
    const interval = setInterval(() => {
      progress += 25;
      setUploadProgress(progress);
      
      if (progress === 25) {
        setProcessStep('Extracting individual provisions...');
      } else if (progress === 50) {
        setProcessStep('Comparing with standard reference clauses (RAG)...');
      } else if (progress === 75) {
        setProcessStep('Flagging unusual or high-risk legal terms...');
      } else if (progress === 100) {
        clearInterval(interval);
        setTimeout(() => {
          // Generate mock parsed document
          const newDoc: Document = {
            id: `uploaded-${Date.now()}`,
            title: file.name.replace(/\.[^/.]+$/, ""), // remove extension
            type: 'custom',
            uploadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            healthScore: 54,
            summary: `Successfully parsed custom document "${file.name}". Out of 3 detected clauses, 1 has been flagged as high-risk due to non-standard liabilities.`,
            clauses: [
              {
                id: 'up-c1',
                title: 'Limitation of Provider Liability',
                category: 'Liability & Indemnity',
                riskLevel: 'high',
                originalText: 'UNDER NO CIRCUMSTANCES SHALL THE PROVIDER OR ITS AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL OR EXEMPLARY DAMAGES ARISING OUT OF OR IN CONNECTION WITH THE SERVICES, EVEN IF ADVISED OF THE POSSIBILITY OF DAMAGES, EXCLUDING DIRECT LIABILITY UP TO THE SUM OF FIFTY DOLLARS ($50).',
                simplifiedText: 'The company is not responsible for any indirect damages you suffer. If they break the contract, the maximum money you can recover from them is capped at just $50.',
                explanation: 'A $50 liability cap is extremely low and effectively prevents you from recovering any real damages or losses caused by the provider\'s system outages, security breaches, or failure to perform.',
                ragComparison: 'Standard software and service provider agreements specify a liability cap equal to either $1000 or the total fees paid by the client in the prior 12 months, which is fair and reciprocal.'
              },
              {
                id: 'up-c2',
                title: 'Data Collection & Advertising Permissions',
                category: 'Privacy',
                riskLevel: 'medium',
                originalText: 'YOU GRANT THE PROVIDER A PERPETUAL, IRREVOCABLE, WORLDWIDE, ROYALT-FREE LICENSE TO AGGREGATE, ANALYZE, ANONYMIZE, AND SELL DATA DERIVED FROM YOUR TRANSACTIONS TO THIRD-PARTY ADVERTISING CONGRUPATIONS.',
                simplifiedText: 'The company has a permanent, free license to gather your transaction history, package it, and sell it to advertising companies.',
                explanation: 'Selling transaction data to third parties is a caution-level clause. Many privacy-conscious clients would reject this term or require an explicit opt-out.',
                ragComparison: 'Standard corporate privacy terms allow data aggregation for internal analytics and product improvement, but prohibit selling individual or transaction-level data to third-party ad brokers without explicit consent.'
              },
              {
                id: 'up-c3',
                title: 'General Support Obligations',
                category: 'Service Level',
                riskLevel: 'low',
                originalText: 'THE PROVIDER SHALL EXERT COMMERCIALLY REASONABLE EFFORTS TO PROVIDE SYSTEM SUPPORT VIA EMAIL FROM MONDAY THROUGH FRIDAY, 9:00 AM TO 5:00 PM EST, EXCLUDING NATIONAL BANK HOLIDAYS.',
                simplifiedText: 'Support is available via email on weekdays (Mon-Fri) from 9 AM to 5 PM EST, except for public holidays.',
                explanation: 'This is a standard, reasonable support policy for non-critical software services.',
                ragComparison: 'Aligned with basic service industry support expectations.'
              }
            ]
          };

          setCurrentDoc(newDoc);
          setSelectedClause(newDoc.clauses[0]);
          setUploadProgress(null);
          triggerToast('Document parsed successfully!');
        }, 800);
      }
    }, 500);
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    
    // Simulate paste parse
    setUploadProgress(10);
    setProcessStep('Reading pasted agreement text...');
    
    setTimeout(() => {
      const newDoc: Document = {
        id: `pasted-${Date.now()}`,
        title: 'Pasted Custom Document',
        type: 'custom',
        uploadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        healthScore: 60,
        summary: 'Parsed from pasted text block. Identified 2 clauses for review.',
        clauses: [
          {
            id: 'paste-c1',
            title: 'Governing Law and Forum Selection',
            category: 'Governing Law',
            riskLevel: 'medium',
            originalText: 'THIS AGREEMENT SHALL BE GOVERNED BY, AND CONSTRUED IN ACCORDANCE WITH, THE LAWS OF THE STATE OF DELAWARE, WITHOUT GIVING EFFECT TO CONFLICTS OF LAW PRINCIPLES. ANY LEGAL ACTION ARISNG OUT OF THIS LEASE MUST BE BROUGHT EXCLUSIVELY IN THE COURT OF CHANCERY IN WILMINGTON, DELAWARE.',
            simplifiedText: 'Any disputes or lawsuits about this agreement must take place exclusively in the courts of Wilmington, Delaware, under Delaware law.',
            explanation: 'Forum selection clauses force you to travel to a specific location (often Delaware for SaaS, or the landlord\'s home state) to file a lawsuit, which can be highly expensive and inconvenient.',
            ragComparison: 'Standard customer contracts allow legal disputes to be resolved in the user\'s local state courts, or at least state that governing law matches the location where services are rendered.'
          },
          {
            id: 'paste-c2',
            title: 'Late Rent Payment Penalty Fee',
            category: 'Rental Terms',
            riskLevel: 'high',
            originalText: 'IN THE EVENT RENT IS NOT PAID BY THE FIRST (1ST) DAY OF THE CALENDAR MONTH, TENANT AGREES TO PAY A LATE CHARGE OF TEN PERCENT (10%) OF THE TOTAL MONTHLY RENTAL AMOUNT FOR EACH DAY RENT REMAINS UNPAID.',
            simplifiedText: 'If your rent is late, you will be charged a late fee of 10% of your rent every single day until you pay.',
            explanation: 'Charging a 10% daily penalty accumulates extremely quickly and is illegal under most local rental laws, which cap late fees at a reasonable flat rate or 5-10% of rent per month total.',
            ragComparison: 'Standard rental contracts restrict late fees to a 3-5 day grace period, followed by a flat fee (e.g. $50) or a maximum cumulative fee of 5% of monthly rent.'
          }
        ]
      };
      
      setCurrentDoc(newDoc);
      setSelectedClause(newDoc.clauses[0]);
      setUploadProgress(null);
      setPastedText('');
      triggerToast('Pasted text analyzed!');
    }, 1500);
  };

  // Risk Level Icon Helpers
  const getRiskIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high':
        return <ShieldAlert className="text-red-600" size={18} />;
      case 'medium':
        return <AlertTriangle className="text-yellow-600" size={18} />;
      case 'low':
        return <CheckCircle className="text-green-600" size={18} />;
    }
  };

  const getRiskBadgeColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-800 border border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border border-green-200';
    }
  };

  const filteredClauses = currentDoc?.clauses.filter(clause => {
    if (filterLevel === 'all') return true;
    return clause.riskLevel === filterLevel;
  }) || [];

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
          <ClayButton variant="secondary" onClick={onBackToHome} className="p-3!">
            <ArrowLeft size={16} />
          </ClayButton>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('simplificationSuite')}</span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800">
              {currentDoc ? currentDoc.title : t('dynamicUpload')}
            </h1>
          </div>
        </div>

        {currentDoc && (
          <div className="flex space-x-3">
            <ClayButton 
              variant="secondary" 
              onClick={() => triggerToast('Generating PDF Report... ready for download.')}
              icon={<Download size={15} />}
            >
              {t('pdfReport')}
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
            
            {uploadProgress !== null ? (
              <ClayCard className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-lg text-gray-700">{processStep}</h3>
                  <div className="w-48 bg-orange-100 h-2 rounded-full mx-auto overflow-hidden p-px">
                    <div className="bg-orange-500 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
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
                  disabled={!pastedText.trim()}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('analyzePasted')}
                </ClayButton>
              </div>
            </ClayCard>
          </div>

          {/* Quick Start Presets */}
          <div className="lg:col-span-5 space-y-6">
            <h2 className="text-xl font-bold text-gray-700">{t('tryStandard')}</h2>
            <div className="grid gap-4">
              {mockDocuments.map((doc) => (
                <div 
                  key={doc.id}
                  onClick={() => {
                    setCurrentDoc(doc);
                    setSelectedClause(doc.clauses[0]);
                  }}
                  className="cursor-pointer group"
                >
                  <ClayCard className="p-5 border-2 border-orange-100 hover:border-orange-300 bg-white transition-all duration-300">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                        {doc.title}
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        doc.type === 'tos' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                      }`}>
                        {doc.type === 'tos' ? 'Terms' : 'Lease'}
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
                    currentDoc.healthScore > 60 ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {currentDoc.healthScore}%
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-500 text-center leading-relaxed">
                {currentDoc.healthScore > 60 
                  ? 'This document is mostly balanced, but features a few sections to review.' 
                  : 'Warning: This document contains heavily asymmetrical liability or gotcha clauses.'}
              </div>

              {/* Quick counts */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-bold uppercase tracking-wider">
                <div className="bg-red-50 text-red-800 p-2 rounded-xl border border-red-100">
                  <span className="block text-sm font-black">{currentDoc.clauses.filter(c => c.riskLevel === 'high').length}</span>
                  High
                </div>
                <div className="bg-yellow-50 text-yellow-800 p-2 rounded-xl border border-yellow-100">
                  <span className="block text-sm font-black">{currentDoc.clauses.filter(c => c.riskLevel === 'medium').length}</span>
                  Caution
                </div>
                <div className="bg-green-50 text-green-800 p-2 rounded-xl border border-green-100">
                  <span className="block text-sm font-black">{currentDoc.clauses.filter(c => c.riskLevel === 'low').length}</span>
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
                filteredClauses.map((clause) => {
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
                              {clause.category}
                            </span>
                            <h4 className="font-bold text-sm text-gray-800 leading-tight">
                              {clause.title}
                            </h4>
                          </div>
                          <span className={`text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full flex items-center space-x-1 shrink-0 ${
                            getRiskBadgeColor(clause.riskLevel)
                          }`}>
                            {getRiskIcon(clause.riskLevel)}
                            <span className="ml-1">{clause.riskLevel === 'medium' ? 'Caution' : clause.riskLevel}</span>
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
                  variant={selectedClause.riskLevel}
                  className="space-y-4 p-6"
                >
                  <div className="flex items-center space-x-2">
                    {getRiskIcon(selectedClause.riskLevel)}
                    <h3 className="font-extrabold text-lg uppercase tracking-wide">
                      {selectedClause.riskLevel === 'high' 
                        ? 'High-Risk Gotcha Identified' 
                        : selectedClause.riskLevel === 'medium'
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
