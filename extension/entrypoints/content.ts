import { defineContentScript } from 'wxt/utils/define-content-script';

type PolicyType = 'privacy' | 'tos' | 'cookie' | 'eula';

type Discovered = Record<PolicyType, string | null>;

export default defineContentScript({
  matches: ['<all_urls>'],
  // Lazy: the script loads on every page but does NO work until the popup
  // asks it to scan (when the user clicks "Analyse"). This keeps background
  // per-page CPU at zero on sites the user never analyzes.
  main() {
    // Maps have no prototype chain, so .get() can never access __proto__ or
    // constructor — eliminating the prototype-pollution risk entirely.
    const POLICY_URL_PATTERNS: Map<PolicyType, RegExp> = new Map([
      ['privacy', /\/(privacy|data-policy|datapolicy|privacy-policy|privacypolicy|privacy-notice)/i],
      ['tos', /\/(terms|tos|terms-of-service|termsofservice|terms-and-conditions|legal\/terms|terms-of-use)/i],
      ['cookie', /\/(cookie|cookies|cookie-policy|cookiepolicy|cookie-notice)/i],
      ['eula', /\/(eula|license-agreement|end-user-license|software-license)/i],
    ]);

    const POLICY_TEXT_PATTERNS: Map<PolicyType, RegExp> = new Map([
      ['privacy', /privacy\s*(policy|notice|statement)/i],
      ['tos', /terms\s*(of\s*service|and\s*conditions|of\s*use)|terms\s*&\s*conditions/i],
      ['cookie', /cookie\s*(policy|notice|preferences|settings)/i],
      ['eula', /(end.?user\s*license|software\s*license|EULA)/i],
    ]);

    function resolveUrl(href: string | null): string | null {
      if (!href) return null;
      try {
        const url = new URL(href, window.location.href);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        // Strict subdomain targeting: only same-hostname links.
        if (url.hostname !== window.location.hostname) return null;
        return url.href;
      } catch (e) {
        return null;
      }
    }

    const POLICY_KEYS: readonly PolicyType[] = ['privacy', 'tos', 'cookie', 'eula'];

    // Use Map instead of a plain object so bracket notation is never needed.
    // Maps have no prototype chain, eliminating any prototype-pollution risk.
    type DiscoveredMap = Map<PolicyType, string | null>;

    function matchPolicyLink(link: HTMLAnchorElement, discovered: DiscoveredMap) {
      const href = link.getAttribute('href');
      const text = link.innerText?.trim() || '';
      if (!href || href.startsWith('javascript:')) return;
      const resolvedHref = resolveUrl(href);
      if (!resolvedHref) return;

      for (const key of POLICY_KEYS) {
        if (!discovered.get(key)) {
          if (POLICY_URL_PATTERNS.get(key)!.test(href)) {
            discovered.set(key, resolvedHref);
            continue;
          }
          if (text && POLICY_TEXT_PATTERNS.get(key)!.test(text)) {
            discovered.set(key, resolvedHref);
          }
        }
      }
    }

    function scanDom(discovered: DiscoveredMap) {
      const links = document.querySelectorAll('a[href]');
      links.forEach((node) => {
        if (node instanceof HTMLAnchorElement) matchPolicyLink(node, discovered);
      });
      // Current page itself may be a policy.
      for (const key of POLICY_KEYS) {
        if (!discovered.get(key) && POLICY_URL_PATTERNS.get(key)!.test(window.location.href)) {
          discovered.set(key, window.location.href);
        }
      }
    }

    function discover(timeoutMs = 2000): Promise<{ policies: Discovered; pageUrl: string; domain: string }> {
      return new Promise((resolve) => {
        const discovered: DiscoveredMap = new Map([
          ['privacy', null],
          ['tos', null],
          ['cookie', null],
          ['eula', null],
        ]);
        scanDom(discovered);
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          observer.disconnect();
          // Convert Map back to plain object for the message payload.
          const policies: Discovered = {
            privacy: discovered.get('privacy') ?? null,
            tos: discovered.get('tos') ?? null,
            cookie: discovered.get('cookie') ?? null,
            eula: discovered.get('eula') ?? null,
          };
          resolve({
            policies,
            pageUrl: window.location.href,
            domain: window.location.hostname,
          });
        };
        // Catch late-loaded modals / cookie banners (the "hidden terms" logic).
        const observer = new MutationObserver(() => scanDom(discovered));
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(finish, timeoutMs);
      });
    }

    browser.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (r: any) => void) => {
      if (message?.type === 'SCAN_POLICIES') {
        const timeout = (message.payload?.timeoutMs as number | undefined) ?? 2000;
        discover(timeout).then((result) => sendResponse(result));
        return true; // keep the message channel open for the async response
      }
      return false;
    });
  },
});
