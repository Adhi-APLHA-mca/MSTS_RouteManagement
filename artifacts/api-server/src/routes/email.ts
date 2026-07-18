import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { transporter } from '../lib/mailer.js';
import { generateWelcomeEmail } from '../lib/grok.js';
import { shareDriveFolder } from '../lib/drive.js';
import { logger } from '../lib/logger.js';

const router = Router();

// POST /api/email/preview  — generate (but don't send) email for one buyer
router.post('/preview', async (req, res) => {
  try {
    const { routeId, buyerId } = req.body;

    const [routeDoc, buyerDoc] = await Promise.all([
      db.collection('routes').doc(routeId).get(),
      db.collection('buyers').doc(buyerId).get(),
    ]);

    if (!routeDoc.exists || !buyerDoc.exists) {
      return res.status(404).json({ error: 'Route or buyer not found' });
    }

    const route = routeDoc.data()!;
    const buyer = buyerDoc.data()!;

    const email = await generateWelcomeEmail({
      routeName: route.name,
      routeCode: route.code,
      buyerName: buyer.name,
      whatsappGroupLink: route.whatsappGroupLink,
      driveFolderLink: route.driveFolderLink,
    });

    res.json(email);
  } catch (err: any) {
    logger.error({ err }, 'Email preview failed');
    res.status(500).json({ error: err.message || 'Failed to generate preview' });
  }
});

// POST /api/email/send  — generate + send + share Drive + mark emailSent
router.post('/send', async (req, res) => {
  try {
    const { routeId, buyerIds } = req.body as {
      routeId: string;
      buyerIds: string[];
    };

    const routeDoc = await db.collection('routes').doc(routeId).get();
    if (!routeDoc.exists) return res.status(404).json({ error: 'Route not found' });

    const route = routeDoc.data()!;
    const results: { buyerId: string; status: 'sent' | 'failed'; error?: string }[] = [];

    for (const buyerId of buyerIds) {
      try {
        const buyerDoc = await db.collection('buyers').doc(buyerId).get();
        if (!buyerDoc.exists) {
          results.push({ buyerId, status: 'failed', error: 'Buyer not found' });
          continue;
        }

        const buyer = buyerDoc.data()!;

        if (!buyer.email) {
          results.push({ buyerId, status: 'failed', error: 'No email address on file' });
          continue;
        }

        // 1. Generate email via Grok
        const { subject, html } = await generateWelcomeEmail({
          routeName: route.name,
          routeCode: route.code,
          buyerName: buyer.name,
          whatsappGroupLink: route.whatsappGroupLink,
          driveFolderLink: route.driveFolderLink,
        });

        // 2. Send via SMTP
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: buyer.email,
          subject,
          html,
        });

        // 3. Share Drive folder (non-fatal if it fails)
        if (route.driveFolderLink) {
          try {
            await shareDriveFolder(route.driveFolderLink, buyer.email);
          } catch (driveErr: any) {
            logger.warn({ driveErr: driveErr.message, buyer: buyer.email }, 'Drive share failed (non-fatal)');
          }
        }

        // 4. Mark emailSent in Firestore
        await db.collection('buyers').doc(buyerId).update({
          emailSent: true,
          emailSentAt: new Date().toISOString(),
        });

        results.push({ buyerId, status: 'sent' });
      } catch (err: any) {
        logger.error({ err, buyerId }, 'Failed to send email for buyer');
        results.push({ buyerId, status: 'failed', error: err.message });
      }
    }

    res.json({ results });
  } catch (err: any) {
    logger.error({ err }, 'Send email route failed');
    res.status(500).json({ error: err.message || 'Failed to send emails' });
  }
});

// POST /api/email/draft  — send a hand-composed email to selected buyers
router.post('/draft', async (req, res) => {
  try {
    const { routeId, buyerIds, subject, body } = req.body as {
      routeId: string;
      buyerIds: string[];
      subject: string;
      body: string;
    };

    if (!subject || !body) {
      return res.status(400).json({ error: 'subject and body are required' });
    }

    const routeDoc = await db.collection('routes').doc(routeId).get();
    if (!routeDoc.exists) return res.status(404).json({ error: 'Route not found' });

    // Convert plain text body → HTML (preserve line breaks)
    const htmlBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;line-height:1.6">
${htmlBody}
</body></html>`;

    const results: { buyerId: string; status: 'sent' | 'failed'; error?: string }[] = [];

    for (const buyerId of buyerIds) {
      try {
        const buyerDoc = await db.collection('buyers').doc(buyerId).get();
        if (!buyerDoc.exists) { results.push({ buyerId, status: 'failed', error: 'Buyer not found' }); continue; }
        const buyer = buyerDoc.data()!;
        if (!buyer.email) { results.push({ buyerId, status: 'failed', error: 'No email' }); continue; }

        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: buyer.email,
          subject,
          html,
        });

        results.push({ buyerId, status: 'sent' });
      } catch (err: any) {
        logger.error({ err, buyerId }, 'Draft email send failed');
        results.push({ buyerId, status: 'failed', error: err.message });
      }
    }

    res.json({ results });
  } catch (err: any) {
    logger.error({ err }, 'Draft email route failed');
    res.status(500).json({ error: err.message || 'Failed to send draft emails' });
  }
});

export default router;
