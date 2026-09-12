# Unmask Terms — Browser Extension

A Manifest V3 browser extension that analyses the legal documents of any website in real time. It discovers privacy policies, terms of service, cookie policies, and EULAs on the current page, runs them through the Unmask Terms analysis pipeline, and shows you a safety score with flagged risks — all without leaving the site.

> 📌 For the web platform (backend + frontend), see the [root README](../README.md).  
> 📖 For detailed internals, see [`docs.md`](../docs.md#extension-internals).

---

## Features

- **One-click analysis** — Click "Analyse" in the popup to scan any website's legal documents instantly.
- **Safety score** — See a 0–10 score with colour-coded risk indicators at a glance.
- **SPA support** — Extracts rendered DOM text from client-side apps where static HTML is empty.
- **Context menu** — Right-click any link → "Analyse this policy with Unmask Terms".
- **Smart caching** — Three-tier cache (local → edge → backend) for instant repeat visits.
- **Stale warnings** — Flags results older than 7 days and offers one-click re-scan.
- **Lazy activation** — Zero CPU/network cost on sites you don't analyse.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | WXT 0.21 (Manifest V3) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript 5.9 |
| Icons | Lucide React |
| i18n | i18next + react-i18next |
| Domain parsing | tldts |

---

## How It Works

```
Popup (React) ──→ Background Service Worker ──→ Cloudflare Worker ──→ FastAPI Backend
                         ↑
              Content Script (DOM scan)
```

1. You click "Analyse" in the popup.
2. The content script scans the page for policy links.
3. The background worker checks cache, then calls the backend via the Cloudflare Worker.
4. Results flow back and are displayed in the popup with score and flagged risks.

---

## Getting Started

```bash
cd extension
npm install
npm run dev
```

WXT launches a dev browser with the extension pre-loaded. Changes auto-rebuild and reload.

### Environment Variables

Set in `.env` or as build-time variables:

| Variable | Description | Default |
|---|---|---|
| `VITE_WORKER_URL` | Cloudflare Worker URL | `http://127.0.0.1:8787` |
| `VITE_APP_URL` | Web frontend URL | `http://localhost:5173` |

---

## Building for Production

```bash
cd extension
npm run build
```

Output goes to `.output/`. Load as unpacked or package for the Chrome Web Store.

---

## License

All rights reserved.
