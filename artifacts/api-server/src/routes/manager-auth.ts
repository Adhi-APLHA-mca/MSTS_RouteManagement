import { Router } from 'express';
import { createManagerSession, findManager } from '../middlewares/manager-auth.js';

const router = Router();

router.post('/manager-auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  try {
    const manager = await findManager(username, password);
    if (!manager) return res.status(401).json({ error: 'Invalid manager username or password' });
    return res.json({ token: createManagerSession(manager.username), username: manager.username });
  } catch (error: any) {
    return res.status(500).json({ error: 'Unable to verify manager login', detail: error.message });
  }
});

export default router;