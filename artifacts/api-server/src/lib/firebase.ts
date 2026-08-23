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

  const projectId = process.env.FIREBASE_TARGET_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_TARGET_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_TARGET_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  const serviceAccount = {
    type: 'service_account',
    project_id: stripQuotes(projectId),
    private_key_id: 'replit-secret',
    private_key: parsePrivateKey(privateKey),
    client_email: stripQuotes(clientEmail),
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
