import fs from 'fs';
import os from 'os';
import path from 'path';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/** Strip surrounding " or ' that sometimes get included when pasting values. */
function stripQuotes(s: string | undefined): string {
  return (s ?? '').replace(/^["']|["']$/g, '');
}

function parsePrivateKey(raw: string | undefined): string {
  let key = stripQuotes(raw);
  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  return key;
}

function setupGoogleCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const serviceAccount = {
    type: 'service_account',
    project_id: stripQuotes(process.env.FIREBASE_PROJECT_ID),
    private_key_id: 'replit-secret',
    private_key: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    client_email: stripQuotes(process.env.FIREBASE_CLIENT_EMAIL),
    client_id: '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: '',
  };

  const tmpPath = path.join(os.tmpdir(), 'firebase-service-account.json');
  fs.writeFileSync(tmpPath, JSON.stringify(serviceAccount, null, 2), { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}

setupGoogleCredentials();

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}

export const db = getFirestore();
