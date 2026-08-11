import React from 'react';
import { motion } from 'motion/react';
import { FileText, ArrowRight, ShieldCheck, HelpCircle, FileCheck, Layers, FileWarning } from 'lucide-react';
import { ClayCard } from './ClayCard';
import { ClayButton } from './ClayButton';
import { getDemoDocuments } from '../api/client';
import { t } from '../i18n';

interface LandingPageProps {
  onStart: (docId?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [demoDocs, setDemoDocs] = React.useState<any[]>([]);

  React.useEffect(() => {
    getDemoDocuments().then(setDemoDocs).catch(console.error);
  }, []);

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Top Navigation */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between border-b border-[#FFEDD5]">
        <div className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer" onClick={() => onStart('acme-tos')}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white clay-inner-ring shadow-[0_4px_12px_rgba(249,115,22,0.3)] shrink-0">
            <ShieldCheck size={20} className="sm:hidden" />
            <ShieldCheck size={24} className="hidden sm:block" />
          </div>
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-brand-ink">
            {t('clarify')}<span className="text-orange-500">{t('law')}</span>
          </span>
        </div>
        
        <nav className="hidden md:flex items-center space-x-8 font-medium text-gray-600">
          <a href="#features" className="hover:text-orange-500 transition-colors">{t('features')}</a>
          <a href="#bento" className="hover:text-orange-500 transition-colors">{t('howItWorks')}</a>
          {demoDocs.length > 0 && <a href="#demo" className="hover:text-orange-500 transition-colors">{t('demoDocs')}</a>}
        </nav>

        <div>
          <ClayButton variant="primary" onClick={() => onStart()} className="text-xs px-4 py-2 min-h-10">
            {t('analyzeAgreement')}
          </ClayButton>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-12 sm:pb-20 grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
        <div className="lg:col-span-7 space-y-4 sm:space-y-6 text-left">
          <div className="inline-flex items-center space-x-2 bg-orange-100/80 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider text-orange-700 border border-orange-200">
            <span>{t('ragAnalysis')}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-brand-ink leading-tight sm:leading-[1.05]">
            {t('heroTitlePart1')}<br />
            <span className="text-orange-500">{t('heroTitlePart2')}</span>
          </h1>

          <p className="text-sm sm:text-lg text-gray-600 max-w-[50ch] leading-relaxed">
            {t('heroSubtext')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 w-full sm:w-auto">
            <ClayButton 
              variant="primary" 
              onClick={() => onStart()} 
              icon={<ArrowRight size={18} />}
              className="w-full sm:w-auto min-h-11 justify-center"
            >
              {t('analyzeAgreement')}
            </ClayButton>
          </div>
        </div>

        <div className="lg:col-span-5 relative flex justify-center items-center">
          {/* Background Clay Sphere */}
          <div className="absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-orange-200/50 filter blur-3xl -z-10" />

          {/* Interactive Hero Clay Card */}
          <motion.div 
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', duration: 0.8, bounce: 0.2 }}
            className="w-full max-w-sm clay-card p-4 sm:p-6 space-y-4 sm:space-y-5 border-2 border-orange-100"
          >
            <div className="flex justify-between items-center pb-2 border-b border-orange-50">
              <span className="font-semibold text-xs sm:text-sm text-gray-500">{t('uploadAgreementPdf')}</span>
              <span className="text-[10px] sm:text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">9.2 KB</span>
            </div>

            {/* Simulated Analyzing Screen */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center space-x-2.5 sm:space-x-3 p-2.5 sm:p-3 rounded-2xl bg-red-50 border border-red-100 shadow-[inset_0_2px_4px_rgba(239,68,68,0.03)]">
                <div className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center clay-inner-ring shrink-0">
                  <FileWarning size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-red-900 truncate">{t('landlordEntry')}</h4>
                  <p className="text-[10px] text-red-700 truncate">{t('flaggedQuietEnjoyment')}</p>
                </div>
                <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider bg-red-100 text-red-800 px-2 py-0.5 rounded-full shrink-0">{t('highRisk')}</span>
              </div>

              <div className="flex items-center space-x-2.5 sm:space-x-3 p-2.5 sm:p-3 rounded-2xl bg-yellow-50 border border-yellow-100 shadow-[inset_0_2px_4px_rgba(234,179,8,0.03)]">
                <div className="w-8 h-8 rounded-xl bg-yellow-500 text-white flex items-center justify-center clay-inner-ring shrink-0">
                  <HelpCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-yellow-900 truncate">{t('autoRenewal')}</h4>
                  <p className="text-[10px] text-yellow-700 truncate">{t('flagged30Day')}</p>
                </div>
                <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full shrink-0">{t('caution')}</span>
              </div>

              <div className="flex items-center space-x-2.5 sm:space-x-3 p-2.5 sm:p-3 rounded-2xl bg-green-50 border border-green-100 shadow-[inset_0_2px_4px_rgba(34,197,94,0.03)]">
                <div className="w-8 h-8 rounded-xl bg-green-500 text-white flex items-center justify-center clay-inner-ring shrink-0">
                  <FileCheck size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-green-900 truncate">{t('ipOwnership')}</h4>
                  <p className="text-[10px] text-green-700 truncate">{t('flaggedSafeTerm')}</p>
                </div>
                <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider bg-green-100 text-green-800 px-2 py-0.5 rounded-full shrink-0">{t('safe')}</span>
              </div>
            </div>

            {/* Health Score Representation */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-1 text-xs">
                <span className="font-semibold text-gray-600">{t('healthScore')}</span>
                <span className="font-bold text-orange-600">68/100</span>
              </div>
              <div className="h-3 w-full bg-orange-100 rounded-full overflow-hidden p-0.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: '68%' }} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bento Grid Info Section */}
      <section id="bento" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-28 space-y-8 sm:space-y-16">
        <div className="text-center space-y-2 sm:space-y-3 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-ink">
            {t('ragBentoTitle')}
          </h2>
          <p className="text-xs sm:text-base text-gray-600">
            {t('ragBentoDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-8">
          {/* Card 1: Upload (col-span-8) */}
          <ClayCard className="md:col-span-8 flex flex-col justify-between p-5 sm:p-8 border-2 border-orange-100 bg-[#FFFDFB]">
            <div className="space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center clay-inner-ring shadow-[0_4px_12px_rgba(249,115,22,0.2)] shrink-0">
                <FileText size={20} className="sm:hidden" />
                <FileText size={24} className="hidden sm:block" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-brand-ink">{t('dynamicUpload')}</h3>
              <p className="text-xs sm:text-base text-gray-600 max-w-[55ch]">
                {t('dynamicUploadDesc')}
              </p>
            </div>
            <div className="mt-6 sm:mt-8 flex justify-center border-2 border-dashed border-orange-200 bg-brand-bg/50 rounded-2xl py-6 sm:py-10 px-4">
              <span className="text-xs sm:text-sm font-semibold text-orange-600">{t('dragHere')}</span>
            </div>
          </ClayCard>

          {/* Card 2: RAG Comparison (col-span-4) */}
          <ClayCard variant="medium" className="md:col-span-4 flex flex-col justify-between p-5 sm:p-8">
            <div className="space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-yellow-500 text-white flex items-center justify-center clay-inner-ring shadow-[0_4px_12px_rgba(234,179,8,0.2)] shrink-0">
                <Layers size={20} className="sm:hidden" />
                <Layers size={24} className="hidden sm:block" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-yellow-950">{t('ragBaselines')}</h3>
              <p className="text-yellow-800 text-xs sm:text-sm leading-relaxed">
                {t('ragBaselinesDesc')}
              </p>
            </div>
            <div className="mt-5 sm:mt-6 bg-white p-3.5 sm:p-4 rounded-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] border border-yellow-200">
              <span className="text-[10px] uppercase font-bold text-yellow-600 block mb-1">{t('standardTermMatch')}</span>
              <p className="text-xs font-semibold text-gray-700 italic">"Requires 24h landlord notice..."</p>
            </div>
          </ClayCard>

          {/* Card 3: Clause Risks (col-span-4) */}
          <ClayCard variant="high" className="md:col-span-4 flex flex-col justify-between p-5 sm:p-8">
            <div className="space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-red-500 text-white flex items-center justify-center clay-inner-ring shadow-[0_4px_12px_rgba(239,68,68,0.2)] shrink-0">
                <FileWarning size={20} className="sm:hidden" />
                <FileWarning size={24} className="hidden sm:block" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-red-950">{t('clauseFlags')}</h3>
              <p className="text-red-800 text-xs sm:text-sm leading-relaxed">
                {t('clauseFlagsDesc')}
              </p>
            </div>
            <div className="mt-5 sm:mt-6 flex space-x-2">
              <span className="px-3 py-1 bg-red-200 text-red-800 text-[10px] sm:text-xs font-bold rounded-full uppercase">{t('highRisk')}</span>
              <span className="px-3 py-1 bg-yellow-200 text-yellow-800 text-[10px] sm:text-xs font-bold rounded-full uppercase">{t('caution')}</span>
            </div>
          </ClayCard>

          {/* Card 4: Translation (col-span-8) */}
          <ClayCard className="md:col-span-8 flex flex-col justify-between p-5 sm:p-8 border-2 border-orange-100 bg-[#FFFDFB]">
            <div className="space-y-3 sm:space-y-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-green-500 text-white flex items-center justify-center clay-inner-ring shadow-[0_4px_12px_rgba(34,197,94,0.2)] shrink-0">
                <ShieldCheck size={20} className="sm:hidden" />
                <ShieldCheck size={24} className="hidden sm:block" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-brand-ink">{t('sideBySide')}</h3>
              <p className="text-xs sm:text-base text-gray-600 max-w-[55ch]">
                {t('sideBySideDesc')}
              </p>
            </div>
            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
              <div className="bg-gray-100 p-3.5 sm:p-4 rounded-xl border border-gray-200 font-mono text-gray-500 line-clamp-2">
                "TO THE FULLEST EXTENT..."
              </div>
              <div className="bg-orange-50 p-3.5 sm:p-4 rounded-xl border border-orange-100 font-medium text-orange-800 line-clamp-2">
                "You waive class actions..."
              </div>
            </div>
          </ClayCard>
        </div>
      </section>

      {/* Demo Documents Section (renders only if demo documents are provided by backend) */}
      {demoDocs.length > 0 && (
        <section id="demo" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-20 bg-orange-50/30 rounded-3xl sm:rounded-4xl border border-orange-100">
          <div className="text-center space-y-2 sm:space-y-4 mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-ink">{t('selectSample')}</h2>
            <p className="text-xs sm:text-base text-gray-600 max-w-xl mx-auto">
              {t('testRagDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 max-w-4xl mx-auto">
            {demoDocs.map((doc) => (
              <motion.div
                key={doc.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer"
                onClick={() => onStart(doc.id)}
              >
                <ClayCard className="h-full border-2 border-orange-100 hover:border-orange-300 flex flex-col justify-between p-4 sm:p-6 bg-white">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-start">
                      <span className={`text-[9px] sm:text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full ${
                        (doc.documentType || doc.type) === 'tos' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                      }`}>
                        {doc.documentType === 'tos' ? 'Terms of Service' : 'Rental Lease'}
                      </span>
                      <span className="text-[10px] sm:text-xs text-gray-400">{doc.uploadDate || doc.upload_date}</span>
                    </div>

                    <h3 className="text-base sm:text-xl font-bold text-gray-800">{doc.title || doc.filename}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed line-clamp-3">{doc.summary}</p>
                  </div>

                  <div className="pt-4 sm:pt-6 border-t border-orange-50 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 sm:space-x-2">
                      <span className="text-[11px] sm:text-xs font-bold text-gray-600">{t('healthLabel')}</span>
                      <span className={`text-xs sm:text-sm font-extrabold ${
                        (doc.healthScore || doc.health_score) > 60 ? 'text-green-600' : 'text-red-500'
                      }`}>{(doc.healthScore || doc.health_score)}/100</span>
                    </div>
                    <div className="text-orange-600 font-bold text-xs sm:text-sm flex items-center space-x-1 hover:text-orange-700">
                      <span>{t('tryAnalyzer')}</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                </ClayCard>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-28 text-center space-y-4 sm:space-y-6">
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-gray-800 leading-tight">
          {t('readyToSimplify')}
        </h2>
        <p className="text-xs sm:text-base text-gray-500 max-w-md mx-auto">
          {t('startIdentifying')}
        </p>
        <div className="pt-2 sm:pt-4">
          <ClayButton variant="primary" onClick={() => onStart()} className="w-full sm:w-auto min-h-11 justify-center">
            {t('analyzeAgreement')}
          </ClayButton>
        </div>
      </section>

      <footer className="border-t border-[#FFEDD5] py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 text-center text-xs text-gray-400">
        <p>{t('copyright')}</p>
      </footer>
    </div>
  );
};
