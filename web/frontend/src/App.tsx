import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { AnalyzerWorkspace } from './components/AnalyzerWorkspace';
import { ReportsView } from './components/ReportsView';
import { ShieldCheck, FileText, Sparkles, Home } from 'lucide-react';
import { ClayButton } from './components/ClayButton';
import { t } from './i18n';

function App() {
  const [view, setView] = useState<'landing' | 'analyzer' | 'reports'>('landing');
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Listen for /reports URL path or query parameter
    if (window.location.pathname.includes('/reports') || window.location.search.includes('view=reports')) {
      setView('reports');
    }
  }, []);

  const handleStartAnalyzer = (docId?: string) => {
    setSelectedDocId(docId);
    setView('analyzer');
  };

  const handleBackToHome = () => {
    setSelectedDocId(undefined);
    setView('landing');
  };

  return (
    <div className="bg-brand-bg min-h-screen">
      {/* Global Top Switcher Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-orange-100 sticky top-0 z-40 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={handleBackToHome}>
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white clay-inner-ring">
            <ShieldCheck size={20} />
          </div>
          <span className="font-extrabold text-lg text-brand-ink">
            {t('clarify')}<span className="text-orange-500">{t('law')}</span>
          </span>
        </div>

        {/* Global Page Switcher */}
        <div className="flex items-center space-x-2 bg-orange-50/70 p-1.5 rounded-2xl border border-orange-100">
          <button
            onClick={() => setView('landing')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              view === 'landing' 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            <Home size={14} />
            <span>{t('homeNav')}</span>
          </button>
          
          <button
            onClick={() => setView('analyzer')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              view === 'analyzer' 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            <FileText size={14} />
            <span>{t('documentWorkspaceNav')}</span>
          </button>

          <button
            onClick={() => setView('reports')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              view === 'reports' 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            <Sparkles size={14} />
            <span>{t('extensionReportsNav')}</span>
          </button>
        </div>

        <div className="hidden sm:block">
          <ClayButton 
            variant="primary" 
            className="px-3! py-1.5! text-xs"
            onClick={() => setView('reports')}
          >
            {t('checkExtensionDemoNav')}
          </ClayButton>
        </div>
      </header>

      {/* Main Page Rendering */}
      {view === 'landing' ? (
        <LandingPage onStart={handleStartAnalyzer} />
      ) : view === 'analyzer' ? (
        <AnalyzerWorkspace 
          initialDocId={selectedDocId} 
          onBackToHome={handleBackToHome} 
        />
      ) : (
        <ReportsView onBackToHome={handleBackToHome} />
      )}
    </div>
  );
}

export default App;
