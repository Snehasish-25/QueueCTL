import { readJobs, writeJobs, readDLQ, writeDLQ } from './storage.js';
import cfg from '../config/index.js';
import { nowISO, normalizeJob, validateJob } from '../models/job.js';
import { tryAcquireJobLock, releaseJobLock } from '../utils/lock.js';

const config = () => cfg.getConfig();

export function enqueue(rawJob) {
  const jobs = readJobs();
  if (jobs.find(j => j.id === rawJob.id)) {
    throw new Error(`Job with id "${rawJob.id}" already exists`);
  }
  const job = normalizeJob(rawJob, config());
  jobs.push(job);
  writeJobs(jobs);
  return job;
}

export function listJobs(state = 'all') {
  const jobs = readJobs();
  if (state === 'all') return jobs;
  return jobs.filter(j => j.state === state);
}

export function status() {
  const jobs = readJobs();
  const counts = jobs.reduce((acc, j) => {
    acc[j.state] = (acc[j.state] || 0) + 1;
    return acc;
  }, {});
  const total = jobs.length;
  return { total, counts };
}

function eligibleJob(j) {
  if (!['pending','failed'].includes(j.state)) return false;
  const now = Date.now();
  const due = new Date(j.next_run_at || j.updated_at || j.created_at).getTime();
  return due <= now;
}

export function fetchAndMarkProcessing(workerId) {
  const jobs = readJobs();
  
  let idx = -1;
  for (let i = 0; i < jobs.length; i++) {
    if (eligibleJob(jobs[i])) { idx = i; break; }
  }
  if (idx === -1) return null;

  const job = jobs[idx];
  
  if (!tryAcquireJobLock(job.id)) {
    return null;
  }

  job.state = 'processing';
  job.locked_by = workerId;
  job.updated_at = nowISO();
  writeJobs(jobs);
  return job;
}

export function markSuccess(jobId, output) {
  const jobs = readJobs();
  const j = jobs.find(x => x.id === jobId);
  if (!j) return;
  j.state = 'completed';
  j.output = output || '';
  j.updated_at = nowISO();
  writeJobs(jobs);
  releaseJobLock(jobId);
}

export function markFailure(jobId, errorMsg) {
  const jobs = readJobs();
  const j = jobs.find(x => x.id === jobId);
  if (!j) return;
  j.attempts += 1;
  j.output = (j.output || '') + `\n[attempt ${j.attempts}] ${errorMsg}`;
  j.updated_at = nowISO();

  const { BACKOFF_BASE } = config();
  const delaySec = Math.pow(BACKOFF_BASE, j.attempts);
  const next = new Date(Date.now() + delaySec * 1000).toISOString();

  if (j.attempts > j.max_retries) {
    j.state = 'dead';
    writeJobs(jobs);
   
    const dlq = readDLQ();
    dlq.push(j);
    writeDLQ(dlq);
   
    writeJobs(jobs.filter(x => x.id != jobId));
  } else {
    j.state = 'failed';
    j.next_run_at = next;
    writeJobs(jobs);
  }
  releaseJobLock(jobId);
}

export function retryDLQ(jobId) {
  const dlq = readDLQ();
  const idx = dlq.findIndex(j => j.id === jobId);
  if (idx === -1) throw new Error('Job not found in DLQ');
  const job = dlq[idx];

  job.state = 'pending';
  job.attempts = 0;
  job.updated_at = nowISO();
  job.next_run_at = job.updated_at;
 
  dlq.splice(idx, 1);
  writeDLQ(dlq);
  const jobs = readJobs();
  if (jobs.find(j => j.id === job.id)) throw new Error('Job id already exists in main queue');
  jobs.push(job);
  writeJobs(jobs);
  return job;
}
