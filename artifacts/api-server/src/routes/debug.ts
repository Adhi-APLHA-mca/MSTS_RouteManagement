import { Router } from 'express';
import fs from 'fs';

const router = Router();

// GET /api/debug/credentials  — dev-only, shows non-sensitive credential info
router.get('/credentials', (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? '';
  const cleanKey = rawKey
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();

  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '';
  let saFileContent: any = null;
  try {
    if (saPath) saFileContent = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  } catch { /* ignore */ }

  res.json({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    keyDiagnostics: {
      rawLength: rawKey.length,
      cleanLength: cleanKey.length,
      hasBeginMarker: cleanKey.includes('-----BEGIN PRIVATE KEY-----'),
      hasEndMarker: cleanKey.includes('-----END PRIVATE KEY-----'),
      actualNewlineCount: (cleanKey.match(/\n/g) ?? []).length,
      literalBackslashNCount: (rawKey.match(/\\n/g) ?? []).length,
      firstChars: cleanKey.substring(0, 36),
      lastChars: cleanKey.substring(cleanKey.length - 36),
    },
    googleApplicationCredentials: saPath,
    saFileWritten: !!saFileContent,
    saFileProjectId: saFileContent?.project_id,
    saFileClientEmail: saFileContent?.client_email,
  });
});

export default router;
