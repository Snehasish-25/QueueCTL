# queuectl — Background Job Queue System

`Queuectl` is a **CLI-based background job queue system** built with **Node.js**, designed for reliable job execution, retry handling, and monitoring — all without requiring any external databases.  

It includes:
- Concurrent worker processes  
- Exponential backoff retries  
- Persistent JSON-based storage  
- Dead Letter Queue (DLQ)  
- Graceful shutdown and configuration management  
- A **real-time web dashboard** for monitoring jobs and workers  

---

## 1.Setup Instructions

### Prerequisites
- Node.js ≥ 18  
- npm ≥ 9  

### Installation
```bash
git clone https://github.com/Snehasish-25/QueueCTL.git
cd queuectl
npm install
```

### Optional: Link the CLI globally
```bash
npm link
```

Now you can use `queuectl` from anywhere:
```bash
queuectl --help
```

### Environment Setup
Copy the default configuration:
```bash
cp config/.env.example .env
```

`.env` contains configurable options such as:
```
DATA_DIR=./data
RUN_DIR=./run
BACKOFF_BASE=2
MAX_RETRIES=3
JOB_TIMEOUT_MS=60000
```

---

## 2. Usage Examples

Below are common real-world usage examples of the CLI.

### Enqueue a new job
```bash
queuectl enqueue '{"id":"job1","command":"echo \"Hello World\""}'
```

**Output:**
```json
{
  "id": "job1",
  "command": "echo \"Hello World\"",
  "state": "pending",
  "attempts": 0,
  "max_retries": 3
}
```

---

### Start and stop workers
```bash
# Start 3 workers
queuectl worker start --count 3

# Stop all workers gracefully
queuectl worker stop
```

**Output:**
```
Workers started: [ 1048, 1050, 1052 ]
Workers stopped: [ 1048, 1050, 1052 ]
```

---

### Check queue status
```bash
queuectl status
```
**Output:**
```json
{
  "total": 3,
  "counts": {
    "pending": 1,
    "completed": 2
  },
  "workers": [1050, 1052]
}
```

---

### List jobs by state
```bash
queuectl list --state completed
```
**Output:**
```json
[
  {
    "id": "job1",
    "state": "completed",
    "output": "Hello World\n"
  }
]
```

---

### Dead Letter Queue (DLQ)
```bash
queuectl dlq list
queuectl dlq retry job1
```

---

### Configuration management
```bash
queuectl config set MAX_RETRIES 5
queuectl config get MAX_RETRIES
```

**Output:**
```json
{ "MAX_RETRIES": 5 }
```

---

### Web Dashboard (Bonus Feature)
Start the built-in dashboard server:
```bash
npm run dashboard
```
Then open:
```
http://localhost:3000
```

You’ll see:
- Live job counts by state  
- Worker process list  
- Tabs for Pending / Processing / Completed / Failed / DLQ  
- Real-time updates every 2 seconds  
- Start/Stop workers via UI buttons  

---

## 3. Architecture Overview

### Directory Structure
| Path | Description |
|------|--------------|
| `bin/queuectl.js` | CLI entrypoint |
| `src/services/worker.js` | Worker logic (executes jobs, handles retries) |
| `src/services/queue.js` | Queue operations, DLQ management, backoff logic |
| `src/config/index.js` | Config loader (dotenv + JSON overrides) |
| `src/server/http.js` | Web dashboard (Express server) |
| `data/` | JSON storage for jobs and DLQ |
| `run/` | PID and lock files for worker coordination |
| `public/` | Static files for the dashboard (HTML/CSS/JS) |

---

### Job Lifecycle

| State | Description |
|--------|--------------|
| **pending** | Job waiting to be picked by a worker |
| **processing** | A worker is executing the job |
| **completed** | Successfully finished |
| **failed** | Temporary failure, will retry |
| **dead** | Permanently failed, moved to DLQ |

**Flow:**
1. Job added as `pending`
2. Worker fetches job → `processing`
3. Executes command via `child_process.exec`
4. If success → `completed`
5. If failure → increment `attempts`, compute retry delay:  
   `next_run_at = now + BACKOFF_BASE ^ attempts`
6. If `attempts > max_retries` → move to DLQ

---

### Persistence & Concurrency

- **Storage:**  
  Jobs, DLQ, and config are stored as JSON files in `./data/`.  
  This ensures persistence across restarts.

- **Locking:**  
  Workers use file locks (`run/locks/<jobId>.lock`) to prevent duplicate processing.

- **Worker Processes:**  
  Each worker is a child process with its PID stored in `run/worker-<pid>.pid`.

---

### Worker Logic
- Polls `data/jobs.json` for eligible jobs (`state=pending`, `next_run_at <= now`)
- Executes `command` using `exec`
- Handles:
  - Exit code evaluation
  - Timeout (`JOB_TIMEOUT_MS`)
  - Automatic retry with exponential backoff
  - DLQ transfer after final failure

---

## 4.Assumptions & Trade-offs

| Decision | Rationale |
|-----------|------------|
| **JSON storage** | Keeps implementation dependency-free; easy to inspect manually |
| **File locks** | Sufficient for single-machine concurrency; simpler than Redis or DB |
| **CLI & Dashboard share same backend** | Prevents data duplication and ensures consistency |
| **Exponential backoff retries** | Reduces repeated failures and system overload |
| **Single-node design** | Simplicity over distribution; can be extended to Redis or SQLite in future |
| **No external logging library** | Uses job `output` fields for simplicity |

---

## 5.Testing Instructions

### Manual Verification

Run the following step-by-step in **two terminals**:

**Terminal 1 (Dashboard):**
```bash
npm run dashboard
```
→ Open [http://localhost:3000](http://localhost:3000)

**Terminal 2 (CLI):**
```bash
queuectl enqueue '{"id":"ok1","command":"node -p 2+2"}'
queuectl worker start --count 1
sleep 1
queuectl worker stop
queuectl list --state completed
```

**Expected:**
- `ok1` appears under **Completed** in CLI & Dashboard  
- “Completed” count increases on dashboard in real time  

---

### Additional Test Cases

| Case | Expected Outcome |
|------|------------------|
| --> Successful job (`echo`) | Moves to `completed` |
| --> Failing job (`exit 1`) | Retries → DLQ after max retries |
| --> Retry job from DLQ | Moves back to queue and runs again |
| --> Worker crash | Job lock released, job reprocessed later |
| --> Restart CLI | Jobs persist in `data/` and reload |
| --> Scheduled job (`run_at`) | Executes automatically at the future timestamp |
| --> Config changes | Persist across runs (`data/config.json`) |

---

## 📄 License

MIT License  
© 2025 [Snehasish]  
