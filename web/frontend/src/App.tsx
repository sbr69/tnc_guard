import { useState, useEffect, lazy, Suspense } from 'react';
import { LandingPage } from './components/LandingPage';
import { AnalyzerWorkspace } from './components/AnalyzerWorkspace';
import { ShieldCheck, FileText, Sparkles, Home } from 'lucide-react';
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
            onClick={() => navigate('/')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isLanding 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            <Home size={14} />
            <span>{t('homeNav')}</span>
          </button>
          
          <button
            onClick={() => navigate('/review')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isReview 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            <FileText size={14} />
            <span>{t('documentWorkspaceNav')}</span>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isReports 
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
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-center"><Sparkles className="w-12 h-12 text-orange-500 animate-pulse mx-auto mb-4" /><h2 className="text-xl font-bold text-gray-800">Loading...</h2></div></div>}>
          <ReportsView onBackToHome={handleBackToHome} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
