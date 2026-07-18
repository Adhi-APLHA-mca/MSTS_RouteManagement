---
name: Firebase credential init pattern
description: Reliable way to initialize Firebase Admin SDK from env vars on Node 24 / Replit.
---

## Pattern
Write a full service account JSON to a temp file and use `applicationDefault()` rather than `cert({ privateKey })` directly.

```typescript
const serviceAccount = {
  type: 'service_account',
  project_id: stripQuotes(process.env.FIREBASE_PROJECT_ID),
  private_key: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY), // handles \\n → \n
  client_email: stripQuotes(process.env.FIREBASE_CLIENT_EMAIL),
  // … other required fields
};
const tmpPath = path.join(os.tmpdir(), 'firebase-service-account.json');
fs.writeFileSync(tmpPath, JSON.stringify(serviceAccount), { mode: 0o600 });
process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
initializeApp({ credential: applicationDefault() });
```

**Why:** `cert({ privateKey })` with Node.js 24's stricter OpenSSL raises `ERR_OSSL_UNSUPPORTED` for certain RSA key formats. Writing to a file and using the standard credential discovery (`applicationDefault`) is more reliable across Node versions.

**How to apply:** Always use this pattern when initializing Firebase Admin from Replit Secrets.
