export function nowISO() {
  return new Date().toISOString();
}

export function validateJob(j) {
  if (!j || typeof j !== 'object') throw new Error('Job must be an object');
  if (!j.id) throw new Error('Job.id is required');
  if (!j.command) throw new Error('Job.command is required');
}

export function normalizeJob(input, defaults) {
  validateJob(input);
  const created = new Date().toISOString();
  const job = {
    id: input.id,
    command: input.command,
    state: 'pending',
    attempts: 0,
    max_retries: input.max_retries ?? defaults.MAX_RETRIES,
    created_at: input.created_at || created,
    updated_at: input.updated_at || created,
    next_run_at: input.next_run_at || created,
    output: '', 
    priority: input.priority || 0, 
    timeout_ms: input.timeout_ms || defaults.JOB_TIMEOUT_MS,
  };
  return job;
}
