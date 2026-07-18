import { Router } from 'express';
import { db } from '../lib/firebase.js';

const router = Router();

// GET /api/routes/:routeId/buyers
router.get('/routes/:routeId/buyers', async (req, res) => {
  try {
    const { routeId } = req.params;
    const snap = await db
      .collection('buyers')
      .where('routeId', '==', routeId)
      .orderBy('createdAt', 'desc')
      .get();
    const buyers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(buyers);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch buyers', detail: err.message });
  }
});

// POST /api/routes/:routeId/buyers  (single)
router.post('/routes/:routeId/buyers', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { name, email, phone, address, fareAmount, routeVersionId, status, notes } = req.body;
    const now = new Date().toISOString();

    const buyerData = {
      routeId,
      routeVersionId: routeVersionId || '',
      name: name || 'Unknown',
      email: email || null,
      phone: phone || '',
      address: address || '',
      fareAmount: Number(fareAmount) || 0,
      status: status || 'active',
      joinDate: now.split('T')[0],
      notes: notes || '',
      emailSent: false,
      emailSentAt: null,
      createdAt: now,
    };

    const ref = await db.collection('buyers').add(buyerData);
    res.status(201).json({ id: ref.id, ...buyerData });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add buyer', detail: err.message });
  }
});

// POST /api/routes/:routeId/buyers/batch  (CSV import)
router.post('/routes/:routeId/buyers/batch', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { buyers } = req.body as { buyers: any[] };
    const now = new Date().toISOString();

    const batch = db.batch();
    const created: any[] = [];

    for (const b of buyers) {
      const ref = db.collection('buyers').doc();
      const data = {
        routeId,
        routeVersionId: b.routeVersionId || '',
        name: b.name || 'Unknown',
        email: b.email || null,
        phone: b.phone || '',
        address: b.address || '',
        fareAmount: Number(b.fareAmount) || 0,
        status: (b.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
        joinDate: now.split('T')[0],
        notes: b.notes || 'Imported via CSV',
        emailSent: false,
        emailSentAt: null,
        createdAt: now,
      };
      batch.set(ref, data);
      created.push({ id: ref.id, ...data });
    }

    await batch.commit();
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to import buyers', detail: err.message });
  }
});

// PATCH /api/buyers/:id
router.patch('/buyers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    await db.collection('buyers').doc(id).update(updates);
    res.json({ id, ...updates });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update buyer', detail: err.message });
  }
});

// DELETE /api/buyers/:id
router.delete('/buyers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('buyers').doc(id).delete();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete buyer', detail: err.message });
  }
});

export default router;
