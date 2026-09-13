import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../lib/firebase.js';

const sessions = new Map<string, { username: string; expiresAt: number }>();

export function createManagerSession(username: string) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  return token;
}

export async function requireManagerAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Route manager login required' });

  try {
    const session = sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      sessions.delete(token);
      return res.status(401).json({ error: 'Your manager session has expired' });
    }
    const manager = await findManager(session.username);
    if (!manager) return res.status(403).json({ error: 'This account is not a route manager' });
    res.locals.manager = { username: session.username };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unable to verify manager session' });
  }
}

export async function findManager(username: string, password?: string) {
  const snap = await db.collection('users').where('username', '==', username).limit(1).get();
  const doc = snap.empty
    ? (await db.collection('users').where('userbase.username', '==', username).limit(1).get()).docs[0]
    : snap.docs[0];
  if (!doc) return null;
  const data = doc.data();
  const storedPassword = String(data.password ?? data.userbase?.password ?? '');
  const active = data.active !== false && String(data.role ?? data.userbase?.role ?? 'route_manager') === 'route_manager';
  if (!active || (password !== undefined && storedPassword !== password)) return null;
  return { id: doc.id, username };
}