import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const rootDir = path.resolve(process.cwd());
dotenv.config({ path: path.join(rootDir, '.env') });

const env = {
  DATA_DIR: process.env.DATA_DIR || './data',
  RUN_DIR: process.env.RUN_DIR || './run',
  LOG_DIR: process.env.LOG_DIR || './logs',
  MAX_RETRIES: Number(process.env.MAX_RETRIES || 3),
  BACKOFF_BASE: Number(process.env.BACKOFF_BASE || 2),
  JOB_POLL_INTERVAL_MS: Number(process.env.JOB_POLL_INTERVAL_MS || 500),
  JOB_TIMEOUT_MS: Number(process.env.JOB_TIMEOUT_MS || 60000),
};

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

ensureDir(env.DATA_DIR);
ensureDir(env.RUN_DIR);
ensureDir(path.join(env.RUN_DIR, 'locks'));
ensureDir(env.LOG_DIR);

const files = {
  JOBS_FILE: path.join(env.DATA_DIR, 'jobs.json'),
  DLQ_FILE: path.join(env.DATA_DIR, 'dlq.json'),
  CONFIG_FILE: path.join(env.DATA_DIR, 'config.json'),
};

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const txt = fs.readFileSync(file, 'utf8');
    return txt ? JSON.parse(txt) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

function getConfig() {
  const overrides = readJSON(files.CONFIG_FILE, {});
  return {
    ...env,
    ...overrides
  };
}

function setConfigKey(key, value) {
  const overrides = readJSON(files.CONFIG_FILE, {});
  overrides[key] = value;
  writeJSON(files.CONFIG_FILE, overrides);
  return getConfig();
}

export default {
  env,
  files,
  getConfig,
  setConfigKey,
  readJSON,
  writeJSON,
};
