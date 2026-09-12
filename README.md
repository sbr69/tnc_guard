# Unmask Terms — Web Platform

Unmask Terms is an AI-powered legal document analysis platform that automatically discovers, parses, and evaluates the privacy policies, terms of service, cookie policies, and EULAs of any website. It surfaces hidden risks, translates legalese into plain language, and assigns a quantified safety score — giving users the information they need before they agree to anything.

> 📌 For the browser extension, see [`extension/README.md`](extension/README.md).  
> 📖 For detailed internal documentation, see [`docs.md`](docs.md).

---

## What It Does

- **Analyse any website** — Submit a URL or upload a document (PDF, DOCX, TXT) and get a full clause-by-clause breakdown.
- **Safety scoring** — Every document receives a health score (0–100) based on weighted risk analysis across nine legal categories.
- **Plain-language translations** — Each flagged clause is rewritten in everyday language so anyone can understand what they're agreeing to.
- **RAG-powered analysis** — A six-stage Retrieval-Augmented Generation pipeline uses Gemini embeddings and LLM reasoning, cross-referenced against curated legal reference standards.
- **Content deduplication** — SHA-256 hashing skips re-analysis of identical policy text, saving cost and time.
- **Cross-site reports** — Browse analysis history and compare how different sites treat your data.

---

## Tech Stack

| Component | Technology |
|---|---|
| **Backend** | Python 3.12+, FastAPI, PostgreSQL + pgvector, Gemini API |
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, TypeScript, Motion |
| **Edge Proxy** | Cloudflare Workers, KV cache |

---

## Architecture

```
React Frontend ──→ Cloudflare Worker (edge cache + rate limit) ──→ FastAPI Backend (RAG pipeline + Postgres)
```

The Cloudflare Worker sits between all clients and the backend, providing edge caching (30-day KV TTL) and rate limiting. The backend runs a six-stage RAG pipeline: parse → segment → rule scan + vector retrieval → LLM reasoning → self-verification → scoring.

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL with the `pgvector` extension
- A [Gemini API key](https://ai.google.dev/)

### Backend

```bash
cd web/backend
pip install -r requirements.txt
cp .env.example .env          # Fill in GEMINI_API_KEY and DATABASE_URL
python -m app.main
```

### Frontend

```bash
cd web/frontend
npm install
npm run dev
```

### Cloudflare Worker (optional, for edge caching)

```bash
cd worker
npm install
npx wrangler dev
```

---

## Environment Variables

### Backend (`web/backend/.env`)

| Variable | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API key for embeddings and LLM | Yes |
| `DATABASE_URL` | PostgreSQL connection string (with pgvector) | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins (default: `*`) | No |
| `GEMINI_RPM` | Rate limit in requests/min (default: `14`) | No |
| `GEMINI_BURST` | Token bucket burst size (default: `3`) | No |

### Worker (`worker/wrangler.jsonc`)

| Variable | Description |
|---|---|
| `BACKEND_API_URL` | URL of the FastAPI backend |
| KV Namespace | `CLARIFYLAW_CACHE` — edge cache storage |

---

## License

All rights reserved.
