---
name: Env var quotes
description: Secrets entered via requestSecrets are saved with surrounding double-quotes and must be stripped before use.
---

All secrets entered through the Replit `requestSecrets` secure form arrive with literal surrounding double-quote characters (e.g. `"gsk_abc123"` instead of `gsk_abc123`). This affects every secret, not just Firebase ones.

**Why:** The Replit secrets UI wraps the value in quotes when saving.

**How to apply:** Add a `stripQuotes` helper wherever a secret is read from `process.env` and passed to an external SDK:

```ts
function stripQuotes(val: string): string {
  return val.replace(/^["']|["']$/g, '');
}
```

Confirmed affected: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `GROK_API_KEY`.
Apply defensively to any new secret added to this project.
