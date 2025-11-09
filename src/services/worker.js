import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import cfg from '../config/index.js';
import { fetchAndMarkProcessing, markFailure, markSuccess } from './queue.js';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function startWorkers(count = 1) {
  const { RUN_DIR } = cfg.getConfig();
  const pids = [];
  for (let i = 0; i < count; i++) {
    const child = exec(`node ${path.resolve('./bin/queuectl.js')} __worker__`, {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    const pid = child.pid;
    pids.push(pid);
    fs.writeFileSync(path.join(RUN_DIR, `worker-${pid}.pid`), '');
  }
  return pids;
}

export function stopWorkers() {
  const { RUN_DIR } = cfg.getConfig();
  const files = fs.readdirSync(RUN_DIR).filter(f => f.startsWith('worker-') && f.endsWith('.pid'));
  const killed = [];
  for (const f of files) {
    const pid = Number(f.match(/worker-(\d+)\.pid/)[1]);
    try {
      process.kill(pid, 'SIGTERM');
      killed.push(pid);
    } catch (e) {
      
    }
    try { fs.unlinkSync(path.join(RUN_DIR, f)); } catch {}
  }
  return killed;
}

export async function workerLoop() {
  const cfgAll = cfg.getConfig();
  const workerId = String(process.pid);
  let shouldStop = false;

  process.on('SIGTERM', () => { shouldStop = true; });

  while (!shouldStop) {
    const job = fetchAndMarkProcessing(workerId);
    if (!job) {
      await sleep(cfgAll.JOB_POLL_INTERVAL_MS);
      continue;
    }

    await runOne(job, cfgAll);
  }
}

async function runOne(job, conf) {
  let finished = false;
  let timedOut = false;
  let output = '';

  const child = exec(job.command, { timeout: job.timeout_ms || conf.JOB_TIMEOUT_MS }, (err, stdout, stderr) => {
    output = (stdout || '') + (stderr ? ('\n' + stderr) : '');
    finished = true;
    if (err) {
     
    }
  });

  const startedAt = Date.now();
  while (!finished) {
    await new Promise(r => setTimeout(r, 50));
    if (Date.now() - startedAt > (job.timeout_ms || conf.JOB_TIMEOUT_MS)) {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch {}
      break;
    }
  }

  if (timedOut) {
    markFailure(job.id, `Timeout after ${(job.timeout_ms || conf.JOB_TIMEOUT_MS)}ms`);
  } else {
   
    const code = child.exitCode;
    if (code === 0) {
      markSuccess(job.id, output);
    } else {
      markFailure(job.id, `Exit code ${code ?? 'non-zero'}; output: ${output.slice(0, 1000)}`);
    }
  }
}
