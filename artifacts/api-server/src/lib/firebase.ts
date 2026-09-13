import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Strip surrounding " or ' that sometimes get included when pasting values. */
function stripQuotes(s: string | undefined): string {
  return (s ?? '').replace(/^["']|["']$/g, '');
}

function parsePrivateKey(raw: string | undefined): string {
  let key = stripQuotes(raw);
  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  return key;
}

function configureServiceAccountFromEnv(): void {
  const projectId = stripQuotes(
    process.env.FIREBASE_TARGET_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  );
  const clientEmail = stripQuotes(
    process.env.FIREBASE_TARGET_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL,
  );
  const privateKey = parsePrivateKey(
    process.env.FIREBASE_TARGET_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY,
  );

  if (!projectId || !clientEmail || !privateKey) {
    initializeApp({ credential: applicationDefault() });
    return;
  }

  const credentialsPath = path.join(os.tmpdir(), 'msts-firebase-service-account.json');
  fs.writeFileSync(
    credentialsPath,
    JSON.stringify({
      type: 'service_account',
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    }),
    { encoding: 'utf8', mode: 0o600 },
  );
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  initializeApp({ credential: applicationDefault() });
}

if (!getApps().length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: applicationDefault() });
  } else {
    configureServiceAccountFromEnv();
  }
}

export const db = getFirestore();
