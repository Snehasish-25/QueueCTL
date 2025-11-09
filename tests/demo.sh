
set -euo pipefail

echo "== Clean =="?
rm -f run/worker-*.pid || true
rm -f run/locks/*.lock || true
rm -f data/jobs.json || true
rm -f data/dlq.json || true
mkdir -p data run run/locks

echo "== Enqueue jobs =="
node bin/queuectl.js enqueue '{"id":"ok1","command":"node -e \"console.log(41+1)\"","max_retries":2}'
node bin/queuectl.js enqueue '{"id":"bad1","command":"bash -c \"exit 1\"","max_retries":2}'
node bin/queuectl.js enqueue '{"id":"sleep1","command":"sleep 1","max_retries":2}'

echo "== Start workers =="
node bin/queuectl.js worker start --count 2

echo "== Status =="
node bin/queuectl.js status

echo "== Wait 3s =="
sleep 3

echo "== Status after first pass =="
node bin/queuectl.js status
node bin/queuectl.js list --state completed
node bin/queuectl.js list --state failed

echo "== Stop workers =="
node bin/queuectl.js worker stop || true

echo "== Force time to pass for backoff (wait 5s) =="
sleep 5

echo "== Restart one worker to process retries =="
node bin/queuectl.js worker start --count 1
sleep 3
node bin/queuectl.js worker stop || true

echo "== DLQ list (bad1 expected eventually) =="
node bin/queuectl.js dlq list

echo "== Retry DLQ if present =="
if node -e 'const dlq=require("./data/dlq.json"); if(dlq.find(j=>j.id==="bad1")) process.exit(0); process.exit(1)'; then
  node bin/queuectl.js dlq retry bad1
  node bin/queuectl.js worker start --count 1
  sleep 2
  node bin/queuectl.js worker stop || true
fi

echo "== Final status =="
node bin/queuectl.js status
