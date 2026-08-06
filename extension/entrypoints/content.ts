import { defineContentScript } from 'wxt/utils/define-content-script';

type PolicyType = 'privacy' | 'tos' | 'cookie' | 'eula';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('ClarifyLaw Content Script loaded.');

    const POLICY_URL_PATTERNS: Record<PolicyType, RegExp> = {
      privacy: /\/(privacy|data-policy|datapolicy|privacy-policy|privacypolicy|privacy-notice)/i,
      tos: /\/(terms|tos|terms-of-service|termsofservice|terms-and-conditions|legal\/terms|terms-of-use)/i,
      cookie: /\/(cookie|cookies|cookie-policy|cookiepolicy|cookie-notice)/i,
      eula: /\/(eula|license-agreement|end-user-license|software-license)/i,
    };

    const POLICY_TEXT_PATTERNS: Record<PolicyType, RegExp> = {
      privacy: /privacy\s*(policy|notice|statement)/i,
      tos: /terms\s*(of\s*service|and\s*conditions|of\s*use)|terms\s*&\s*conditions/i,
      cookie: /cookie\s*(policy|notice|preferences|settings)/i,
      eula: /(end.?user\s*license|software\s*license|EULA)/i,
    };

    const discoveredPolicies: Record<PolicyType, string | null> = {
      privacy: null,
      tos: null,
      cookie: null,
      eula: null,
    };

    function resolveUrl(href: string | null): string | null {
      if (!href) return null;
      try {
        const url = new URL(href, window.location.href);
        // Only accept http/https
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return url.href;
      } catch (e) {
        return null;
      }
    }

    function matchPolicyLink(link: HTMLAnchorElement) {
      const href = link.getAttribute('href');
      const text = link.innerText?.trim() || '';

      if (!href || href.startsWith('javascript:')) return;

      const resolvedHref = resolveUrl(href);
      if (!resolvedHref) return;

      for (const key of Object.keys(POLICY_URL_PATTERNS)) {
        const type = key as PolicyType;
        if (!discoveredPolicies[type]) {
          // Check URL first
          if (POLICY_URL_PATTERNS[type].test(href)) {
            discoveredPolicies[type] = resolvedHref;
            continue;
          }
          // Check Text content second
          if (text && POLICY_TEXT_PATTERNS[type].test(text)) {
            discoveredPolicies[type] = resolvedHref;
          }
        }
      }
    }

    function scanDom() {
      const links = document.querySelectorAll('a[href]');
      links.forEach((node) => {
        if (node instanceof HTMLAnchorElement) {
          matchPolicyLink(node);
        }
      });
    }

    function sendToBackground() {
      // Avoid sending if we found absolutely nothing
      if (Object.values(discoveredPolicies).every((val) => val === null)) {
        return;
      }

      browser.runtime.sendMessage({
        type: 'POLICIES_DETECTED',
        payload: {
          domain: window.location.hostname,
          pageUrl: window.location.href,
          policies: discoveredPolicies,
        },
      });
    }

    // 1 & 2: Scan initially on load
    scanDom();
    sendToBackground();

    // 3: Observe for late-loaded modals/cookie banners
    const observer = new MutationObserver((mutations) => {
      let foundNew = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            const newLinks = node.querySelectorAll('a[href]');
            newLinks.forEach((linkNode) => {
              if (linkNode instanceof HTMLAnchorElement) {
                const oldState = { ...discoveredPolicies };
                matchPolicyLink(linkNode);
                if (JSON.stringify(oldState) !== JSON.stringify(discoveredPolicies)) {
                  foundNew = true;
                }
              }
            });
          }
        }
      }
      if (foundNew) {
        sendToBackground();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Stop observing after 5 seconds to save resources
    setTimeout(() => {
      observer.disconnect();
    }, 5000);
  },
});
