export type PolicyType = 'privacy' | 'tos' | 'cookie' | 'eula';

export interface RiskFlag {
  label: string;
  severity: 'high' | 'medium' | 'low';
}

export interface PolicyStatus {
  type: PolicyType;
  found: boolean;
  score: number | null;
  documentId: string | null;
}

export interface ExtensionPopupData {
  domain: string;
  siteName: string;
  overallScore: number;
  scanDate: string;
  status: 'done' | 'processing' | 'error';
  riskFlags: RiskFlag[];
  policiesFound: PolicyStatus[];
}

export interface PolicyAnalysis {
  type: PolicyType;
  title: string;
  score: number;
  riskFlags: string[];
  clauseCount: number;
  documentId: string;
}

export interface ExtensionSiteReport {
  domain: string;
  siteName: string;
  overallScore: number;
  scanDate: string;
  status: 'done' | 'processing' | 'error';
  policies: Record<PolicyType, PolicyAnalysis | null>;
  topRiskFlags: RiskFlag[];
}
