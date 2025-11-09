import fs from 'fs';
import path from 'path';
import cfg from '../config/index.js';

const { RUN_DIR } = cfg.getConfig();
const LOCK_DIR = path.join(RUN_DIR, 'locks');

export function lockFilePath(jobId) {
  return path.join(LOCK_DIR, `${jobId}.lock`);
}

export function tryAcquireJobLock(jobId) {
  const file = lockFilePath(jobId);
  try {
    const fd = fs.openSync(file, 'wx');
    fs.writeFileSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

export function releaseJobLock(jobId) {
  const file = lockFilePath(jobId);
  try { fs.unlinkSync(file); } catch {}
}

export function cleanupStaleLocks(validJobIds) {
  if (!fs.existsSync(LOCK_DIR)) return;
  for (const entry of fs.readdirSync(LOCK_DIR)) {
    const file = path.join(LOCK_DIR, entry);
    const jobId = entry.replace(/\.lock$/, '');
    if (!validJobIds.has(jobId)) {
      try { fs.unlinkSync(file); } catch {}
    }
  }
}
