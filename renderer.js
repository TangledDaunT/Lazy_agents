const AGENTS_URL = 'agents_config.json';
const BACKEND_HTTP = 'http://localhost:8766';

let AGENTS = {};
let orderedIds = [];
let selectedAgent = 'hermes';
const agentStates = {};
const $ = (id) => document.getElementById(id);

async function loadConfig(refresh = false) {
  try {
    const res = await fetch(`${BACKEND_HTTP}/agents_config?ts=${Date.now()}`).catch(() => fetch(AGENTS_URL));
    AGENTS = await res.json();
    orderedIds = Object.keys(AGENTS);
    buildGrid();
    buildInputDock(refresh);
  } catch (error) {
    addActivity('Agent configuration could not be loaded', 'error');
  }
}

function buildGrid() {
  const grid = document.getElementById('agent-grid');
  grid.innerHTML = '';

  for (const id of orderedIds) {
    const cfg = AGENTS[id];
    const slot = document.createElement('div');
    slot.className = 'agent-slot' + (cfg.position === 'center' ? ' center' : '');
    slot.id = `slot-${id}`;
    slot.title = `${cfg.displayName}: ${cfg.role}`;
    slot.addEventListener('click', () => selectAgent(id));

    const mascot = window.MascotSystem.createMascot({
      agentId: id,
      accentColor: cfg.accentColor,
      outfit: cfg.defaultSkin,
      state: agentStates[id] || 'idle',
    });

    const name = document.createElement('div');
    name.className = 'agent-name';
    name.innerHTML = `<strong>${cfg.displayName}</strong><small>${cfg.role.split(' - ')[0]}</small>`;

    slot.appendChild(mascot);
    slot.appendChild(name);
    grid.appendChild(slot);
  }
}

function selectAgent(agentId) {
  selectedAgent = agentId;
  document.querySelectorAll('.agent-slot').forEach((slot) => slot.classList.remove('selected'));
  $(`slot-${agentId}`)?.classList.add('selected');
  const select = $('agent-select');
  if (select) select.value = agentId;
}

function setState(agentId, state) {
  // states: idle | listening | working | awaiting-approval
  agentStates[agentId] = state;
  const el = document.getElementById(`mascot-${agentId}`);
  if (!el) return;
  window.MascotSystem.setState(el, state);
}

function addActivity(message, type = 'info') {
  const feed = $('activity-feed');
  if (!feed) return;
  const item = document.createElement('div');
  item.className = `activity-item ${type}`;
  item.textContent = `${message}  ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  feed.prepend(item);
  while (feed.children.length > 8) feed.lastChild.remove();
}

function renderOutput(text, replace = false) {
  const output = $('response-view');
  if (!output) return;
  if (replace) output.textContent = '';
  if (output.querySelector('.muted')) output.textContent = '';
  output.textContent += text;
  output.scrollTop = output.scrollHeight;
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
  if (data.type === 'bus-status') {
    const label = $('connection-label');
    if (label) {
      label.textContent = data.connected ? 'ONLINE' : 'OFFLINE';
      label.classList.toggle('online', data.connected);
    }
    return;
  }
  switch (data.type) {
    case 'wake':               // wake word for an agent detected
      setState(data.agent, 'listening');
      addActivity(`${AGENTS[data.agent]?.displayName || data.agent} is listening`);
      break;
    case 'agent_working':
      setState(data.agent, 'working');
      if (data.delta) renderOutput(data.delta);
      break;
    case 'agent_idle':
      setState(data.agent, 'idle');
      break;
    case 'agent_needs_approval':
      setState(data.agent, 'awaiting-approval');
      break;
    case 'run_completed':
      renderOutput(`\n\n${data.output || '(No output returned)'}`);
      addActivity(`${AGENTS[data.agent]?.displayName || 'Agent'} completed`, 'done');
      break;
    case 'run_error':
      renderOutput(`\n\n${data.error}`, true);
      addActivity(data.error, 'error');
      break;
    case 'council_start':
      drawCouncilChain(orderedIds.filter((id) => AGENTS[id].position !== 'center'));
      orderedIds.forEach((id) => setState(id, 'working'));
      break;
    case 'council_end':
      clearCouncilChain();
      orderedIds.forEach((id) => setState(id, 'idle'));
      break;
    case 'config_updated':
      if (data.agents) {
        AGENTS = data.agents;
        orderedIds = Object.keys(AGENTS);
        buildGrid();
        buildInputDock(true);
      } else {
        loadConfig(true);
      }
      addActivity('Agent configuration updated', 'done');
      break;
    default:
      break;
  }
});

// ---- Input dock ----

function buildInputDock(refresh = false) {
  const dock = document.getElementById('input-dock');
  dock.innerHTML = '';

  const select = document.getElementById('agent-select') || document.createElement('select');
  select.innerHTML = '';
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

  const input = document.getElementById('message-input') || document.createElement('input');
  input.placeholder = 'Ask the council anything...';
  const send = document.getElementById('send-btn') || document.createElement('button');
  send.textContent = 'SEND';
  if (!select.dataset.bound) {
    send.addEventListener('click', sendMessage);
    select.addEventListener('change', () => { selectedAgent = select.value; });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) sendMessage();
    });
    select.dataset.bound = 'true';
  }

  if (!document.getElementById('agent-select')) dock.appendChild(select);
  if (!document.getElementById('message-input')) dock.appendChild(input);
}

async function sendMessage() {
  const input = $('message-input');
  const target = $('agent-select')?.value || selectedAgent;
  const text = input?.value.trim();
  if (!text) return;
  input.value = '';
  renderOutput(`YOU\n${text}\n\n`, true);
  addActivity(`Message sent to ${target === '__council__' ? 'the council' : AGENTS[target]?.displayName || target}`, 'sent');
  const result = await window.hermes.sendToAgent(target, text);
  if (result?.error) { renderOutput(`Connection error: ${result.error}`, true); addActivity(result.error, 'error'); }
}

document.getElementById('settings-btn')?.addEventListener('click', () => {
    window.hermes.openSettings();
  });
  
  // Legacy
  document.getElementById('dashboard-btn')?.addEventListener('click', () => {
  window.hermes.openDashboard();
});
document.getElementById('clear-btn')?.addEventListener('click', () => {
  $('response-view').innerHTML = '<span class="muted">Your next answer will appear here.</span>';
  $('activity-feed').innerHTML = '';
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
    document.getElementById('vault-view').innerHTML = data.files.map((file) => `<div class="file-row">${file}</div>`).join('');
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
