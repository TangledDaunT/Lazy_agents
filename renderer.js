const BACKEND_HTTP = 'http://localhost:8766';

// Global config loaded from backend
let BRIDGE_CONFIG = {};

async function loadBridgeConfig() {
  try {
    const res = await fetch(`${BACKEND_HTTP}/config`);
    BRIDGE_CONFIG = await res.json();
  } catch (e) {
    console.error('Failed to load config:', e);
  }
}

let AGENTS = {};
let orderedIds = [];
let selectedAgent = 'hermes';
const agentStates = {};
const agentThinking = {};
const agentHistory = {};

let rightCollapsed = false;
let leftCollapsed = false;

const $ = (id) => document.getElementById(id);

// ============================================================
// INITIALIZATION
// ============================================================

async function loadConfig() {
  try {
    const res = await fetch(`${BACKEND_HTTP}/agents_config?ts=${Date.now()}`);
    AGENTS = await res.json();
    orderedIds = Object.keys(AGENTS);
    buildGrid();
    buildInputDock();
    loadObsidianVault();
  } catch (e) {
    addActivity('Failed to load agents', 'error');
    console.error(e);
  }
}

// ============================================================
// SIDEBAR & PANEL CONTROLS
// ============================================================

function setupPanels() {
  // Left sidebar collapse
  $('collapse-left')?.addEventListener('click', toggleLeftPanel);
  $('collapse-left-btn')?.addEventListener('click', toggleLeftPanel);
  
  // Right panel collapse
  $('collapse-right')?.addEventListener('click', toggleRightPanel);
  $('collapse-right-btn')?.addEventListener('click', toggleRightPanel);
  
  // Settings button
  $('settings-btn')?.addEventListener('click', () => {
    window.hermes.openSettings();
  });
  
  // Clear button
  $('clear-btn')?.addEventListener('click', () => {
    $('response-view').innerHTML = '<span class="muted">Your conversation will appear here...</span>';
    $('activity-feed').innerHTML = '';
  });
  
  // Wake word toggle
  $('wake-btn')?.addEventListener('click', toggleWakeWord);
  
  // App tabs
  document.querySelectorAll('.app-tab').forEach(tab => {
    tab.addEventListener('click', () => switchApp(tab.dataset.app));
  });
  
  // Right panel tabs
  document.querySelectorAll('.panel-right .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-right .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel-right .tab-body').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      $(`${tab.dataset.tab}-view`)?.classList.add('active');
    });
  });
}

function toggleLeftPanel() {
  leftCollapsed = !leftCollapsed;
  document.body.classList.toggle('sidebar-collapsed', leftCollapsed);
  $('collapse-left').textContent = leftCollapsed ? '▶' : '◀';
  $('collapse-left-btn').textContent = leftCollapsed ? '▶' : '◀';
  
  if (leftCollapsed) {
    $('panel-left').style.width = '50px';
    $('panel-left').style.minWidth = '50px';
    $('workspace').style.gridTemplateColumns = '50px 1fr 300px';
  } else {
    $('panel-left').style.width = '';
    $('panel-left').style.minWidth = '';
    $('workspace').style.gridTemplateColumns = '';
  }
  
  updateInputDock();
}

function toggleRightPanel() {
  rightCollapsed = !rightCollapsed;
  
  if (rightCollapsed) {
    $('panel-right').style.width = '50px';
    $('panel-right').style.minWidth = '50px';
    $('workspace').style.gridTemplateColumns = leftCollapsed ? '50px 1fr 50px' : '280px 1fr 50px';
  } else {
    $('panel-right').style.width = '';
    $('panel-right').style.minWidth = '';
    $('workspace').style.gridTemplateColumns = '';
  }
  
  $('collapse-right').textContent = rightCollapsed ? '◀' : '▶';
  $('collapse-right-btn').textContent = rightCollapsed ? '◀' : '▶';
  updateInputDock();
}

function updateInputDock() {
  const dock = $('input-dock');
  if (!dock) return;
  
  if (leftCollapsed) {
    dock.style.left = '50px';
  } else {
    dock.style.left = '';
  }
  
  if (rightCollapsed) {
    dock.style.right = '50px';
  } else {
    dock.style.right = '';
  }
}

function switchApp(appName) {
  document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.app-tab[data-app="${appName}"]`)?.classList.add('active');
  
  document.querySelectorAll('.app-webview').forEach(wv => wv.classList.remove('active'));
  const webview = $(`webview-${appName}`) || $(`${appName}-view`);
  if (webview) webview.classList.add('active');
  
  if (appName === 'obsidian') {
    loadObsidianVault();
  }
}

// ============================================================
// AGENT GRID
// ============================================================

function buildGrid() {
  const grid = $('agent-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  for (const id of orderedIds) {
    const cfg = AGENTS[id];
    if (!cfg) continue;
    
    const slot = document.createElement('div');
    slot.className = 'agent-slot' + (cfg.position === 'center' ? ' center' : '');
    slot.id = `slot-${id}`;
    slot.dataset.agent = id;
    slot.style.setProperty('--agent-color', cfg.accentColor || '#f5d061');
    
    const mascot = window.MascotSystem?.createMascot({
      agentId: id,
      accentColor: cfg.accentColor,
      outfit: cfg.defaultSkin,
      state: agentStates[id] || 'idle'
    }) || createSimpleMascot(id, cfg);
    
    const stateDot = document.createElement('div');
    stateDot.className = 'agent-state-dot';
    stateDot.id = `dot-${id}`;
    
    const name = document.createElement('div');
    name.className = 'agent-name';
    name.innerHTML = `<strong>${cfg.displayName}</strong><small>${cfg.role?.split(' - ')[0] || 'Agent'}</small>`;
    
    slot.appendChild(mascot);
    slot.appendChild(stateDot);
    slot.appendChild(name);
    grid.appendChild(slot);
    
    // Click - show popup for this agent
    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      showAgentPopup(id, e);
    });
    
    // Hover - show tooltip
    slot.addEventListener('mouseenter', (e) => showTooltip(id, e));
    slot.addEventListener('mousemove', (e) => moveTooltip(e));
    slot.addEventListener('mouseleave', hideTooltip);
  }
}

function createSimpleMascot(id, cfg) {
  const div = document.createElement('div');
  div.className = 'mascot';
  div.id = `mascot-${id}`;
  div.style.borderColor = cfg.accentColor || '#f5d061';
  div.innerHTML = `<span style="font-size:24px; font-weight:600;">${cfg.displayName?.[0] || 'H'}</span>`;
  return div;
}

// ============================================================
// AGENT POPUP
// ============================================================

function showAgentPopup(agentId, event) {
  const cfg = AGENTS[agentId];
  if (!cfg) return;
  
  selectedAgent = agentId;
  
  // Remove hidden class
  const popup = $('agent-popup');
  popup.classList.remove('hidden');
  popup.dataset.agent = agentId;
  
  // Get slot position
  const slot = event.currentTarget;
  const rect = slot.getBoundingClientRect();
  
  // Position popup
  let left = rect.right + 20;
  if (left + 300 > window.innerWidth) {
    left = rect.left - 320;
  }
  popup.style.left = `${Math.max(20, left)}px`;
  popup.style.top = `${Math.min(rect.top - 50, window.innerHeight - 200)}px`;
  
  // Update content
  popup.querySelector('.popup-agent-name').textContent = cfg.displayName;
  popup.querySelector('.popup-agent-status').textContent = agentStates[agentId] || 'idle';
  popup.querySelector('.popup-agent-status').className = 'popup-agent-status ' + (agentStates[agentId] || 'idle');
  popup.querySelector('.popup-thinking').textContent = agentThinking[agentId] || 'Waiting for input';
  
  // Focus input
  const input = popup.querySelector('.popup-input input');
  input.value = '';
  input.focus();
  
  // Highlight slot
  document.querySelectorAll('.agent-slot').forEach(s => s.classList.remove('selected'));
  slot.classList.add('selected');
  
  event.stopPropagation();
}

function hideAgentPopup() {
  $('agent-popup')?.classList.add('hidden');
  document.querySelectorAll('.agent-slot').forEach(s => s.classList.remove('selected'));
}

function handlePopupInput(event) {
  if (event.key === 'Enter') {
    const popup = $('agent-popup');
    const agent = popup?.dataset.agent;
    const input = popup?.querySelector('.popup-input input');
    if (agent && input?.value.trim()) {
      sendMessageToAgent(agent, input.value.trim());
      input.value = '';
      hideAgentPopup();
    }
  }
}

// ============================================================
// TOOLTIP
// ============================================================

function showTooltip(agentId, event) {
  const tooltip = $('agent-tooltip');
  const cfg = AGENTS[agentId];
  if (!tooltip || !cfg) return;
  
  tooltip.querySelector('.tooltip-name').textContent = cfg.displayName;
  tooltip.querySelector('.tooltip-role').textContent = cfg.role?.slice(0, 50) || '';
  tooltip.querySelector('.tooltip-state').textContent = agentStates[agentId] || 'idle';
  
  moveTooltip(event);
  tooltip.classList.remove('hidden');
}

function moveTooltip(event) {
  const tooltip = $('agent-tooltip');
  if (!tooltip) return;
  
  const x = event.clientX + 15;
  const y = event.clientY + 15;
  
  tooltip.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
  tooltip.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
}

function hideTooltip() {
  $('agent-tooltip')?.classList.add('hidden');
}

// ============================================================
// MESSAGE SENDING
// ============================================================

function buildInputDock() {
  const select = $('agent-select');
  if (!select) return;
  
  select.innerHTML = '';
  for (const id of orderedIds) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = AGENTS[id]?.displayName || id;
    select.appendChild(opt);
  }
  
  const councilOpt = document.createElement('option');
  councilOpt.value = '__council__';
  councilOpt.textContent = '🏛️ Council';
  select.appendChild(councilOpt);
}

async function sendMessage() {
  const input = $('message-input');
  const select = $('agent-select');
  const text = input?.value.trim();
  const target = select?.value || selectedAgent;
  
  if (!text) return;
  input.value = '';
  
  await sendMessageToAgent(target, text);
}

async function sendMessageToAgent(target, text) {
  if (!text) return;
  
  const cfg = AGENTS[target];
  const name = cfg?.displayName || target;
  
  // Show in output
  renderOutput(`\n[YOU → ${name}]\n${text}\n`, false);
  addActivity(`Sent to ${name}`, 'sent');
  
  setState(target, 'working');
  agentThinking[target] = 'Processing...';
  
  try {
    const result = await window.hermes.sendToAgent(target, text);
    
    if (result?.error) {
      renderOutput(`\n❌ ${result.error}\n`, false);
      addActivity(result.error, 'error');
      setState(target, 'idle');
    } else {
      addActivity(`Request sent`, 'info');
    }
  } catch (e) {
    renderOutput(`\n❌ Failed: ${e.message}\n`, false);
    addActivity('Connection error', 'error');
    setState(target, 'idle');
  }
}

function renderOutput(text, replace) {
  const output = $('response-view');
  if (!output) return;
  
  if (replace) output.textContent = '';
  if (output.querySelector('.muted')) output.textContent = '';
  
  output.textContent += text;
  output.scrollTop = output.scrollHeight;
}

function setState(agentId, state) {
  agentStates[agentId] = state;
  
  // Update mascot
  const mascot = $(`mascot-${agentId}`);
  if (mascot) {
    window.MascotSystem?.setState(mascot, state);
  }
  
  // Update state dot
  const dot = $(`dot-${agentId}`);
  if (dot) {
    dot.className = `agent-state-dot ${state}`;
  }
  
  // Update popup if open
  const popup = $('agent-popup');
  if (popup?.dataset.agent === agentId) {
    popup.querySelector('.popup-agent-status').textContent = state;
    popup.querySelector('.popup-agent-status').className = 'popup-agent-status ' + state;
  }
}

// ============================================================
// WAKE WORD
// ============================================================

function toggleWakeWord() {
  const btn = $('wake-btn');
  const indicator = $('voice-indicator');
  
  const active = btn?.classList.toggle('active');
  indicator.style.display = active ? 'inline' : 'none';
  
  addActivity(active ? 'Voice activation ON' : 'Voice activation OFF', 'info');
}

// ============================================================
// OBSIDIAN VAULT
// ============================================================

async function loadObsidianVault() {
  try {
    const res = await fetch(`${BACKEND_HTTP}/vault`);
    const data = await res.json();
    
    const container = $('vault-files');
    if (!container) return;
    
    if (data.files && !data.files[0]?.includes('not found')) {
      container.innerHTML = data.files.slice(0, 50).map(f => 
        `<div class="vault-file-item" data-file="${f}">📄 ${f}</div>`
      ).join('');
      
      container.querySelectorAll('.vault-file-item').forEach(item => {
        item.addEventListener('click', () => loadNote(item.dataset.file));
      });
    } else {
      container.innerHTML = '<div style="color:var(--muted);font-size:10px;padding:10px;">Configure vault path in Settings ⚙️</div>';
    }
  } catch (e) {
    $('vault-files').innerHTML = '<div style="color:var(--muted);padding:10px;">Configure Obsidian in Settings</div>';
  }
}

async function loadNote(filename) {
  try {
    const res = await fetch(`${BACKEND_HTTP}/vault/${encodeURIComponent(filename)}`);
    const content = await res.text();
    $('vault-content').textContent = content.slice(0, 2000);
  } catch (e) {
    $('vault-content').textContent = 'Could not load note';
  }
}

// ============================================================
// ACTIVITY FEED
// ============================================================

function addActivity(message, type = 'info') {
  const feed = $('activity-feed');
  if (!feed) return;
  
  const icons = { info: '●', sent: '→', done: '✓', error: '✗' };
  
  const item = document.createElement('div');
  item.className = `activity-item ${type}`;
  item.innerHTML = `<span>${icons[type] || '●'}</span> ${message} <span style="opacity:0.5;margin-left:auto;">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>`;
  
  feed.prepend(item);
  while (feed.children.length > 15) feed.lastChild.remove();
}

// ============================================================
// BUS EVENTS
// ============================================================

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
    case 'agent_working':
      setState(data.agent, 'working');
      agentThinking[data.agent] = 'Working...';
      if (data.delta) renderOutput(data.delta, false);
      break;
      
    case 'run_event':
      if (data.event === 'message.delta' && data.data?.delta) {
        renderOutput(data.data.delta, false);
      }
      break;
      
    case 'run_completed':
      setState(data.agent || 'hermes', 'idle');
      if (data.output) {
        renderOutput(`\n✓ ${data.output}\n`, false);
      }
      addActivity('Task completed', 'done');
      break;
      
    case 'run_error':
      renderOutput(`\n✗ ${data.error}\n`, false);
      addActivity(data.error, 'error');
      break;
      
    case 'wake':
      setState(data.agent, 'listening');
      addActivity(`${AGENTS[data.agent]?.displayName || data.agent} listening`, 'info');
      break;
      
    case 'agent_idle':
      setState(data.agent, 'idle');
      agentThinking[data.agent] = 'Ready';
      break;
  }
});

// ============================================================
// STARTUP
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadBridgeConfig();
  loadConfig();
  setupPanels();
  
  // Message input
  $('send-btn')?.addEventListener('click', sendMessage);
  $('message-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Popup input
  $('agent-popup')?.querySelector('.popup-input input')?.addEventListener('keydown', handlePopupInput);
  $('agent-popup')?.querySelector('.popup-input button')?.addEventListener('click', () => {
    const popup = $('agent-popup');
    handlePopupInput({ key: 'Enter' });
  });
  
  // Close popup
  $('agent-popup')?.querySelector('.popup-close')?.addEventListener('click', hideAgentPopup);
  
  // Click outside closes popup
  document.addEventListener('click', e => {
    if (!e.target.closest('.agent-slot') && !e.target.closest('.agent-popup')) {
      hideAgentPopup();
    }
  });
  
  // Periodic context refresh
  setInterval(async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/context`);
      const data = await res.json();
      if (data.content) {
        $('shared-context').textContent = data.content;
      }
    } catch (e) {}
  }, 5000);
});
