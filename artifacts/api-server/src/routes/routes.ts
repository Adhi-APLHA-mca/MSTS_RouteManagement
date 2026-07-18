import { Router } from 'express';
import { db } from '../lib/firebase.js';

const router = Router();

// GET /api/routes
router.get('/', async (_req, res) => {
  try {
    const snap = await db.collection('routes').orderBy('createdAt', 'desc').get();
    const routes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(routes);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch routes', detail: err.message });
  }
});

// POST /api/routes
router.post('/', async (req, res) => {
  try {
    const { name, code, whatsappGroupLink, driveFolderLink, versionLabel, versionDesc } = req.body;
    const now = new Date().toISOString();

    const routeData = {
      name,
      code,
      whatsappGroupLink: whatsappGroupLink || null,
      driveFolderLink: driveFolderLink || null,
      versions: [
        {
          id: `v_${Date.now()}`,
          label: versionLabel || 'v1',
          description: versionDesc || '',
          isActive: true,
          createdAt: now,
        },
      ],
      createdAt: now,
    };

    const ref = await db.collection('routes').add(routeData);
    res.status(201).json({ id: ref.id, ...routeData });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create route', detail: err.message });
  }
});

// PUT /api/routes/:id  (update name/code/links)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    await db.collection('routes').doc(id).update(updates);
    res.json({ id, ...updates });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update route', detail: err.message });
  }
});

// POST /api/routes/:id/versions  (add a new version to an existing route)
router.post('/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const { label, description } = req.body;

    const routeRef = db.collection('routes').doc(id);
    const routeDoc = await routeRef.get();
    if (!routeDoc.exists) return res.status(404).json({ error: 'Route not found' });

    const route = routeDoc.data()!;
    const newVersion = {
      id: `v_${Date.now()}`,
      label,
      description: description || '',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    await routeRef.update({ versions: [...(route.versions || []), newVersion] });
    res.status(201).json(newVersion);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add version', detail: err.message });
  }
});

export default router;
