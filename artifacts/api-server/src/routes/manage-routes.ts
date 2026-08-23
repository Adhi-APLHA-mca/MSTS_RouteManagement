import { Router } from 'express';
import { db } from '../lib/firebase.js';

const router = Router();

// GET /api/manage-routes
router.get('/manage-routes', async (_req, res) => {
  try {
    const [usersSnap, routesSnap, assignmentsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('routes').get(),
      db.collection('routeAssignments').get(),
    ]);
    const assignments = new Map(assignmentsSnap.docs.map(doc => [doc.id, doc.data()]));
    const users = usersSnap.docs.map(doc => {
      const data = doc.data();
      const assignment = assignments.get(doc.id) || {};
      return {
        id: doc.id,
        username: data.userbase?.username || '',
        accountStatus: data.status?.account || '',
        deviceStatus: data.status?.device || '',
        routeIds: assignment.routeIds || [],
      };
    });
    const routes = routesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ users, routes });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load route management data', detail: err.message });
  }
});

// PATCH /api/manage-routes/users/:userId/status
router.patch('/manage-routes/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    const { account, device } = req.body;
    const updates: Record<string, string> = {};
    if (account) updates['status.account'] = account;
    if (device) updates['status.device'] = device;
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No status changes provided' });
    await db.collection('users').doc(userId).update(updates);
    res.json({ success: true, account, device });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user status', detail: err.message });
  }
});

// PUT /api/manage-routes/users/:userId/routes
router.put('/manage-routes/users/:userId/routes', async (req, res) => {
  try {
    const { userId } = req.params;
    const routeIds = Array.isArray(req.body.routeIds) ? req.body.routeIds : [];
    const data = { userId, routeIds, updatedAt: new Date().toISOString() };
    await db.collection('routeAssignments').doc(userId).set(data);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save route assignments', detail: err.message });
  }
});

export default router;