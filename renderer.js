const AGENTS_URL = '../agents_config.json';
const BACKEND_HTTP = 'http://localhost:8765';

let AGENTS = {};
let orderedIds = [];

const MASCOT_SVG = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="34" r="18" fill="currentColor"/>
    <path d="M20 90 Q20 55 50 55 Q80 55 80 90 Z" fill="currentColor"/>
  </svg>`;

// per-skin accent color, standing in for a full outfit layer for now
const SKIN_COLOR = {
  suit: '#5b6fa8',
  casual: '#7fbf8f',
  beach: '#e8c15a',
  dress: '#d97fb0',
  corporate: '#8a86b8',
};

async function loadConfig() {
  const res = await fetch(AGENTS_URL);
  AGENTS = await res.json();
  orderedIds = Object.keys(AGENTS);
  buildGrid();
  buildInputDock();
}

function buildGrid() {
  const grid = document.getElementById('agent-grid');
  grid.innerHTML = '';

  for (const id of orderedIds) {
    const cfg = AGENTS[id];
    const slot = document.createElement('div');
    slot.className = 'agent-slot' + (cfg.position === 'center' ? ' center' : '');
    slot.id = `slot-${id}`;

    const mascot = document.createElement('div');
    mascot.className = 'mascot idle';
    mascot.id = `mascot-${id}`;
    mascot.style.color = SKIN_COLOR[cfg.defaultSkin] || '#8a86b8';
    mascot.innerHTML = MASCOT_SVG;

    const name = document.createElement('div');
    name.className = 'agent-name';
    name.textContent = cfg.displayName;

    slot.appendChild(mascot);
    slot.appendChild(name);
    grid.appendChild(slot);
  }
}

function setState(agentId, state) {
  // states: idle | listening | working | awaiting-approval
  const el = document.getElementById(`mascot-${agentId}`);
  if (!el) return;
  el.classList.remove('idle', 'listening', 'working', 'awaiting-approval');
  el.classList.add(state);
}

// ---- Council chain-in-circle ----

function drawCouncilChain(activeIds) {
  const svg = document.getElementById('chain-layer');
  svg.innerHTML = '';
  const centers = activeIds
    .map((id) => document.getElementById(`mascot-${id}`))
    .filter(Boolean)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const stage = document.querySelector('.stage').getBoundingClientRect();
      return { x: r.left + r.width / 2 - stage.left, y: r.top + r.height / 2 - stage.top };
    });

  for (let i = 0; i < centers.length; i++) {
    const a = centers[i];
    const b = centers[(i + 1) % centers.length];
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    svg.appendChild(line);
  }
}

function clearCouncilChain() {
  document.getElementById('chain-layer').innerHTML = '';
}

// ---- Backend event handling ----

window.hermes.onBusEvent((data) => {
  switch (data.type) {
    case 'wake':               // wake word for an agent detected
      setState(data.agent, 'listening');
      break;
    case 'agent_working':
      setState(data.agent, 'working');
      break;
    case 'agent_idle':
      setState(data.agent, 'idle');
      break;
    case 'agent_needs_approval':
      setState(data.agent, 'awaiting-approval');
      break;
    case 'council_start':
      drawCouncilChain(orderedIds.filter((id) => AGENTS[id].position !== 'center'));
      orderedIds.forEach((id) => setState(id, 'working'));
      break;
    case 'council_end':
      clearCouncilChain();
      orderedIds.forEach((id) => setState(id, 'idle'));
      break;
    default:
      break;
  }
});

// ---- Input dock ----

function buildInputDock() {
  const dock = document.getElementById('input-dock');
  dock.innerHTML = '';

  const select = document.createElement('select');
  for (const id of orderedIds) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = AGENTS[id].displayName;
    select.appendChild(opt);
  }
  const councilOpt = document.createElement('option');
  councilOpt.value = '__council__';
  councilOpt.textContent = 'AI Council (all agents)';
  select.appendChild(councilOpt);

  const input = document.createElement('input');
  input.placeholder = 'Type a message, or press Enter to send...';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const target = select.value;
      window.hermes.sendToAgent(target, input.value.trim());
      input.value = '';
    }
  });

  dock.appendChild(select);
  dock.appendChild(input);
}

document.getElementById('dashboard-btn').addEventListener('click', () => {
  window.hermes.openDashboard();
});

// ---- Side panels ----

document.querySelectorAll('.panel-right .tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.panel-right .tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-body').forEach((b) => b.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-view`).classList.add('active');
  });
});

async function refreshVault() {
  try {
    const res = await fetch(`${BACKEND_HTTP}/vault`);
    const data = await res.json();
    document.getElementById('vault-view').textContent = data.files.join('\n');
  } catch (e) {
    document.getElementById('vault-view').textContent = '(vault backend not reachable yet)';
  }
}

async function refreshSync() {
  try {
    const res = await fetch(`${BACKEND_HTTP}/context`);
    const data = await res.json();
    document.getElementById('sync-view').textContent = data.content;
  } catch (e) {
    document.getElementById('sync-view').textContent = '(shared context file not reachable yet)';
  }
}

loadConfig();
refreshVault();
refreshSync();
setInterval(refreshSync, 4000);
