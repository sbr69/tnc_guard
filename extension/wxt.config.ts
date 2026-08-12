import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  dev: {
    server: {
      port: 3000,
    },
  },
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [
      tailwindcss(),
    ],
  }),
  manifest: {
    permissions: ['storage', 'contextMenus', 'activeTab'],
    host_permissions: ['<all_urls>'],
    name: 'Unmask-Terms',
    description: 'Simplify legal agreements and identify risks instantly.',
    version: '1.0.0',
    icons: {
      "16": "/icon/TnC_favicon.png",
      "32": "/icon/TnC_favicon.png",
      "48": "/icon/TnC_favicon.png",
      "128": "/icon/TnC_favicon.png"
    },
    action: {
      default_title: 'Unmask-Terms',
      default_icon: {
        "16": "/icon/TnC_favicon.png",
        "32": "/icon/TnC_favicon.png",
        "48": "/icon/TnC_favicon.png",
        "128": "/icon/TnC_favicon.png"
      }
    },
  },
});
