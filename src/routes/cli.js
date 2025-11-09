import fs from 'fs';
import path from 'path';
import cfg from '../config/index.js';
import { enqueue, listJobs, status } from '../services/queue.js';
import { startWorkers, stopWorkers, workerLoop } from '../services/worker.js';
import { readDLQ } from '../services/storage.js';
import { retryDLQ } from '../services/queue.js';

function printHelp() {
  console.log(`
queuectl <command>

Commands:
  enqueue <json>                     Add a new job
  worker start [--count N]           Start N workers (default 1)
  worker stop                        Stop running workers gracefully
  status                             Show summary + worker PIDs
  list [--state <state>]             List jobs by state
  dlq list                           Show DLQ jobs
  dlq retry <id>                     Move a DLQ job back to queue
  config get [key]                   Show config
  config set <key> <value>           Update config
  --help                             Show this help
`);
}

export default async function handleCLI(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }

  if (cmd === 'enqueue') {
    const raw = rest.join(' ').trim();
    if (!raw) throw new Error('Provide a JSON payload');
    const job = JSON.parse(raw);
    const res = enqueue(job);
    console.log('Enqueued:', res);
    return;
  }


  if (cmd === 'worker') {
    const action = rest[0];
    const args = rest.slice(1);

    if (action === 'start') {
      let count = 1;
      const idx = args.indexOf('--count');
      if (idx !== -1 && args[idx + 1]) count = Number(args[idx + 1]);
      const pids = await startWorkers(count);
      console.log('Workers started:', pids);
      return;
    }

    if (action === 'stop') {
      const killed = stopWorkers();
      console.log('Workers stopped:', killed);
      return;
    }
  }

 
  if (cmd === '__worker__') {
    await workerLoop();
    return;
  }


  if (cmd === 'status') {
    const st = status();
    const { RUN_DIR } = cfg.getConfig();
    const pids = fs.existsSync(RUN_DIR)
      ? fs.readdirSync(RUN_DIR)
          .filter(f => f.startsWith('worker-') && f.endsWith('.pid'))
          .map(f => Number(f.match(/worker-(\d+)\.pid/)[1]))
      : [];
    console.log(JSON.stringify({ ...st, workers: pids }, null, 2));
    return;
  }


  if (cmd === 'list') {
    let state = 'all';
    const idx = rest.indexOf('--state');
    if (idx !== -1 && rest[idx + 1]) state = rest[idx + 1];
    const jobs = listJobs(state);
    console.log(JSON.stringify(jobs, null, 2));
    return;
  }


  if (cmd === 'dlq') {
    const action = rest[0];
    if (action === 'list') {
      const dlq = readDLQ();
      console.log(JSON.stringify(dlq, null, 2));
      return;
    }
    if (action === 'retry') {
      const id = rest[1];
      if (!id) throw new Error('Provide job id');
      const job = retryDLQ(id);
      console.log('Requeued from DLQ:', job);
      return;
    }
  }

  
  if (cmd === 'config') {
    const action = rest[0];

    if (action === 'get') {
      const key = rest[1];
      const conf = cfg.getConfig();
      if (key) {
        console.log(JSON.stringify({ [key]: conf[key] }, null, 2));
      } else {
        console.log(JSON.stringify(conf, null, 2));
      }
      return;
    }

    if (action === 'set') {
      const key = rest[1];
      const value = rest[2];
      if (!key || value === undefined) throw new Error('Usage: queuectl config set <key> <value>');
      let parsed = value;
      if (!isNaN(Number(value))) parsed = Number(value);
      const conf = cfg.setConfigKey(key, parsed);
      console.log('Updated config:', key, '=>', parsed);
      console.log(JSON.stringify(conf, null, 2));
      return;
    }
  }

  printHelp();
  process.exitCode = 1;
}
