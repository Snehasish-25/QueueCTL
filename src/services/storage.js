import fs from 'fs';
import cfg from '../config/index.js';

const { JOBS_FILE, DLQ_FILE } = cfg.files;

function initIfMissing() {
  if (!fs.existsSync(JOBS_FILE)) fs.writeFileSync(JOBS_FILE, '[]');
  if (!fs.existsSync(DLQ_FILE)) fs.writeFileSync(DLQ_FILE, '[]');
}
initIfMissing();

export function readJobs() {
  try {
    const txt = fs.readFileSync(JOBS_FILE, 'utf8');
    return txt ? JSON.parse(txt) : [];
  } catch {
    return [];
  }
}

export function writeJobs(jobs) {
  const tmp = JOBS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(jobs, null, 2));
  fs.renameSync(tmp, JOBS_FILE);
}

export function readDLQ() {
  try {
    const txt = fs.readFileSync(DLQ_FILE, 'utf8');
    return txt ? JSON.parse(txt) : [];
  } catch {
    return [];
  }
}

export function writeDLQ(jobs) {
  const tmp = DLQ_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(jobs, null, 2));
  fs.renameSync(tmp, DLQ_FILE);
}
