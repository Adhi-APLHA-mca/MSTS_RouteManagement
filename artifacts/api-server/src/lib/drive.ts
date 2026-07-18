import { google } from 'googleapis';

function stripQuotes(s: string | undefined): string {
  return (s ?? '').replace(/^["']|["']$/g, '');
}

function getDriveClient() {
  const rawKey = stripQuotes(process.env.FIREBASE_PRIVATE_KEY);
  const privateKey = rawKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: stripQuotes(process.env.FIREBASE_CLIENT_EMAIL),
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

export function extractFolderIdFromUrl(url: string): string | null {
  // Handles:
  //   https://drive.google.com/drive/folders/{id}
  //   https://drive.google.com/drive/u/0/folders/{id}
  //   https://drive.google.com/open?id={id}
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  return null;
}

export async function shareDriveFolder(
  folderUrl: string,
  email: string,
): Promise<void> {
  const folderId = extractFolderIdFromUrl(folderUrl);
  if (!folderId) throw new Error(`Cannot extract folder ID from URL: ${folderUrl}`);

  const drive = getDriveClient();

  await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      role: 'reader',
      type: 'user',
      emailAddress: email,
    },
    sendNotificationEmail: false,
  });
}
