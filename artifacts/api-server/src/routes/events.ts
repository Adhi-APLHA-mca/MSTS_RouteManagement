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
    const publicView = _req.query.public === '1';
    const events = await Promise.all(snap.docs
      .map(async doc => {
        const data = doc.data();
        let trains = Array.isArray(data.trains) ? data.trains : [];
        if (publicView && trains.length) {
          const registrations = await db.collection('eventRegistrations')
            .where('eventId', '==', doc.id)
            .get();
          const occupied = new Set(registrations.docs.map(registration => String(registration.data().trainName || '').trim().toLowerCase()));
          trains = trains.filter((train: any) => !occupied.has(String(train.name || '').trim().toLowerCase()));
        }
        return {
          id: doc.id,
          ...data,
          trains: publicView
            ? trains.map((train: any) => ({
                name: String(train.name || ''),
                startPoint: String(train.startPoint || ''),
                endPoint: String(train.endPoint || ''),
              }))
            : trains,
          registeredCount: Number(data.registeredCount || 0),
        };
      })
      )
      .then(items => items.sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))));
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

// GET /api/events/:id/registration?username=... — participant's own pass
router.get('/events/:id/registration', async (req, res) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const eventDoc = await db.collection('events').doc(req.params.id).get();
    if (!eventDoc.exists) return res.status(404).json({ error: 'Event not found' });

    const snap = await db.collection('eventRegistrations')
      .where('eventId', '==', req.params.id)
      .get();
    const registrationDoc = snap.docs.find(doc => doc.data().username === username);
    if (!registrationDoc) return res.status(404).json({ error: 'Registration not found' });

    const registration = registrationDoc.data();
    const train = Array.isArray(eventDoc.data()?.trains)
      ? eventDoc.data()?.trains.find((item: any) => item.name === registration.trainName)
      : null;

    return res.json({
      id: registrationDoc.id,
      ...registration,
      driveLink: String(train?.driveLink || ''),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load registration', detail: err.message });
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
      const selectedTrain = Array.isArray(data.trains)
        ? data.trains.find((train: any) => train.name === String(req.body.trainName || '').trim())
        : null;
      if (!selectedTrain) throw new Error('TRAIN_NOT_FOUND');
      const existingTrain = await transaction.get(
        db.collection('eventRegistrations')
          .where('eventId', '==', req.params.id)
          .where('trainName', '==', selectedTrain.name)
          .limit(1),
      );
      if (!existingTrain.empty) throw new Error('TRAIN_ALREADY_ASSIGNED');
      if (!String(selectedTrain.startPoint || '').trim()) throw new Error('START_NOT_CONFIGURED');
      if (!String(selectedTrain.endPoint || '').trim()) throw new Error('END_NOT_CONFIGURED');

      const registration = {
        eventId: req.params.id,
        username,
        name: String(req.body.name || req.body.username || '').trim(),
        email: String(req.body.email || '').trim(),
        phone: String(req.body.phone || '').trim(),
        trainName: selectedTrain.name,
        startPoint: String(selectedTrain.startPoint).trim(),
        endPoint: String(selectedTrain.endPoint).trim(),
        createdAt: now.toISOString(),
      };
      if (!registration.name) throw new Error('NAME_REQUIRED');
      if (!registration.trainName) throw new Error('TRAIN_REQUIRED');
      transaction.set(registrationRef, registration);
      transaction.update(eventRef, { registeredCount: registeredCount + 1, updatedAt: now.toISOString() });
      return { ...registration, driveLink: String(selectedTrain.driveLink || ''), id: registrationRef.id };
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
      TRAIN_ALREADY_ASSIGNED: [409, 'This train is already assigned to another person'],
      START_NOT_CONFIGURED: [409, 'This train has no start point configured'],
      END_NOT_CONFIGURED: [409, 'This train has no end point configured'],
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