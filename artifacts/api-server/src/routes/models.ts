import { Router } from 'express';
import { db } from '../lib/firebase.js';

const router = Router();

// GET /api/routes/:routeId/models
router.get('/routes/:routeId/models', async (req, res) => {
  try {
    const { routeId } = req.params;
    const snap = await db
      .collection('models')
      .where('routeId', '==', routeId)
      .get();
    const models = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => (b.createdAt > a.createdAt ? 1 : -1));
    res.json(models);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes/:routeId/models
router.post('/routes/:routeId/models', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { name, productionName, totalAmount, advance, ownerName } = req.body;
    const now = new Date().toISOString();

    const advancePayments =
      advance && Number(advance) > 0
        ? [{ id: `ap_${Date.now()}`, amount: Number(advance), date: now, note: 'Initial advance' }]
        : [];

    const data = {
      routeId,
      name,
      productionName: productionName || '',
      totalAmount: Number(totalAmount) || 0,
      ownerName: ownerName || '',
      advancePayments,
      tasks: [],
      status: 'in_progress',
      createdAt: now,
    };

    const ref = await db.collection('models').add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/models/:modelId  (update name / productionName / totalAmount / ownerName)
router.patch('/models/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const updates = req.body;
    await db.collection('models').doc(modelId).update(updates);
    res.json({ id: modelId, ...updates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/models/:modelId
router.delete('/models/:modelId', async (req, res) => {
  try {
    await db.collection('models').doc(req.params.modelId).delete();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/models/:modelId/advance  — add a payment instalment
router.post('/models/:modelId/advance', async (req, res) => {
  try {
    const ref = db.collection('models').doc(req.params.modelId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Model not found' });

    const payment = {
      id: `ap_${Date.now()}`,
      amount: Number(req.body.amount),
      date: new Date().toISOString(),
      note: req.body.note || '',
    };
    const advancePayments = [...(doc.data()!.advancePayments || []), payment];
    await ref.update({ advancePayments });
    res.status(201).json(payment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/models/:modelId/tasks  — add a task
router.post('/models/:modelId/tasks', async (req, res) => {
  try {
    const ref = db.collection('models').doc(req.params.modelId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Model not found' });

    const task = {
      id: `t_${Date.now()}`,
      title: req.body.title,
      done: false,
      createdAt: new Date().toISOString(),
    };
    const tasks = [...(doc.data()!.tasks || []), task];
    const allDone = tasks.length > 0 && tasks.every((t: any) => t.done);
    await ref.update({ tasks, status: allDone ? 'delivered' : 'in_progress' });
    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/models/:modelId/tasks/:taskId  — toggle done
router.patch('/models/:modelId/tasks/:taskId', async (req, res) => {
  try {
    const { modelId, taskId } = req.params;
    const ref = db.collection('models').doc(modelId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Model not found' });

    const tasks = (doc.data()!.tasks || []).map((t: any) =>
      t.id === taskId ? { ...t, done: req.body.done } : t,
    );
    const allDone = tasks.length > 0 && tasks.every((t: any) => t.done);
    const status = allDone ? 'delivered' : 'in_progress';
    await ref.update({ tasks, status });
    res.json({ taskId, done: req.body.done, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
