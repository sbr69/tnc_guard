import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, FileWarning, CheckCircle, 
  Filter, Globe, Sparkles
} from 'lucide-react';
import { ClayCard } from './ClayCard';
import { ClayButton } from './ClayButton';
import { t } from '../i18n';

export type PolicyType = 'privacy' | 'tos' | 'cookie' | 'eula';

export interface ExtensionReportClause {
  id: string;
  title: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  originalText: string;
  simplifiedText: string;
  explanation: string;
  ragComparison: string;
}

export interface ExtensionPolicyData {
  type: PolicyType;
  title: string;
  score: number; // 0.0 - 10.0 scale
  riskFlags: string[];
  clauses: ExtensionReportClause[];
}

export interface ExtensionSiteData {
  domain: string;
  siteName: string;
  overallScore: number;
  scanDate: string;
  policies: Record<PolicyType, ExtensionPolicyData>;
}

// Sample extension fetched reports database
export const mockExtensionReports: Record<string, ExtensionSiteData> = {
  'acme-cloud.com': {
    domain: 'acme-cloud.com',
    siteName: 'Acme Cloud Platform',
    overallScore: 6.2,
    scanDate: 'Aug 5, 2026',
    policies: {
      privacy: {
        type: 'privacy',
        title: 'Privacy Policy',
        score: 7.8,
        riskFlags: ['Third-Party Data Sharing', 'Vague Retention Periods'],
        clauses: [
          {
            id: 'priv-1',
            title: 'Third-Party Analytics & Data Sharing',
            category: 'Data Sharing',
            riskLevel: 'medium',
            originalText: 'We may share aggregated or de-identified information with selected business partners, advertising networks, and third-party vendors for market analysis and behavioral targeting.',
            simplifiedText: 'Acme shares anonymized user browsing activity with advertisers and partner networks.',
            explanation: 'While "de-identified" sounds safe, re-identification attacks can often tie aggregated data back to individual users.',
            ragComparison: 'Standard privacy baselines require clear opt-out toggles and strict prohibition of behavioral advertising sharing.'
          },
          {
            id: 'priv-2',
            title: 'Indefinite Telemetry Retention',
            category: 'Data Retention',
            riskLevel: 'medium',
            originalText: 'Diagnostic data, telemetry logs, and IP history may be retained indefinitely in cold storage archives for system auditing and compliance.',
            simplifiedText: 'Acme keeps your IP logs and diagnostic data forever.',
            explanation: 'Indefinite retention creates security exposure if backup databases are leaked in a data breach.',
            ragComparison: 'GDPR and CCPA best practices require hard deletion windows (e.g. 90-180 days) for server diagnostic logs.'
          },
          {
            id: 'priv-3',
            title: 'Right to Access & Data Deletion',
            category: 'User Rights',
            riskLevel: 'low',
            originalText: 'Users may submit a data export request or initiate full account deletion directly within the Account Settings portal.',
            simplifiedText: 'You can download your data or delete your account at any time.',
            explanation: 'Customer-friendly data portability clause that complies with global privacy standards.',
            ragComparison: 'Matches GDPR Article 17 right to erasure requirements.'
          }
        ]
      },
      tos: {
        type: 'tos',
        title: 'Terms & Conditions',
        score: 4.5,
        riskFlags: ['Forced Arbitration', 'Class Action Waiver', 'Auto-Renewal Traps'],
        clauses: [
          {
            id: 'tos-1',
            title: 'Class Action Lawsuit Waiver',
            category: 'Dispute Resolution',
            riskLevel: 'high',
            originalText: 'YOU EXPRESSLY WAIVE YOUR RIGHT TO PARTICIPATE IN ANY CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION AGAINST ACME OR ITS AFFILIATES.',
            simplifiedText: 'You give up the right to join other users in a group lawsuit if Acme commits fraud or breaches contract.',
            explanation: 'Forces users to handle disputes individually, drastically raising legal costs for small claims.',
            ragComparison: 'Standard consumer terms provide an opt-out window via email within 30 days of registration.'
          },
          {
            id: 'tos-2',
            title: '30-Day Mandatory Cancellation Lead Time',
            category: 'Auto-Renewal',
            riskLevel: 'high',
            originalText: 'SUBSCRIPTIONS RENEW AUTOMATICALLY UNLESS CANCELED AT LEAST THIRTY (30) DAYS PRIOR TO THE RENEWAL DATE. NO REFUNDS ARE ISSUED FOR LATE CANCELLATIONS.',
            simplifiedText: 'You must cancel your subscription 30 days before renewal, or you will be charged for the full next period.',
            explanation: 'Excessively strict cancellation windows trap users into unintended annual or monthly fees.',
            ragComparison: 'Fair SaaS standards allow instant self-serve cancellation anytime up until 1 day before the billing cycle.'
          }
        ]
      },
      cookie: {
        type: 'cookie',
        title: 'Cookie Policy',
        score: 9.0,
        riskFlags: ['Essential & Preference Cookies'],
        clauses: [
          {
            id: 'cook-1',
            title: 'Cookie Categorization & Consent Preference Manager',
            category: 'Tracking Technologies',
            riskLevel: 'low',
            originalText: 'Non-essential performance and marketing cookies are disabled by default until explicit affirmative consent is provided via our Preference Center.',
            simplifiedText: 'Marketing cookies are turned off until you explicitly turn them on.',
            explanation: 'Respects privacy-by-default standards.',
            ragComparison: 'Exemplary consent banner practice complying with ePrivacy Directive.'
          }
        ]
      },
      eula: {
        type: 'eula',
        title: 'EULA (End-User License)',
        score: 7.2,
        riskFlags: ['Reverse-Engineering Prohibition'],
        clauses: [
          {
            id: 'eula-1',
            title: 'Decompilation & Reverse Engineering Prohibition',
            category: 'License Restrictions',
            riskLevel: 'low',
            originalText: 'Licensee shall not modify, reverse engineer, decompile, or disassemble the client application binaries except as permitted by applicable statute.',
            simplifiedText: 'You cannot hack, decompile, or reverse engineer the software code.',
            explanation: 'Standard software protection clause.',
            ragComparison: 'Standard boilerplate software licensing term.'
          }
        ]
      }
    }
  },
  'social-connect.io': {
    domain: 'social-connect.io',
    siteName: 'SocialConnect Network',
    overallScore: 3.8,
    scanDate: 'Aug 5, 2026',
    policies: {
      privacy: {
        type: 'privacy',
        title: 'Privacy Policy',
        score: 3.2,
        riskFlags: ['Data Selling to Data Brokers', 'No Deletion Rights', 'Location Tracking'],
        clauses: [
          {
            id: 'sc-p1',
            title: 'Commercial Monetization of User Profiles',
            category: 'Data Selling',
            riskLevel: 'high',
            originalText: 'We may monetize, license, or sell user demographic data, interest profiles, and device identifiers to third-party data brokers and marketing aggregators.',
            simplifiedText: 'SocialConnect explicitly sells your personal data, habits, and profile information to data brokers.',
            explanation: 'High-risk gotcha! Your personal information is sold for profit.',
            ragComparison: 'Reputable platforms strictly prohibit selling user personal information.'
          }
        ]
      },
      tos: {
        type: 'tos',
        title: 'Terms & Conditions',
        score: 4.0,
        riskFlags: ['Perpetual IP License', 'Unilateral Contract Changes'],
        clauses: [
          {
            id: 'sc-t1',
            title: 'Perpetual Royalty-Free Media License',
            category: 'Intellectual Property',
            riskLevel: 'high',
            originalText: 'You grant us a perpetual, irrevocable, worldwide, sublicensable, royalty-free license to use, reproduce, modify, and distribute any photos or videos you upload.',
            simplifiedText: 'SocialConnect gets a permanent right to use your photos and videos anywhere for free, even after you delete your account.',
            explanation: 'Extremely broad license that strips your control over your created content.',
            ragComparison: 'Fair terms state that content licenses terminate automatically when you delete your content or account.'
          }
        ]
      },
      cookie: {
        type: 'cookie',
        title: 'Cookie Policy',
        score: 4.2,
        riskFlags: ['Cross-Site Fingerprinting'],
        clauses: [
          {
            id: 'sc-c1',
            title: 'Canvas Fingerprinting & Supercookies',
            category: 'Persistent Tracking',
            riskLevel: 'high',
            originalText: 'We utilize persistent browser fingerprinting scripts and canvas telemetry to identify device signatures across unaffiliated third-party websites.',
            simplifiedText: 'They track you across other websites using hardware fingerprinting that cannot be cleared by deleting cookies.',
            explanation: 'Bypasses standard browser privacy controls.',
            ragComparison: 'Aggressive fingerprinting violates privacy-focused web standards.'
          }
        ]
      },
      eula: {
        type: 'eula',
        title: 'EULA',
        score: 5.0,
        riskFlags: ['Background Resource Usage'],
        clauses: [
          {
            id: 'sc-e1',
            title: 'Background Network Relaying',
            category: 'Device Resources',
            riskLevel: 'medium',
            originalText: 'The desktop agent may utilize idle CPU and bandwidth to facilitate peer-to-peer network routing for other active network peers.',
            simplifiedText: 'The app uses your computer’s Internet connection and processor to route other users’ data in the background.',
            explanation: 'Consumes your battery and network bandwidth without compensation.',
            ragComparison: 'Apps should only use local system resources for the user’s direct operations.'
          }
        ]
      }
    }
  }
};

interface ReportsViewProps {
  onBackToHome?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = () => {
  const [selectedDomain, setSelectedDomain] = useState<string>('acme-cloud.com');
  const [activeTab, setActiveTab] = useState<PolicyType>('privacy');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [customInputUrl, setCustomInputUrl] = useState<string>('');
  
  const [liveData, setLiveData] = useState<ExtensionSiteData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const domainParam = params.get('domain');
    const sourceParam = params.get('source');
    
    if (sourceParam === 'extension' && domainParam) {
      setSelectedDomain(domainParam);
      fetchLiveReport(domainParam);
    }
  }, []);

  const fetchLiveReport = async (domain: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch summary from Cloudflare Worker
      const workerUrl = `http://127.0.0.1:8787/api/analyze?domain=${encodeURIComponent(domain)}`;
      const res = await fetch(workerUrl);
      if (!res.ok) throw new Error('Failed to load extension report.');
      
      const reportData = await res.json();
      
      // 2. Hydrate clauses by fetching documents from backend
      const hydratedPolicies: Record<PolicyType, ExtensionPolicyData> = {} as any;
      
      for (const [ptype, summary] of Object.entries(reportData.policies)) {
        if (!summary) continue;
        const p = summary as any;
        
        let clauses: ExtensionReportClause[] = [];
        if (p.document_id) {
          try {
            const docRes = await fetch(`http://127.0.0.1:8001/api/documents/${p.document_id}`);
            if (docRes.ok) {
              const docData = await docRes.json();
              clauses = docData.clauses.map((c: any) => ({
                id: c.id,
                title: c.title,
                category: c.category,
                riskLevel: c.risk_level === 'RISKY' ? 'high' : c.risk_level === 'CAUTIONARY' ? 'medium' : 'low',
                originalText: c.original_text,
                simplifiedText: c.simplified_text || 'No simplified text available.',
                explanation: c.explanation || '',
                ragComparison: c.recommendation || 'Standard clause.'
              }));
            }
          } catch (err) {
            console.error('Failed to fetch doc', p.document_id, err);
          }
        }
        
        Object.defineProperty(hydratedPolicies, ptype, {
          value: {
            type: ptype as PolicyType,
            title: p.title,
            score: p.score,
            riskFlags: p.risk_flags,
            clauses
          },
          enumerable: true,
          writable: true,
          configurable: true
        });
      }
      
      setLiveData({
        domain: reportData.domain,
        siteName: reportData.site_name,
        overallScore: reportData.overall_score,
        scanDate: reportData.scan_date,
        policies: hydratedPolicies
      });
      
      // Select first available policy as active tab
      const availableTabs = Object.keys(hydratedPolicies) as PolicyType[];
      if (availableTabs.length > 0) {
        setActiveTab(availableTabs[0]);
      }
      
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Merge mock data with any fetched live data
  const currentSiteMap = new Map<string, ExtensionSiteData>(Object.entries(mockExtensionReports));
  if (liveData) {
    currentSiteMap.set(liveData.domain, liveData);
  }
  
  const currentSite = currentSiteMap.get(selectedDomain) ?? mockExtensionReports['acme-cloud.com'];
  
  const policyMap = new Map<PolicyType, ExtensionPolicyData>(Object.entries(currentSite.policies) as [PolicyType, ExtensionPolicyData][]);
  const currentPolicy = policyMap.get(activeTab) ?? currentSite.policies.privacy;

  const getScoreBadgeColor = (score: number) => {
    if (score >= 7.5) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 5.0) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getRiskIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high': return <FileWarning size={16} className="text-red-600" />;
      case 'medium': return <AlertTriangle size={16} className="text-yellow-600" />;
      case 'low': return <CheckCircle size={16} className="text-green-600" />;
    }
  };

  const filteredClauses = currentPolicy.clauses.filter(c => {
    if (filterLevel === 'all') return true;
    return c.riskLevel === filterLevel;
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-orange-500 animate-pulse mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800">{t('Loading Report...')}</h2>
          <p className="text-gray-500 mt-2">{t('Fetching analyzed clauses.')}</p>
        </div>
      </div>
    );
  }

  if (errorMsg && !liveData) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md bg-red-50 p-6 rounded-2xl border border-red-200">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800">{t('Error Loading Report')}</h2>
          <p className="text-red-600 mt-2">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 min-h-screen">
      {/* Extension Banner Indicator */}
      <div className="mb-6 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-3xl p-6 shadow-[0_10px_20px_-5px_rgba(249,115,22,0.3)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
            <Sparkles size={24} className="text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-extrabold tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                {t('browserExtensionBridge')}
              </span>
              <span className="text-xs opacity-80">{currentSite.scanDate}</span>
            </div>
            <h2 className="text-xl font-bold mt-1">
              {t('legalSummaryReportFor')} <span className="underline decoration-white/40">{currentSite.siteName}</span>
            </h2>
          </div>
        </div>

        {/* Site Selector Dropdown */}
        <div className="flex items-center space-x-3 bg-white/10 p-2 rounded-2xl backdrop-blur-sm border border-white/20">
          <Globe size={16} className="text-white/80 ml-2" />
          <select 
            value={selectedDomain}
            onChange={(e) => {
              setSelectedDomain(e.target.value);
              if (e.target.value !== 'acme-cloud.com' && e.target.value !== 'social-connect.io') {
                fetchLiveReport(e.target.value);
              }
            }}
            className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer pr-4"
          >
            <option value="acme-cloud.com" className="text-gray-800">{t('acmeOption')}</option>
            <option value="social-connect.io" className="text-gray-800">{t('socialOption')}</option>
            {liveData && liveData.domain !== 'acme-cloud.com' && liveData.domain !== 'social-connect.io' && (
              <option value={liveData.domain} className="text-gray-800">{liveData.siteName}</option>
            )}
          </select>
        </div>
      </div>

      {/* Domain Score Header Card */}
      <ClayCard className="p-6 mb-8 border-2 border-orange-100 bg-[#FFFDFB] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-5">
          <div className="relative flex items-center justify-center">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center font-extrabold text-2xl border-2 ${getScoreBadgeColor(currentSite.overallScore)} shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)]`}>
              {currentSite.overallScore}<span className="text-xs font-normal opacity-70">/10</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('overallSiteSafetyRating')}</span>
            <h3 className="text-2xl font-black text-gray-800">{currentSite.domain}</h3>
            <p className="text-xs text-gray-500">
              {t('scanned4Policies')}
            </p>
          </div>
        </div>

        {/* Extension Trigger Simulation Form */}
        <div className="w-full md:w-auto bg-orange-50/60 p-4 rounded-2xl border border-orange-100 flex flex-col sm:flex-row gap-2 items-center">
          <input 
            type="text"
            placeholder="Paste website URL (e.g. github.com)..."
            value={customInputUrl}
            onChange={(e) => setCustomInputUrl(e.target.value)}
            className="clay-input text-xs px-3 py-2 rounded-xl border border-orange-200 outline-none w-full sm:w-60"
          />
          <ClayButton 
            variant="primary" 
            className="py-2! px-4! text-xs whitespace-nowrap"
            onClick={() => {
              if (customInputUrl.trim()) {
                alert(`Simulating Extension Fetch for ${customInputUrl}... Report loaded.`);
                setCustomInputUrl('');
              }
            }}
          >
            {t('simulateExtensionScan')}
          </ClayButton>
        </div>
      </ClayCard>

      {/* Side-by-Side Policy Tabs in Header */}
      <div className="mb-8">
        <div className="flex space-x-2 border-b border-orange-100 pb-3 overflow-x-auto">
          {Object.entries(currentSite.policies).map(([id, policy]) => {
            if (!policy) return null;
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as PolicyType)}
                className={`
                  flex items-center space-x-2.5 px-5 py-3 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer whitespace-nowrap
                  ${isActive 
                    ? 'bg-orange-500 text-white shadow-[0_4px_12px_rgba(249,115,22,0.3),inset_0_1.5px_2px_rgba(255,255,255,0.4)] scale-[1.02]' 
                    : 'bg-white text-gray-600 border border-orange-100 hover:border-orange-300 hover:bg-orange-50/50 shadow-sm'
                  }
                `}
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
      </div>

      {/* Active Policy Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Overview & Risk Flags (col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          <ClayCard className="p-6 border border-orange-100 bg-[#FFFDFB] space-y-4">
            <div className="flex justify-between items-center border-b border-orange-50 pb-3">
              <h3 className="font-extrabold text-base text-gray-800">{currentPolicy.title}</h3>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${getScoreBadgeColor(currentPolicy.score)}`}>
                {t('scoreLabel')} {currentPolicy.score}/10
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">{t('flaggedRiskCategories')}</span>
              <div className="flex flex-wrap gap-2">
                {currentPolicy.riskFlags.map((flag, idx) => (
                  <span 
                    key={idx} 
                    className="bg-red-50 text-red-800 border border-red-100 text-xs px-3 py-1 rounded-full font-bold shadow-sm"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          </ClayCard>

          {/* Risk Level Filter Buttons */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600 flex items-center">
                <Filter size={14} className="mr-1.5 text-orange-500" /> Filter Policy Provisions
              </span>
              <span className="text-xs text-gray-400 font-bold">{filteredClauses.length} clauses</span>
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
                    px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 cursor-pointer
                    ${filterLevel === item.key 
                      ? 'bg-orange-500 text-white border-orange-600 shadow-sm' 
                      : 'bg-white text-gray-600 border-orange-100 hover:border-orange-300'
                    }
                  `}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Clauses Side-by-Side Detailed Breakdown (col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          {filteredClauses.length === 0 ? (
            <ClayCard className="p-12 text-center text-gray-400 bg-white">
              {t('noClausesMatchFilter')}
            </ClayCard>
          ) : (
            filteredClauses.map((clause) => (
              <ClayCard key={clause.id} className="p-6 border-2 border-orange-100/70 space-y-5 bg-white">
                {/* Clause Header */}
                <div className="flex justify-between items-start border-b border-orange-50 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-orange-600 tracking-wider block mb-1">
                      {clause.category}
                    </span>
                    <h4 className="text-lg font-bold text-gray-800">{clause.title}</h4>
                  </div>
                  <span className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full flex items-center space-x-1.5 ${
                    clause.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                    clause.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {getRiskIcon(clause.riskLevel)}
                    <span>{clause.riskLevel} Risk</span>
                  </span>
                </div>

                {/* Side-by-Side Legalese vs Plain English */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Legalese */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                    <span className="text-[10px] uppercase font-extrabold text-gray-400 tracking-widest block">{t('originalLegalese')}</span>
                    <p className="font-mono text-xs text-gray-600 leading-relaxed wrap-break-word">
                      "{clause.originalText}"
                    </p>
                  </div>

                  {/* Simplified Plain English */}
                  <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 space-y-2">
                    <span className="text-[10px] uppercase font-extrabold text-orange-700 tracking-widest block">{t('plainEnglishSummary')}</span>
                    <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                      {clause.simplifiedText}
                    </p>
                  </div>
                </div>

                {/* Why it Matters & RAG Standard */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs text-gray-700">
                    <strong className="text-orange-900 block mb-1 uppercase tracking-wider text-[11px]">{t('whyThisMatters')}</strong>
                    {clause.explanation}
                  </div>

                  <div className="p-3.5 bg-orange-100/40 rounded-xl border border-orange-200 text-xs text-orange-950 italic">
                    <strong className="not-italic font-bold block mb-1 text-orange-900 text-[10px] uppercase tracking-wider">{t('ragStandardBaselineComparison')}</strong>
                    {clause.ragComparison}
                  </div>
                </div>
              </ClayCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
