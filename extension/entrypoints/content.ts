import { defineContentScript } from 'wxt/utils/define-content-script';
import { getDomain } from 'tldts';
import type { PolicyType } from '../lib/types';
import {
  POLICY_TYPES,
  POLICY_URL_PATTERNS,
  classifyByLink,
} from '../lib/policyPatterns';

type Discovered = Record<PolicyType, string | null>;

// One-line UI chrome that docs platforms render inside the content tree.
// Anchored to the whole line so legal prose is never matched.
const UI_NOISE_RE = /^(?:skip to (?:main )?content|collapse sidebar|expand sidebar|toggle (?:navigation|sidebar)|back to top|edit this page|on this page|table of contents)$/i;

function isSameEntity(urlHostname: string, pageHostname: string): boolean {
  // Mirrors the server's _is_same_entity: org subdomains of an apex page are
  // the same entity (docs.github.com for github.com); a page that is *itself*
  // a subdomain of a shared multi-tenant platform (myweb.vercel.app) is
  // isolated by exact hostname. Robust to PSL gaps: even if tldts does not know
  // a platform suffix, a subdomain page falls back to exact match instead of
  // collapsing onto a shared registered domain. Leading www. is non-tenant.
  const target = getDomain(pageHostname);
  if (!target) return urlHostname.toLowerCase() === pageHostname.toLowerCase();
  const norm = pageHostname.toLowerCase().startsWith('www.') ? pageHostname.slice(4) : pageHostname;
  if (norm.toLowerCase() === target.toLowerCase()) {
    return (getDomain(urlHostname) || '').toLowerCase() === target.toLowerCase();
  }
  return urlHostname.toLowerCase() === pageHostname.toLowerCase();
}

// Maps have no prototype chain, so .get() can never access __proto__ or
// constructor -- eliminating the prototype-pollution risk entirely.
type DiscoveredMap = Map<PolicyType, string | null>;

function resolveUrl(href: string | null): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, window.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!isSameEntity(url.hostname, window.location.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function matchPolicyLink(link: HTMLAnchorElement, discovered: DiscoveredMap) {
  const href = link.getAttribute('href');
  if (!href || href.startsWith('javascript:')) return;
  const resolvedHref = resolveUrl(href);
  if (!resolvedHref) return;
  const text = link.textContent?.trim() || '';
  const pt = classifyByLink(resolvedHref, text);
  if (pt && !discovered.get(pt)) {
    discovered.set(pt, resolvedHref);
  }
}

function scanDom(discovered: DiscoveredMap, processed: Set<string>) {
  const links = document.querySelectorAll('a[href]');
  links.forEach((node) => {
    if (!(node instanceof HTMLAnchorElement)) return;
    const href = node.getAttribute('href');
    if (!href || processed.has(href)) return; // memoise: each unique href once
    processed.add(href);
    matchPolicyLink(node, discovered);
  });
  // Current page itself may be a policy.
  for (const key of POLICY_TYPES) {
    if (!discovered.get(key) && POLICY_URL_PATTERNS[key].test(window.location.href)) {
      discovered.set(key, window.location.href);
    }
  }
}

function extractPageText(): string {
  // Clone so we never mutate the live page the user is viewing.
  const doc = document.cloneNode(true) as Document;
  const root0 = doc.body || doc.documentElement;
  if (!root0) return '';
  root0.querySelectorAll('script,style,noscript').forEach((el) => el.remove());
  const main = root0.querySelector('main, [role="main"], article');
  const root: Element = (main as Element | null) || root0;
  root.querySelectorAll('nav,header,footer,aside').forEach((el) => el.remove());
  // Insert newlines at block boundaries: textContent alone flattens block
  // structure to one line, which would explode the segmenter into hundreds of
  // fragments (the same class of bug fixed server-side).
  root.querySelectorAll('div,p,li,section,article,blockquote,pre,tr,h1,h2,h3,h4,h5,h6,ul,ol')
    .forEach((el) => el.append('\n'));
  const raw = root.textContent || '';
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l && !UI_NOISE_RE.test(l));
  const chunks: string[] = [];
  for (const line of lines) {
    for (const phrase of line.split('  ')) {
      const p = phrase.trim();
      if (p) chunks.push(p);
    }
  }
  return chunks.join('\n');
}

export default defineContentScript({
  matches: ['<all_urls>'],
  // Lazy: the script loads on every page but does NO work until the popup
  // asks it to scan (when the user clicks "Analyse"). This keeps background
  // per-page CPU at zero on sites the user never analyzes.
  main() {
    function discover(timeoutMs = 2000): Promise<{
      policies: Discovered;
      policyTexts: Partial<Record<PolicyType, string>>;
      pageUrl: string;
      domain: string;
    }> {
      return new Promise((resolve) => {
        const discovered: DiscoveredMap = new Map([
          ['privacy', null],
          ['tos', null],
          ['cookie', null],
          ['eula', null],
        ]);
        const processed = new Set<string>();

        const scan = () => scanDom(discovered, processed);
        scan();

        let finished = false;
        let debounceTimer: ReturnType<typeof setTimeout> | undefined;
        let stableTimer: ReturnType<typeof setTimeout> | undefined;
        let observer: MutationObserver;

        const finish = () => {
          if (finished) return;
          finished = true;
          observer?.disconnect();
          clearTimeout(debounceTimer);
          clearTimeout(stableTimer);
          clearTimeout(hardTimer);

          const policies: Discovered = {
            privacy: discovered.get('privacy') ?? null,
            tos: discovered.get('tos') ?? null,
            cookie: discovered.get('cookie') ?? null,
            eula: discovered.get('eula') ?? null,
          };
          // If the current page is itself one of the discovered policies,
          // extract its rendered text so the server can analyse a
          // client-rendered SPA without fetching empty static HTML (the server
          // side of this contract already accepts policyTexts).
          const policyTexts: Partial<Record<PolicyType, string>> = {};
          for (const key of POLICY_TYPES) {
            const v = discovered.get(key);
            if (v && v === window.location.href && !policyTexts[key]) {
              try {
                policyTexts[key] = extractPageText();
              } catch {
                /* ignore extraction failures */
              }
            }
          }
          resolve({
            policies,
            policyTexts,
            pageUrl: window.location.href,
            domain: window.location.hostname,
          });
        };

        // Debounce: batch mutations instead of scanning on every event, so a
        // churny SPA page does not pin the main thread for the whole window.
        // Early-exit once the DOM is stable for 1s (still catches most late
        // modals / cookie banners); hard cap at timeoutMs regardless.
        observer = new MutationObserver(() => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(scan, 150);
          clearTimeout(stableTimer);
          stableTimer = setTimeout(finish, 1000);
        });
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
        const hardTimer = setTimeout(finish, timeoutMs);
      });
    }

    browser.runtime.onMessage.addListener(
      (message: any, _sender: any, sendResponse: (r: any) => void) => {
        if (message?.type === 'SCAN_POLICIES') {
          const timeout = (message.payload?.timeoutMs as number | undefined) ?? 2000;
          discover(timeout).then((result) => sendResponse(result));
          return true; // keep the message channel open for the async response
        }
        return false;
      }
    );
  },
});
