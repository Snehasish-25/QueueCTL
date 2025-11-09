
const $ = (s) => document.querySelector(s);

const state = {
  activeTab: 'pending',
  timer: null,
};

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

function setCounts(s) {
  $('#total').textContent = s.total ?? 0;

  const c = s.counts || {};
  $('#completed').textContent = c.completed ?? 0;
  $('#failed').textContent = c.failed ?? 0;
  $('#dead').textContent = c.dead ?? 0;
  $('#processing').textContent = c.processing ?? 0;
  $('#pending').textContent = c.pending ?? 0;

  const workers = (s.workers || []).join(', ');
  $('#workers').textContent = workers || '—';
}

async function fetchStatus() {
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error('status failed');
  return res.json();
}

async function fetchJobs(tab) {
  const res = await fetch(`/api/jobs?state=${encodeURIComponent(tab)}`);
  if (!res.ok) throw new Error('jobs failed');
  return res.json();
}

async function fetchDLQ() {
  const res = await fetch('/api/dlq');
  if (!res.ok) throw new Error('dlq failed');
  return res.json();
}

function renderRows(items) {
  const body = $('#rows');
  if (!items || !items.length) {
    body.innerHTML = `<tr><td colspan="5" class="muted">No rows</td></tr>`;
    return;
  }
  body.innerHTML = items.map(j => `
    <tr>
      <td class="mono">${j.id}</td>
      <td>${j.state}</td>
      <td>${j.attempts ?? 0}</td>
      <td class="clip mono" title="${j.command}">${j.command}</td>
      <td>${fmtTime(j.updated_at)}</td>
    </tr>
  `).join('');
}

async function refresh() {
  try {
    const [s] = await Promise.all([fetchStatus()]);
    setCounts(s);

    let rows = [];
    if (state.activeTab === 'dead') {
      rows = await fetchDLQ();
    } else {
      rows = await fetchJobs(state.activeTab);
    }
    renderRows(rows);
    $('#last-updated').textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    console.error(e);
  }
}

function wireTabs() {
  document.querySelectorAll('.tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;
      refresh();
    });
  });
}

function wireControls() {
  $('#start1').addEventListener('click', async () => {
    await fetch('/api/workers/start?count=1', { method: 'POST' });
    refresh();
  });
  $('#stopAll').addEventListener('click', async () => {
    await fetch('/api/workers/stop', { method: 'POST' });
    refresh();
  });
}

function boot() {
  wireTabs();
  wireControls();
  refresh();
  state.timer = setInterval(refresh, 2000);
}

document.addEventListener('DOMContentLoaded', boot);
