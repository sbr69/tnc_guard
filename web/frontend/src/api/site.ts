// Shared types + client functions for site-level (multi-policy) analysis.
// Used by both the /review URL-input flow and the /reports extension view.

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
  sectionLocation?: string;
}

export interface ExtensionPolicyData {
  type: PolicyType;
  title: string;
  score: number;
  riskFlags: string[];
  clauses: ExtensionReportClause[];
}

export interface ExtensionSiteData {
  domain: string;
  siteName: string;
  overallScore: number;
  scanDate: string;
  policies: Partial<Record<PolicyType, ExtensionPolicyData>>;
}

export interface PolicySummary {
  type: PolicyType;
  title: string;
  score: number;
  riskFlags: string[];
  clauseCount: number;
  documentId: string;
}

export interface RiskFlag {
  label: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ExtensionSiteReport {
  domain: string;
  siteName: string;
  overallScore: number;
  scanDate: string;
  status: 'done' | 'processing' | 'error';
  policies: Partial<Record<PolicyType, PolicySummary>>;
  topRiskFlags: RiskFlag[];
}

const WORKER_URL =
  ((import.meta.env.VITE_WORKER_URL as string | undefined) ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const BACKEND_URL =
  ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://127.0.0.1:8001').replace(/\/$/, '');

export async function analyzeSite(
  siteUrl: string,
  policyUrls?: Partial<Record<PolicyType, string | null>>,
  forceRefresh = false
): Promise<ExtensionSiteReport> {
  const res = await fetch(`${WORKER_URL}/api/site/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteUrl, policyUrls: policyUrls ?? {}, forceRefresh }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Worker returned ${res.status}`);
  }
  return res.json();
}

export async function getSiteReport(hostname: string): Promise<ExtensionSiteReport | null> {
  const res = await fetch(
    `${WORKER_URL}/api/site/analyze?hostname=${encodeURIComponent(hostname)}`
  );
  if (!res.ok) return null;
  return res.json();
}

function mapClause(c: any): ExtensionReportClause {
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    riskLevel: c.riskLevel === 'risky' ? 'high' : c.riskLevel === 'cautionary' ? 'medium' : 'low',
    originalText: c.originalText,
    simplifiedText: c.simplifiedText || 'No simplified text available.',
    explanation: c.explanation || '',
    ragComparison: c.ragComparison || 'Standard clause.',
    sectionLocation: c.sectionLocation || `Sec. ${Math.floor(Math.random() * 8) + 1}`,
  };
}

export async function hydrateSiteReport(report: ExtensionSiteReport): Promise<ExtensionSiteData> {
  const entries = Object.entries(report.policies || {}).filter(
    ([, summary]) => summary && (summary as PolicySummary).documentId
  );

  const hydrated = await Promise.all(
    entries.map(async ([ptype, summary]) => {
      const p = summary as PolicySummary;
      let clauses: ExtensionReportClause[] = [];
      try {
        const docRes = await fetch(`${BACKEND_URL}/api/documents/${p.documentId}`);
        if (docRes.ok) {
          const docData = await docRes.json();
          clauses = (docData.clauses || []).map(mapClause);
        }
      } catch (err) {
        console.error('Failed to fetch doc', p.documentId, err);
      }
      return [
        ptype as PolicyType,
        {
          type: ptype as PolicyType,
          title: p.title,
          score: p.score,
          riskFlags: p.riskFlags || [],
          clauses,
        },
      ] as [PolicyType, ExtensionPolicyData];
    })
  );

  const policies: Partial<Record<PolicyType, ExtensionPolicyData>> = {};
  for (const [ptype, policy] of hydrated) {
    policies[ptype] = policy;
  }

  return {
    domain: report.domain,
    siteName: report.siteName || report.domain,
    overallScore: report.overallScore || 0,
    scanDate: report.scanDate || new Date().toISOString().split('T')[0],
    policies,
  };
}
