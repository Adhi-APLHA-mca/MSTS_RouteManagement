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

export default router;
