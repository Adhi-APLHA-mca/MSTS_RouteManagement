import { Router } from 'express';
import { db } from '../lib/firebase.js';

const router = Router();

function eventPayload(body: any, existing: any = {}) {
  const trains = Array.isArray(body.trains)
    ? body.trains
        .filter((train: any) => train?.name?.trim())
        .map((train: any) => ({
          name: String(train.name).trim(),
          driveLink: String(train.driveLink || '').trim(),
          startPoint: String(train.startPoint || '').trim(),
          endPoint: String(train.endPoint || '').trim(),
        }))
    : existing.trains || [];
  const consistRequirements = Array.isArray(body.consistRequirements)
    ? body.consistRequirements.map((item: any) => String(item).trim()).filter(Boolean)
    : existing.consistRequirements || [];

  return {
    name: String(body.name ?? existing.name ?? '').trim(),
    description: String(body.description ?? existing.description ?? '').trim(),
    routeId: String(body.routeId ?? existing.routeId ?? '').trim(),
    capacity: Math.max(1, Number(body.capacity ?? existing.capacity ?? 1)),
    trains,
    consistRequirements,
    expiryDate: String(body.expiryDate ?? existing.expiryDate ?? ''),
    startDateTime: String(body.startDateTime ?? existing.startDateTime ?? ''),
    discordLink: String(body.discordLink ?? existing.discordLink ?? '').trim(),
  };
}

async function findUserByUsername(username: string) {
  const normalized = String(username || '').trim();
  if (!normalized) return null;
  const snap = await db.collection('users').where('userbase.username', '==', normalized).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, username: normalized, data: doc.data() };
}

// POST /api/event-users/login — username-only access for registered Firebase users
router.post('/event-users/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    if (!username) return res.status(400).json({ error: 'Username is required' });
    const user = await findUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'That username is not registered' });
    if (String(user.data.status?.account || '').toLowerCase() === 'banned') {
      return res.status(403).json({ error: 'This account cannot register for events' });
    }
    return res.json({ id: user.id, username: user.username });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to verify username', detail: err.message });
  }
});

// GET /api/events
router.get('/events', async (_req, res) => {
  try {
    const snap = await db.collection('events').get();
    const events = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data(), registeredCount: Number(doc.data().registeredCount || 0) }))
      .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load events', detail: err.message });
  }
});

// POST /api/events
router.post('/events', async (req, res) => {
  try {
    const data = eventPayload(req.body);
    if (!data.name || !data.routeId || !data.expiryDate) {
      return res.status(400).json({ error: 'Name, route, and expiry date are required' });
    }
    const route = await db.collection('routes').doc(data.routeId).get();
    if (!route.exists) return res.status(400).json({ error: 'Selected route was not found' });
    const now = new Date().toISOString();
    const payload = { ...data, registeredCount: 0, createdAt: now, updatedAt: now };
    const ref = await db.collection('events').add(payload);
    return res.status(201).json({ id: ref.id, ...payload });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create event', detail: err.message });
  }
});

// PUT /api/events/:id
router.put('/events/:id', async (req, res) => {
  try {
    const ref = db.collection('events').doc(req.params.id);
    const current = await ref.get();
    if (!current.exists) return res.status(404).json({ error: 'Event not found' });
    const data = eventPayload(req.body, current.data());
    const registeredCount = Number(current.data()?.registeredCount || 0);
    if (data.capacity < registeredCount) {
      return res.status(400).json({ error: `Event already has ${registeredCount} registered people` });
    }
    if (!data.name || !data.routeId || !data.expiryDate) {
      return res.status(400).json({ error: 'Name, route, and expiry date are required' });
    }
    const route = await db.collection('routes').doc(data.routeId).get();
    if (!route.exists) return res.status(400).json({ error: 'Selected route was not found' });
    await ref.update({ ...data, updatedAt: new Date().toISOString() });
    return res.json({ id: ref.id, ...current.data(), ...data, registeredCount });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update event', detail: err.message });
  }
});

// DELETE /api/events/:id
router.delete('/events/:id', async (req, res) => {
  try {
    const eventRef = db.collection('events').doc(req.params.id);
    const event = await eventRef.get();
    if (!event.exists) return res.status(404).json({ error: 'Event not found' });
    const registrations = await db.collection('eventRegistrations').where('eventId', '==', req.params.id).get();
    const batch = db.batch();
    registrations.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(eventRef);
    await batch.commit();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete event', detail: err.message });
  }
});

// GET /api/events/:id/registrations
router.get('/events/:id/registrations', async (req, res) => {
  try {
    const snap = await db.collection('eventRegistrations').where('eventId', '==', req.params.id).get();
    const registrations = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json(registrations);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load registrations', detail: err.message });
  }
});

// POST /api/events/:id/register — capacity is protected by a Firestore transaction
router.post('/events/:id/register', async (req, res) => {
  try {
    const eventRef = db.collection('events').doc(req.params.id);
    const registrationRef = db.collection('eventRegistrations').doc();
    const now = new Date();
    const username = String(req.body.username || '').trim();
    if (!username) throw new Error('USERNAME_REQUIRED');
    const user = await findUserByUsername(username);
    if (!user) throw new Error('USER_NOT_FOUND');
    if (String(user.data.status?.account || '').toLowerCase() === 'banned') {
      throw new Error('USER_BANNED');
    }
    const event = await db.runTransaction(async transaction => {
      const eventDoc = await transaction.get(eventRef);
      if (!eventDoc.exists) throw new Error('EVENT_NOT_FOUND');
      const data = eventDoc.data()!;
      const registeredCount = Number(data.registeredCount || 0);
      if (registeredCount >= Number(data.capacity)) throw new Error('EVENT_FULL');
      if (data.expiryDate && new Date(`${data.expiryDate}T23:59:59`).getTime() < now.getTime()) {
        throw new Error('EVENT_EXPIRED');
      }
      const registration = {
        eventId: req.params.id,
        username,
        name: String(req.body.name || req.body.username || '').trim(),
        email: String(req.body.email || '').trim(),
        phone: String(req.body.phone || '').trim(),
        trainName: String(req.body.trainName || '').trim(),
        startPoint: String(req.body.startPoint || '').trim(),
        endPoint: String(req.body.endPoint || '').trim(),
        createdAt: now.toISOString(),
      };
      if (!registration.name) throw new Error('NAME_REQUIRED');
      if (!registration.trainName) throw new Error('TRAIN_REQUIRED');
      if (!Array.isArray(data.trains) || !data.trains.some((train: any) => train.name === registration.trainName)) {
        throw new Error('TRAIN_NOT_FOUND');
      }
      if (!registration.startPoint) throw new Error('START_REQUIRED');
      if (!registration.endPoint) throw new Error('END_REQUIRED');
      transaction.set(registrationRef, registration);
      transaction.update(eventRef, { registeredCount: registeredCount + 1, updatedAt: now.toISOString() });
      return { ...registration, id: registrationRef.id };
    });
    res.status(201).json(event);
  } catch (err: any) {
    const errors: Record<string, [number, string]> = {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      EVENT_FULL: [409, 'Event capacity is full'],
      EVENT_EXPIRED: [409, 'Event has expired'],
      USERNAME_REQUIRED: [400, 'Username is required'],
      USER_NOT_FOUND: [401, 'That username is not registered'],
      USER_BANNED: [403, 'This account cannot register for events'],
      NAME_REQUIRED: [400, 'Person name is required'],
      TRAIN_REQUIRED: [400, 'Choose a train'],
      TRAIN_NOT_FOUND: [400, 'Choose a train from this event'],
      START_REQUIRED: [400, 'Start point is required'],
      END_REQUIRED: [400, 'End point is required'],
    };
    const [status, message] = errors[err.message] || [500, err.message || 'Failed to register'];
    res.status(status).json({ error: message });
  }
});

// DELETE /api/events/:eventId/registrations/:registrationId
router.delete('/events/:eventId/registrations/:registrationId', async (req, res) => {
  try {
    const eventRef = db.collection('events').doc(req.params.eventId);
    const registrationRef = db.collection('eventRegistrations').doc(req.params.registrationId);
    await db.runTransaction(async transaction => {
      const eventDoc = await transaction.get(eventRef);
      const registrationDoc = await transaction.get(registrationRef);
      if (!registrationDoc.exists || registrationDoc.data()?.eventId !== req.params.eventId) throw new Error('REGISTRATION_NOT_FOUND');
      const count = Number(eventDoc.data()?.registeredCount || 0);
      transaction.delete(registrationRef);
      transaction.update(eventRef, { registeredCount: Math.max(0, count - 1), updatedAt: new Date().toISOString() });
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.message === 'REGISTRATION_NOT_FOUND' ? 404 : 500).json({ error: err.message || 'Failed to remove registration' });
  }
});

export default router;