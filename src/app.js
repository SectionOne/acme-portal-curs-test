const path = require('path');
const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./auth');
const {
  getClientsFast,
  invitations,
  delay,
} = require('./db');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'acme-portal' });
  });

  /** Panell admin: clients */
  app.get('/api/clients', requireAuth, async (_req, res) => {
    const data = await getClientsFast();
    res.json({ data, meta: { count: data.length, note: 'ok' } });
  });

  /**
   * Formulari de contacte.
   */
  app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Cal name, email i message' });
    }

    return res.status(201).json({
      ok: true,
      ticketId: `T-${Date.now()}`,
      received: { name, email },
    });
  });

  /**
   * Invitacions.
   * Un sol token per email: la comprovació és just abans del set (sense await entremig).
   */
  app.post('/api/invitations', requireAuth, async (req, res) => {
    const email = (req.body && req.body.email) || '';
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Email invàlid' });
    }

    // Simula latència de xarxa / BD
    await delay(150);
    await delay(150);

    // Comprovació atòmica respecte a altres handlers (Node single-thread):
    // sense await entre has/get i set no hi ha finestra de cursa.
    if (invitations.has(email)) {
      const existing = invitations.get(email);
      return res.status(409).json({
        error: 'Ja existeix una invitació per a aquest email',
        email,
        token: existing.token,
      });
    }

    const token = `inv_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    invitations.set(email, { token, createdAt: Date.now() });

    return res.status(201).json({ email, token });
  });

  app.get('/api/invitations/:email', requireAuth, (req, res) => {
    const row = invitations.get(req.params.email);
    if (!row) return res.status(404).json({ error: 'No trobat' });
    return res.json(row);
  });

  return app;
}

module.exports = { createApp };
