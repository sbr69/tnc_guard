import { useState, useEffect, lazy, Suspense } from 'react';
import { LandingPage } from './components/LandingPage';
import { AnalyzerWorkspace } from './components/AnalyzerWorkspace';
import { Sparkles } from 'lucide-react';
import { ClayButton } from './components/ClayButton';
import { ClayCursor } from './components/ClayCursor';
import { t } from './i18n';

const ReportsView = lazy(() => import('./components/ReportsView').then(m => ({ default: m.ReportsView })));
const ExtensionDocsView = lazy(() => import('./components/ExtensionDocsView').then(m => ({ default: m.ExtensionDocsView })));

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
  const isExtension = pathname.startsWith('/extension') || pathname === 'extension';
  const isReports = pathname.startsWith('/reports');
  const isReview = pathname.startsWith('/review');
  const isLanding = !isExtension && !isReports && !isReview;

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


        <div className="flex items-center">
          <ClayButton 
            variant="primary" 
            className="px-3! py-1.5! text-xs"
            onClick={() => navigate('/extension')}
          >
            {t('extensionDocs')}
          </ClayButton>
        </div>
      </header>

      {/* Main Page Rendering */}
      {isLanding ? (
        <LandingPage onStart={handleStartAnalyzer} />
      ) : isExtension ? (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-center"><Sparkles className="w-12 h-12 text-orange-500 animate-pulse mx-auto mb-4" /><h2 className="text-xl font-bold text-gray-800">{t('loading')}</h2></div></div>}>
          <ExtensionDocsView onBackToHome={handleBackToHome} />
        </Suspense>
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

      {/* Claymorphism Dynamic Custom Cursor */}
      <ClayCursor />
    </div>
  );
}

export default App;
