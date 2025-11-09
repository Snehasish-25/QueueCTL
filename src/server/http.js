
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import cfg from '../config/index.js';
import { listJobs, status } from '../services/queue.js';
import { readDLQ } from '../services/storage.js';
import { startWorkers, stopWorkers } from '../services/worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());


app.get('/api/status', (req, res) => {
  try {
    const s = status();
    const { RUN_DIR } = cfg.getConfig();
    const workers = fs.existsSync(RUN_DIR)
      ? fs.readdirSync(RUN_DIR)
          .filter(f => f.startsWith('worker-') && f.endsWith('.pid'))
          .map(f => Number(f.match(/worker-(\d+)\.pid/)[1]))
      : [];
    res.json({ ...s, workers });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.get('/api/jobs', (req, res) => {
  try {
    const { state = 'all' } = req.query;
    const jobs = listJobs(state);
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});


app.get('/api/dlq', (req, res) => {
  try {
    res.json(readDLQ());
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});


app.post('/api/workers/start', async (req, res) => {
  try {
    const count = Number(req.query.count || 1);
    const pids = await startWorkers(count);
    res.json({ started: pids });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.post('/api/workers/stop', (req, res) => {
  try {
    const killed = stopWorkers();
    res.json({ stopped: killed });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});


const publicDir = path.resolve(__dirname, '../../public');
app.use(express.static(publicDir));


app.use((_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = Number(process.env.DASHBOARD_PORT || 3000);
const HOST = process.env.DASHBOARD_HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log(`queuectl dashboard listening on http://${HOST}:${PORT}`);
});
