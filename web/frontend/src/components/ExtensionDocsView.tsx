import React from 'react';
import {
  ArrowLeft, Download, ShieldCheck, Zap, MousePointerClick,
  CheckCircle, Lock, Eye,
  AlertTriangle, Monitor, PinIcon,
  Shield, FolderOpen, Package, ChevronDown,
  HelpCircle
} from 'lucide-react';
import { ClayButton } from './ClayButton';

interface ExtensionDocsViewProps {
  onBackToHome: () => void;
}

const StepNum = ({ n }: { n: number }) => (
  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-500 text-white text-xs sm:text-sm font-black flex items-center justify-center shrink-0 shadow-sm">
    {n}
  </span>
);

export const ExtensionDocsView: React.FC<ExtensionDocsViewProps> = ({ onBackToHome }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-14 space-y-12 sm:space-y-16 text-brand-ink">

      {/* ═══ TOP NAV / BACK HEADER ═══ */}
      <div className="flex items-center space-x-4 pb-6 border-b border-orange-200/70">
        <ClayButton
          variant="secondary"
          onClick={onBackToHome}
          className="p-2.5 sm:p-3! rounded-2xl shrink-0 min-h-10"
        >
          <ArrowLeft size={18} />
        </ClayButton>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] sm:text-[11px] font-extrabold text-orange-600 uppercase tracking-widest bg-orange-100/90 px-2 py-0.5 rounded-md">
              Documentation
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              • Browser Extension
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-brand-ink mt-1">
            Install &amp; Use Unmask-Terms
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Everything you need to install the browser extension and analyze websites in seconds.
          </p>
        </div>
      </div>

      {/* ═══ SECTION 1: OVERVIEW ═══ */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2.5 text-orange-600">
          <Shield size={20} />
          <h2 className="text-xl sm:text-2xl font-black text-brand-ink">What is Unmask-Terms?</h2>
        </div>
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed max-w-3xl">
          Unmask-Terms is a lightweight browser extension that scans the <strong>Privacy Policy</strong>, <strong>Terms of Service</strong>, <strong>Cookie Policy</strong>, and <strong>EULA</strong> of websites you browse. It automatically extracts clauses, calculates a <strong>Safety Score (0 to 10)</strong>, and highlights hidden risk factors like data selling, forced arbitration clauses, tracking traps, and vague retention periods.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-orange-50/70 border border-orange-200/60 space-y-1.5">
            <div className="flex items-center space-x-2 text-orange-600 font-bold text-xs sm:text-sm">
              <Zap size={16} />
              <span>One-Click</span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-600 leading-normal">
              Detects policy links instantly from footers, modals, or banners.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-orange-50/70 border border-orange-200/60 space-y-1.5">
            <div className="flex items-center space-x-2 text-orange-600 font-bold text-xs sm:text-sm">
              <ShieldCheck size={16} />
              <span>Safety Score</span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-600 leading-normal">
              0–10 score with immediate red, yellow, or green icon badges.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-orange-50/70 border border-orange-200/60 space-y-1.5">
            <div className="flex items-center space-x-2 text-orange-600 font-bold text-xs sm:text-sm">
              <AlertTriangle size={16} />
              <span>Risk Flags</span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-600 leading-normal">
              Highlights predatory clauses and legal traps in plain language.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-orange-50/70 border border-orange-200/60 space-y-1.5">
            <div className="flex items-center space-x-2 text-orange-600 font-bold text-xs sm:text-sm">
              <Lock size={16} />
              <span>100% Private</span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-600 leading-normal">
              Zero passive tracking or background CPU drain until requested.
            </p>
          </div>
        </div>

        {/* Supported Browsers bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-semibold text-gray-500">
          <span className="text-gray-400">Supported browsers:</span>
          <span className="px-2.5 py-1 bg-white/80 border border-orange-200/70 rounded-full flex items-center space-x-1">
            <Monitor size={12} /><span>Chrome</span>
          </span>
          <span className="px-2.5 py-1 bg-white/80 border border-orange-200/70 rounded-full flex items-center space-x-1">
            <Monitor size={12} /><span>Brave</span>
          </span>
          <span className="px-2.5 py-1 bg-white/80 border border-orange-200/70 rounded-full flex items-center space-x-1">
            <Monitor size={12} /><span>Edge</span>
          </span>
        </div>
      </section>

      {/* ═══ SECTION 2: STEP-BY-STEP INSTALLATION ═══ */}
      <section className="space-y-6 pt-2">
        <div className="space-y-1 border-b border-orange-100 pb-3">
          <div className="flex items-center space-x-2.5 text-orange-600">
            <Download size={20} />
            <h2 className="text-xl sm:text-2xl font-black text-brand-ink">Installation Guide</h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            Follow these simple steps to install the extension directly in your browser.
          </p>
        </div>

        <div className="space-y-8 pl-1">
          {/* Step 1 */}
          <div className="flex items-start space-x-4">
            <StepNum n={1} />
            <div className="space-y-2 flex-1">
              <h3 className="font-bold text-base text-brand-ink">Download the extension package</h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-2xl">
                Download the latest version of the extension as a <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-orange-200 text-orange-700 text-xs">.zip</code> file to your computer.
              </p>
              <div>
                <a
                  href="/unmask-terms-extension.zip"
                  download
                  className="clay-btn clay-btn-primary px-5 py-2.5 text-xs sm:text-sm tracking-wide gap-2 no-underline inline-flex items-center"
                >
                  <Download size={16} />
                  <span>Download Extension (.zip)</span>
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start space-x-4">
            <StepNum n={2} />
            <div className="space-y-2 flex-1">
              <h3 className="font-bold text-base text-brand-ink">Extract the downloaded file</h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-2xl">
                Right-click the downloaded <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-orange-200 text-orange-700 text-xs">.zip</code> file and select <strong>"Extract All"</strong> (Windows) or double-click it (Mac).
              </p>
              <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-orange-50/60 border border-orange-200/50 max-w-2xl">
                <FolderOpen size={16} className="text-orange-600 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-700 leading-relaxed">
                  Make sure you know where the extracted folder is saved. It contains files like <code className="font-mono text-orange-800 bg-white/90 px-1 py-0.5 rounded border border-orange-200 text-[11px]">manifest.json</code> and icon folders.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start space-x-4">
            <StepNum n={3} />
            <div className="space-y-2 flex-1">
              <h3 className="font-bold text-base text-brand-ink">Open the browser Extensions page</h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-2xl">
                Copy and paste the URL corresponding to your browser into the address bar, then press <strong>Enter</strong>:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl">
                <div className="bg-brand-ink text-orange-200 p-2.5 rounded-xl font-mono text-xs flex items-center space-x-2">
                  <span className="text-orange-400 font-bold">Chrome:</span>
                  <span>chrome://extensions</span>
                </div>
                <div className="bg-brand-ink text-orange-200 p-2.5 rounded-xl font-mono text-xs flex items-center space-x-2">
                  <span className="text-orange-400 font-bold">Brave:</span>
                  <span>brave://extensions</span>
                </div>
                <div className="bg-brand-ink text-orange-200 p-2.5 rounded-xl font-mono text-xs flex items-center space-x-2">
                  <span className="text-orange-400 font-bold">Edge:</span>
                  <span>edge://extensions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start space-x-4">
            <StepNum n={4} />
            <div className="space-y-2 flex-1">
              <h3 className="font-bold text-base text-brand-ink">Enable Developer Mode</h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-2xl">
                In the top right corner of the Extensions manager page, toggle the <strong>Developer mode</strong> switch to <strong>ON</strong>.
              </p>
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <CheckCircle size={14} className="text-green-600 shrink-0" />
                <span>This reveals the <strong>"Load unpacked"</strong> button in your browser toolbar.</span>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex items-start space-x-4">
            <StepNum n={5} />
            <div className="space-y-2 flex-1">
              <h3 className="font-bold text-base text-brand-ink">Load the extracted extension folder</h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-2xl">
                Click <strong>"Load unpacked"</strong> at the top left, navigate to the folder you extracted in Step 2 (containing <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-orange-200 text-orange-700 text-xs">manifest.json</code>), and click <strong>Select Folder</strong>.
              </p>
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs font-semibold">
                <CheckCircle size={14} className="text-green-600 shrink-0" />
                <span>The Unmask-Terms icon will now appear in your browser extensions list!</span>
              </div>
            </div>
          </div>

          {/* Pin Extension Note */}
          <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-200/60 max-w-2xl space-y-2">
            <div className="flex items-center space-x-2 font-bold text-sm text-brand-ink">
              <PinIcon size={16} className="text-orange-600" />
              <span>Pin to toolbar for instant access</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Click the puzzle icon (<Package size={13} className="inline mx-0.5 text-gray-500" />) in your browser toolbar, find <strong>Unmask-Terms</strong>, and click the pin icon so it stays always visible next to the address bar.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3: HOW TO USE ═══ */}
      <section className="space-y-6 pt-2">
        <div className="space-y-1 border-b border-orange-100 pb-3">
          <div className="flex items-center space-x-2.5 text-orange-600">
            <Eye size={20} />
            <h2 className="text-xl sm:text-2xl font-black text-brand-ink">How to Use the Extension</h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            How analysis works in everyday browsing.
          </p>
        </div>

        <div className="space-y-6 pl-1">
          {/* Usage Step 1 */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-sm sm:text-base font-bold text-brand-ink">
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-black flex items-center justify-center">1</span>
              <span>Open any website</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed pl-7 max-w-2xl">
              Visit the site you want to inspect (e.g., e-commerce, cloud platform, subscription service). The extension remains dormant until opened.
            </p>
          </div>

          {/* Usage Step 2 */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-sm sm:text-base font-bold text-brand-ink">
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-black flex items-center justify-center">2</span>
              <span>Click the Unmask-Terms icon</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed pl-7 max-w-2xl">
              Click the toolbar icon. The popup opens with the current domain name. If the site was analyzed previously, cached results appear in less than 50ms. Otherwise, you will see the <strong>"Analyse this site"</strong> button.
            </p>
          </div>

          {/* Usage Step 3 */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-sm sm:text-base font-bold text-brand-ink">
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-black flex items-center justify-center">3</span>
              <span>Trigger analysis &amp; review scores</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed pl-7 max-w-2xl">
              Click <strong>"Analyse this site"</strong>. The content script locates Privacy, ToS, Cookie, and EULA policies across the page. Once complete, you will see:
            </p>
            <div className="pl-7 pt-1 space-y-1 text-xs sm:text-sm text-gray-700">
              <div className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-orange-500 shrink-0" />
                <span><strong>Overall Safety Score (0–10)</strong> computed via deterministic rubric.</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-orange-500 shrink-0" />
                <span><strong>Key Risk Flags</strong> (e.g. data selling, dispute arbitration, auto-billing traps).</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle size={14} className="text-orange-500 shrink-0" />
                <span><strong>Found Policy Badges</strong> indicating which legal documents were evaluated.</span>
              </div>
            </div>
          </div>

          {/* Usage Step 4 */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-sm sm:text-base font-bold text-brand-ink">
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-black flex items-center justify-center">4</span>
              <span>Open detailed breakdown</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed pl-7 max-w-2xl">
              Click <strong>"Check Summary"</strong> at the bottom of the extension popup to view clause-by-clause comparisons, plain-English summaries, and full baseline metrics right in the Unmask-Terms web app.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4: CONTEXT MENU & ICON BADGES ═══ */}
      <section className="space-y-6 pt-2">
        <div className="space-y-1 border-b border-orange-100 pb-3">
          <div className="flex items-center space-x-2.5 text-orange-600">
            <MousePointerClick size={20} />
            <h2 className="text-xl sm:text-2xl font-black text-brand-ink">Features &amp; Pro Tips</h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            Handy tools built into the extension.
          </p>
        </div>

        <div className="space-y-6">
          {/* Right click tip */}
          <div className="p-4 sm:p-5 rounded-2xl bg-orange-50/60 border border-orange-200/60 space-y-2">
            <h4 className="font-bold text-sm sm:text-base text-brand-ink flex items-center space-x-2">
              <MousePointerClick size={16} className="text-orange-600" />
              <span>Right-Click Any Link to Analyze</span>
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              If a website hides its agreement behind a specific login banner or modal link, simply <strong>right-click that link</strong> and choose <strong>"Analyse this policy with Unmask-Terms"</strong>. The extension immediately classifies and analyzes that target document.
            </p>
          </div>

          {/* Badge colors */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm sm:text-base text-brand-ink">Toolbar Icon Badge Colors</h4>
            <p className="text-xs sm:text-sm text-gray-600">
              The extension icon displays a live badge indicating the safety rating of the current active site:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-center space-y-1">
                <div className="w-7 h-7 rounded-lg bg-gray-400 text-white text-[11px] font-black flex items-center justify-center mx-auto">...</div>
                <p className="text-xs font-bold text-gray-700">Analysing</p>
                <p className="text-[10px] text-gray-500">Scan in progress</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-center space-y-1">
                <div className="w-7 h-7 rounded-lg bg-green-700 text-white text-[11px] font-black flex items-center justify-center mx-auto">8.5</div>
                <p className="text-xs font-bold text-green-800">Safe</p>
                <p className="text-[10px] text-green-600">Score ≥ 7.5</p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-center space-y-1">
                <div className="w-7 h-7 rounded-lg bg-yellow-600 text-white text-[11px] font-black flex items-center justify-center mx-auto">6.2</div>
                <p className="text-xs font-bold text-yellow-800">Caution</p>
                <p className="text-[10px] text-yellow-600">Score 5.0–7.4</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center space-y-1">
                <div className="w-7 h-7 rounded-lg bg-red-700 text-white text-[11px] font-black flex items-center justify-center mx-auto">3.1</div>
                <p className="text-xs font-bold text-red-800">Risky</p>
                <p className="text-[10px] text-red-600">Score &lt; 5.0</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 5: TROUBLESHOOTING ═══ */}
      <section className="space-y-4 pt-2">
        <div className="space-y-1 border-b border-orange-100 pb-3">
          <div className="flex items-center space-x-2.5 text-orange-600">
            <HelpCircle size={20} />
            <h2 className="text-xl sm:text-2xl font-black text-brand-ink">Frequently Asked Questions</h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            Quick solutions to common questions.
          </p>
        </div>

        <div className="space-y-3 max-w-3xl">
          <details className="group border border-orange-200/70 rounded-xl overflow-hidden bg-white/70">
            <summary className="flex items-center justify-between p-3.5 bg-orange-50/40 cursor-pointer select-none hover:bg-orange-50/80 transition-colors">
              <span className="text-xs sm:text-sm font-bold text-brand-ink">"Cannot analyze this page type" error?</span>
              <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-3.5 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-orange-100">
              The extension can only inspect regular web pages starting with <strong>http://</strong> or <strong>https://</strong>. Browser internal pages like <code className="font-mono bg-orange-50 px-1 py-0.5 rounded text-xs">chrome://</code>, blank tabs, and extension store pages cannot be analyzed.
            </div>
          </details>

          <details className="group border border-orange-200/70 rounded-xl overflow-hidden bg-white/70">
            <summary className="flex items-center justify-between p-3.5 bg-orange-50/40 cursor-pointer select-none hover:bg-orange-50/80 transition-colors">
              <span className="text-xs sm:text-sm font-bold text-brand-ink">Why does the first analysis take 15–30 seconds?</span>
              <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-3.5 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-orange-100">
              During a brand new scan, the pipeline downloads legal documents, splits them into individual clauses, tests against RAG baselines, runs LLM reasoning, and validates quotes to avoid hallucinations. Once completed, results are cached both in your browser (7 days) and at the edge (30 days) for instant subsequent loads.
            </div>
          </details>

          <details className="group border border-orange-200/70 rounded-xl overflow-hidden bg-white/70">
            <summary className="flex items-center justify-between p-3.5 bg-orange-50/40 cursor-pointer select-none hover:bg-orange-50/80 transition-colors">
              <span className="text-xs sm:text-sm font-bold text-brand-ink">How do I update the extension later?</span>
              <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-3.5 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-orange-100">
              Download the new <code className="font-mono bg-orange-50 px-1 py-0.5 rounded text-xs">.zip</code>, extract it into the same folder, and click the refresh icon (↻) on the Unmask-Terms card on your browser's <code className="font-mono bg-orange-50 px-1 py-0.5 rounded text-xs">chrome://extensions</code> page.
            </div>
          </details>
        </div>
      </section>

      {/* ═══ BOTTOM RETURN BUTTON ═══ */}
      <div className="pt-4 border-t border-orange-200/70 flex items-center justify-between">
        <ClayButton
          variant="secondary"
          onClick={onBackToHome}
          icon={<ArrowLeft size={16} />}
          className="text-xs px-4 py-2 min-h-10"
        >
          Back to Home
        </ClayButton>

        <a
          href="/unmask-terms-extension.zip"
          download
          className="clay-btn clay-btn-primary px-4 py-2 text-xs font-bold tracking-wide gap-1.5 no-underline inline-flex items-center"
        >
          <Download size={14} />
          <span>Download .zip</span>
        </a>
      </div>

    </div>
  );
};
