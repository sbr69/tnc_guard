// Augments the wrangler-generated Env (worker-configuration.d.ts) with the
// WORKER_SHARED_SECRET binding. Secrets are set via `wrangler secret put` and
// are intentionally NOT declared in wrangler.jsonc, so they don't appear in the
// generated types. Optional in local dev (set in .dev.vars); required in
// production — authedHeaders() only attaches it when present, and the backend's
// verify_worker_token fail-closes when it's missing.
interface Env {
	WORKER_SHARED_SECRET: string | undefined;
}
