import { useState, useEffect, lazy, Suspense } from 'react';
import { LandingPage } from './components/LandingPage';
import { AnalyzerWorkspace } from './components/AnalyzerWorkspace';
import { FileText, Sparkles, Home } from 'lucide-react';
import { ClayButton } from './components/ClayButton';
import { t } from './i18n';

const ReportsView = lazy(() => import('./components/ReportsView').then(m => ({ default: m.ReportsView })));

function App() {
  const [pathname, setPathname] = useState<string>(window.location.pathname);
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    const params = new URLSearchParams(window.location.search);
    const docIdParam = params.get('docId');
    if (docIdParam) {
      setSelectedDocId(docIdParam);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string, docId?: string) => {
    let targetPath = path;
    if (docId) {
      targetPath = `${path}?docId=${docId}`;
      setSelectedDocId(docId);
    } else if (path !== '/review') {
      setSelectedDocId(undefined);
    }
    window.history.pushState({}, '', targetPath);
    setPathname(path);
  };

  const handleStartAnalyzer = (docId?: string) => {
    navigate('/review', docId);
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  // Determine current active view based on exact path prefix
  const isReports = pathname.startsWith('/reports');
  const isReview = pathname.startsWith('/review');
  const isLanding = !isReports && !isReview;

  return (
    <div className="bg-brand-bg min-h-screen">
      {/* Global Top Switcher Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-orange-100 sticky top-0 z-40 px-3 sm:px-6 py-2.5 sm:py-0 min-h-14 sm:h-16 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 shrink-0 cursor-pointer" onClick={handleBackToHome}>
          <img src="/TnC_favicon.png" alt="Logo" className="w-8 h-8 object-contain shrink-0" />
          <span className="font-extrabold text-base sm:text-lg text-brand-ink">
            {t('clarify')}<span className="text-orange-500">{t('law')}</span>
          </span>
        </div>

        {/* Global Page Switcher */}
        <div className="flex items-center space-x-1 sm:space-x-2 bg-orange-50/70 p-1 sm:p-1.5 rounded-2xl border border-orange-100">
          <button
            onClick={() => navigate('/')}
            className={`flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-9 ${
              isLanding 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            <Home size={14} className="shrink-0" />
            <span className="hidden sm:inline">{t('homeNav')}</span>
          </button>
          
          <button
            onClick={() => navigate('/review')}
            className={`flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-9 ${
              isReview 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            <FileText size={14} className="shrink-0" />
            <span>{t('workspace')}</span>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className={`flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-9 ${
              isReports 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            <Sparkles size={14} className="shrink-0" />
            <span>{t('reports')}</span>
          </button>
        </div>

        <div className="hidden md:block">
          <ClayButton 
            variant="primary" 
            className="px-3! py-1.5! text-xs"
            onClick={() => navigate('/reports')}
          >
            {t('checkExtensionDemoNav')}
          </ClayButton>
        </div>
      </header>

      {/* Main Page Rendering */}
      {isLanding ? (
        <LandingPage onStart={handleStartAnalyzer} />
      ) : isReview ? (
        <AnalyzerWorkspace 
          initialDocId={selectedDocId} 
          onBackToHome={handleBackToHome} 
        />
      ) : (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-center"><Sparkles className="w-12 h-12 text-orange-500 animate-pulse mx-auto mb-4" /><h2 className="text-xl font-bold text-gray-800">{t('loading')}</h2></div></div>}>
          <ReportsView onBackToHome={handleBackToHome} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
