---
name: Firebase env var quotes
description: Replit Secrets saved FIREBASE_PROJECT_ID and FIREBASE_CLIENT_EMAIL with surrounding double-quotes, causing UNAUTHENTICATED errors from Firestore.
---

## Rule
Strip surrounding `"` or `'` from ALL Firebase environment variables before use — not just the private key.

```typescript
function stripQuotes(s: string | undefined): string {
  return (s ?? '').replace(/^["']|["']$/g, '');
}
```

Apply to: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and any other Firebase config env vars.

**Why:** The user pasted values into the Replit Secrets form with surrounding quotes. Firestore gRPC returns `16 UNAUTHENTICATED` (not a helpful "project not found") when the project_id contains literal quote characters.

**How to apply:** Any time you initialize Firebase Admin SDK from env vars, run all string values through `stripQuotes()` before using them in the credential object.
