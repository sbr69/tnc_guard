import type { PolicyType } from './types';

// Single source of truth for policy classification, shared by the content
// script and the background. Kept in sync with the server's discovery.py
// patterns so client and server agree on what counts as a policy link.
export const POLICY_TYPES: readonly PolicyType[] = ['privacy', 'tos', 'cookie', 'eula'] as const;

export const POLICY_URL_PATTERNS: Record<PolicyType, RegExp> = {
  privacy: /\/(privacy|data-policy|datapolicy|privacy-policy|privacypolicy|privacy-notice|privacy-statement)/i,
  tos: /\/(terms|tos|terms-of-service|termsofservice|terms-and-conditions|legal\/terms|legal\/tos|terms-of-use)/i,
  cookie: /\/(cookie|cookies|cookie-policy|cookiepolicy|cookie-notice)/i,
  eula: /\/(eula|license-agreement|licence-agreement|end-user-license|end_user_license|software-license|software-licence)/i,
};

export const POLICY_TEXT_PATTERNS: Record<PolicyType, RegExp> = {
  privacy: /privacy\s*(policy|notice|statement|rights)/i,
  tos: /terms\s*(of\s*service|of\s*use|and\s*conditions)|terms\s*&\s*conditions|terms\s+of\s+service/i,
  cookie: /cookie\s*(policy|notice|preferences|settings|statement)/i,
  eula: /(end[ \-]?user\s*licen[cs]e|software\s*licen[cs]e|EULA)/i,
};

export const EMPTY_POLICY_URLS: Record<PolicyType, string | null> = {
  privacy: null, tos: null, cookie: null, eula: null,
};

export function classifyByLink(href: string, text: string): PolicyType | null {
  for (const pt of POLICY_TYPES) {
    if (POLICY_URL_PATTERNS[pt].test(href)) return pt;
    if (text && POLICY_TEXT_PATTERNS[pt].test(text)) return pt;
  }
  return null;
}

export function classifyByUrl(url: string): PolicyType | null {
  for (const pt of POLICY_TYPES) {
    if (POLICY_URL_PATTERNS[pt].test(url)) return pt;
  }
  return null;
}

export function classifyByText(text: string): PolicyType | null {
  if (!text) return null;
  for (const pt of POLICY_TYPES) {
    if (POLICY_TEXT_PATTERNS[pt].test(text)) return pt;
  }
  return null;
}
