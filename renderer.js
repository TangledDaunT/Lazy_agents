const AGENTS_URL = 'agents_config.json';
const BACKEND_HTTP = 'http://localhost:8766';

let AGENTS = {};
let orderedIds = [];
let selectedAgent = 'hermes';
let agentStates = {};
let agentThinking = {};
let agentHistory = {};
let currentPopupAgent = null;
let isListening = false;
let obsidianVaultPath = '';

const $ = (id) => document.getElementById(id);

// ============================================
// CONFIG LOADING
// ============================================

async function loadConfig(refresh = false) {
  try {
    const res = await fetch(`${BACKEND_HTTP}/agents_config?ts=${Date.now()}`).catch(() => fetch(AGENTS_URL));
    AGENTS = await res.json();
    orderedIds = Object.keys(AGENTS);
    buildGrid();
    buildInputDock(refresh);
    loadObsidianVault();
  } catch (error) {
    addActivity('Agent configuration could not be loaded', 'error');
  }
}

// ============================================
// AGENT GRID WITH MASCOTS
// ============================================

function buildGrid() {
  const grid = $('agent-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const id of orderedIds) {
    const cfg = AGENTS[id];
    const slot = document.createElement('div');
    slot.className = 'agent-slot' + (cfg.position === 'center' ? ' center' : '');
    slot.id = `slot-${id}`;
    slot.dataset.agent = id;
    slot.style.setProperty('--agent-color', cfg.accentColor || '#f5d061');

    const mascot = window.MascotSystem.createMascot({
      agentId: id,
      accentColor: cfg.accentColor,
      outfit: cfg.defaultSkin,
      state: agentStates[id] || 'idle',
    });

    // Add state indicator dot
    const stateDot = document.createElement('div');
    stateDot.className = 'agent-state-dot';
    stateDot.id = `state-dot-${id}`;
    
    const name = document.createElement('div');
    name.className = 'agent-name';
    name.innerHTML = `<strong>${cfg.displayName}</strong><small>${cfg.role.split(' - ')[0]}</small>`;

    slot.appendChild(mascot);
    slot.appendChild(stateDot);
    slot.appendChild(name);
    grid.appendChild(slot);

    // Event listeners
    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      showAgentPopup(id, e);
    });

    slot.addEventListener('mouseenter', (e) => showTooltip(id, e));
    slot.addEventListener('mouseleave', hideTooltip);
  }
}

// ============================================
// AGENT POPUP (click to chat)
// ============================================

function showAgentPopup(agentId, event) {
  const popup = $('agent-popup');
  const slot = event.currentTarget;
  const rect = slot.getBoundingClientRect();
  const cfg = AGENTS[agentId];
  
  selectedAgent = agentId;
  
  // Position popup
  let left = rect.right + 20;
  if (left + 280 > window.innerWidth) {
    left = rect.left - 300;
  }
  popup.style.left = `${left}px`;
  popup.style.top = `${Math.max(100, rect.top - 50)}px`;
  
  // Update content
  popup.querySelector('.popup-agent-name').textContent = cfg.displayName;
  popup.querySelector('.popup-agent-status').textContent = agentStates[agentId] || 'idle';
  popup.querySelector('.popup-agent-status').className = 'popup-agent-status ' + (agentStates[agentId] || 'idle');
  popup.querySelector('.popup-thinking').textContent = agentThinking[agentId] || 'Waiting for task...';
  
  // History
  const historyEl = popup.querySelector('.popup-history');
  historyEl.innerHTML = '';
  const history = agentHistory[agentId] || [];
  history.slice(-5).forEach(msg => {
    const div = document.createElement('div');
    div.className = `popup-message ${msg.type}`;
    div.textContent = msg.text;
    historyEl.appendChild(div);
  });
  
  popup.dataset.agent = agentId;
  popup.classList.remove('hidden');
  currentPopupAgent = agentId;
  
  // Focus input
  const input = popup.querySelector('.popup-input input');
  input.value = '';
  input.focus();
  
  // Highlight slot
  document.querySelectorAll('.agent-slot').forEach(s => s.classList.remove('selected'));
  slot.classList.add('selected');
}

function hideAgentPopup() {
  $('agent-popup')?.classList.add('hidden');
  currentPopupAgent = null;
}

function handlePopupInput(event) {
  if (event.key === 'Enter') {
    const popup = $('agent-popup');
    const agent = popup.dataset.agent;
    const input = popup.querySelector('.popup-input input');
    const text = input.value.trim();
    if (text) {
      sendToAgent(agent, text);
      input.value = '';
    }
  }
}

// ============================================
// AGENT TOOLTIP (hover info)
// ============================================

function showTooltip(agentId, event) {
  const tooltip = $('agent-tooltip');
  const cfg = AGENTS[agentId];
  const rect = event.currentTarget.getBoundingClientRect();
  
  tooltip.querySelector('.tooltip-name').textContent = cfg.displayName;
  tooltip.querySelector('.tooltip-role').textContent = cfg.role;
  tooltip.querySelector('.tooltip-state').textContent = `Status: ${agentStates[agentId] || 'idle'}`;
  tooltip.querySelector('.tooltip-state').className = `tooltip-state ${agentStates[agentId] || 'idle'}`;
  
  tooltip.style.left = `${rect.right + 10}px`;
  tooltip.style.top = `${rect.top}px`;
  tooltip.classList.remove('hidden');
}

function hideTooltip() {
  $('agent-tooltip')?.classList.add('hidden');
}

// ============================================
// MESSAGE SENDING (ACTUAL WORKING VERSION)
// ============================================

async function sendToAgent(agentId, text) {
  if (!text.trim()) return;
  
  const target = agentId || selectedAgent;
  renderOutput(`\n[YOU → ${AGENTS[target]?.displayName || target}]\n${text}\n\n`, false);
  addActivity(`Sent to ${AGENTS[target]?.displayName || target}`, 'sent');
  
  // Add to history
  if (!agentHistory[target]) agentHistory[target] = [];
  agentHistory[target].push({ type: 'sent', text, time: Date.now() });
  
  // Update popup if open
  if (currentPopupAgent === target) {
    const popup = $('agent-popup');
    const historyEl = popup.querySelector('.popup-history');
    const div = document.createElement('div');
    div.className = 'popup-message sent';
    div.textContent = text;
    historyEl.appendChild(div);
    historyEl.scrollTop = historyEl.scrollHeight;
  }
  
  setState(target, 'working');
  agentThinking[target] = 'Processing your request...';
  
  try {
    const result = await window.hermes.sendToAgent(target, text);
    if (result?.error) {
      renderOutput(`\n[ERROR] ${result.error}\n`, false);
      addActivity(result.error, 'error');
      setState(target, 'idle');
    } else {
      addActivity(`Request sent to ${AGENTS[target]?.displayName}`, 'info');
    }
  } catch (e) {
    renderOutput(`\n[ERROR] Failed to send: ${e.message}\n`, false);
    addActivity('Connection error', 'error');
    setState(target, 'idle');
  }
}

async function sendMessage() {
  const input = $('message-input');
  const select = $('agent-select');
  const target = select?.value || selectedAgent;
  const text = input?.value.trim();
  
  if (!text) return;
  input.value = '';
  
  await sendToAgent(target, text);
}

// ============================================
// STATE MANAGEMENT
// ============================================

function setState(agentId, state) {
  agentStates[agentId] = state;
  
  // Update mascot
  const mascot = $(`mascot-${agentId}`);
  if (mascot && window.MascotSystem) {
    window.MascotSystem.setState(mascot, state);
  }
  
  // Update state dot
  const dot = $(`state-dot-${agentId}`);
  if (dot) {
    dot.className = `agent-state-dot ${state}`;
  }
  
  // Update popup if open
  if (currentPopupAgent === agentId) {
    const popup = $('agent-popup');
    popup.querySelector('.popup-agent-status').textContent = state;
    popup.querySelector('.popup-agent-status').className = 'popup-agent-status ' + state;
  }
}

// ============================================
// BUS EVENT HANDLING
// ============================================

window.hermes.onBusEvent((data) => {
  // Connection status
  if (data.type === 'bus-status') {
    const label = $('connection-label');
    if (label) {
      label.textContent = data.connected ? 'ONLINE' : 'OFFLINE';
      label.classList.toggle('online', data.connected);
    }
    return;
  }
  
  switch (data.type) {
    case 'run_created':
      addActivity(`Run created: ${data.run_id?.slice(0,8)}`, 'info');
      break;
      
    case 'agent_working':
      setState(data.agent, 'working');
      agentThinking[data.agent] = 'Processing...';
      if (data.delta) renderOutput(data.delta, false);
      break;
      
    case 'run_event':
      if (data.event === 'message.delta' && data.data?.delta) {
        renderOutput(data.data.delta, false);
      }
      break;
      
    case 'run_completed':
      setState(data.agent, 'idle');
      agentThinking[data.agent] = 'Task completed';
      if (data.output) {
        renderOutput(`\n\n[${AGENTS[data.agent]?.displayName || 'Agent'}]\n${data.output}\n`, false);
        
        // Add to history
        if (!agentHistory[data.agent]) agentHistory[data.agent] = [];
        agentHistory[data.agent].push({ type: 'received', text: data.output, time: Date.now() });
        
        // Update popup
        if (currentPopupAgent === data.agent) {
          const popup = $('agent-popup');
          const historyEl = popup.querySelector('.popup-history');
          const div = document.createElement('div');
          div.className = 'popup-message received';
          div.textContent = data.output.slice(0, 200);
          historyEl.appendChild(div);
          historyEl.scrollTop = historyEl.scrollHeight;
        }
      }
      addActivity(`${AGENTS[data.agent]?.displayName || 'Agent'} completed`, 'done');
      break;
      
    case 'run_error':
      renderOutput(`\n[ERROR] ${data.error}\n`, false);
      addActivity(data.error, 'error');
      if (data.agent) setState(data.agent, 'idle');
      break;
      
    case 'wake':
      setState(data.agent, 'listening');
      addActivity(`${AGENTS[data.agent]?.displayName} is listening`, 'info');
      break;
      
    case 'agent_idle':
      setState(data.agent, 'idle');
      break;
      
    case 'stream_closed':
      addActivity('Stream closed', 'info');
      break;
  }
});

// ============================================
// OBSIDIAN VAULT
// ============================================

async function loadObsidianVault() {
  try {
    const res = await fetch(`${BACKEND_HTTP}/vault`);
    const data = await res.json();
    
    const container = $('vault-files');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (data.files && data.files.length > 0) {
      data.files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'vault-file-item';
        item.textContent = file;
        item.addEventListener('click', () => loadNote(file));
        container.appendChild(item);
      });
    } else {
      container.innerHTML = `<div class="muted">No vault files found. Configure in Settings.</div>`;
    }
  } catch (e) {
    $('vault-files').textContent = 'Configure Obsidian in Settings ⚙️';
  }
}

async function loadNote(filename) {
  try {
    const res = await fetch(`${BACKEND_HTTP}/vault/${encodeURIComponent(filename)}`);
    const content = await res.text();
    $('vault-content').textContent = content;
  } catch (e) {
    $('vault-content').textContent = 'Could not load note';
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function addActivity(message, type = 'info') {
  const feed = $('activity-feed');
  if (!feed) return;
  
  const item = document.createElement('div');
  item.className = `activity-item ${type}`;
  item.textContent = `${message} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  feed.prepend(item);
  
  while (feed.children.length > 10) {
    feed.lastChild.remove();
  }
}

function renderOutput(text, replace = false) {
  const output = $('response-view');
  if (!output) return;
  
  if (replace) output.textContent = '';
  if (output.querySelector('.muted')) output.textContent = '';
  
  if (typeof text === 'string') {
    output.textContent += text;
  }
  
  output.scrollTop = output.scrollHeight;
}

function buildInputDock(refresh = false) {
  const select = $('agent-select');
  if (!select) return;
  
  select.innerHTML = '';
  
  for (const id of orderedIds) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = AGENTS[id].displayName;
    select.appendChild(opt);
  }
  
  const councilOpt = document.createElement('option');
  councilOpt.value = '__council__';
  councilOpt.textContent = '🏛️ Council (all)';
  select.appendChild(councilOpt);
}

// ============================================
// APP SWITCHER
// ============================================

function setupAppSwitcher() {
  document.querySelectorAll('.app-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Update tabs
      document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show webview
      const app = tab.dataset.app;
      document.querySelectorAll('.app-webview').forEach(wv => wv.classList.remove('active'));
      
      const webview = $(`${app}-webview`) || $(`${app}-view`);
      if (webview) webview.classList.add('active');
      
      // Load Obsidian if selected
      if (app === 'obsidian') {
        loadObsidianVault();
      }
    });
  });
}

// ============================================
// SIDEBAR TOGGLE
// ============================================

function setupSidebar() {
  const toggle = $('sidebar-toggle');
  const panel = $('left-panel');
  const collapseBtn = $('collapse-left');
  
  if (toggle) {
    toggle.addEventListener('click', () => {
      panel?.classList.toggle('collapsed');
    });
  }
  
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      panel?.classList.toggle('collapsed');
      collapseBtn.textContent = panel?.classList.contains('collapsed') ? '▶' : '◀';
    });
  }
}

// ============================================
// VOICE/WAKE WORD
// ============================================

async function toggleWakeWord() {
  const btn = $('wake-btn');
  const indicator = $('voice-indicator');
  
  if (!isListening) {
    // Start listening
    isListening = true;
    if (btn) btn.classList.add('active');
    if (indicator) indicator.classList.remove('hidden');
    addActivity('Voice activation enabled - say an agent name', 'info');
  } else {
    isListening = false;
    if (btn) btn.classList.remove('active');
    if (indicator) indicator.classList.add('hidden');
    addActivity('Voice activation disabled', 'info');
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  setupAppSwitcher();
  setupSidebar();
  
  // Message sending
  $('send-btn')?.addEventListener('click', sendMessage);
  $('message-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Settings
  $('settings-btn')?.addEventListener('click', () => {
    window.hermes.openSettings();
  });
  
  // Clear
  $('clear-btn')?.addEventListener('click', () => {
    $('response-view').innerHTML = '<span class="muted">Your conversation will appear here.</span>';
    $('activity-feed').innerHTML = '';
  });
  
  // Voice
  $('wake-btn')?.addEventListener('click', toggleWakeWord);
  
  // Agent popup input
  $('agent-popup')?.querySelector('.popup-input input')?.addEventListener('keydown', handlePopupInput);
  $('agent-popup')?.querySelector('.popup-input button')?.addEventListener('click', () => {
    const popup = $('agent-popup');
    const input = popup.querySelector('.popup-input input');
    if (input.value.trim()) {
      handlePopupInput({ key: 'Enter' });
    }
  });
  
  // Close popup
  $('agent-popup')?.querySelector('.popup-close')?.addEventListener('click', hideAgentPopup);
  
  // Click outside to close popup
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.agent-slot') && !e.target.closest('.agent-popup')) {
      hideAgentPopup();
    }
  });
  
  // Tabs
  document.querySelectorAll('.panel-right .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-right .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel-right .tab-body').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      $(`${tab.dataset.tab}-view`)?.classList.add('active');
    });
  });
  
  // Refresh context periodically
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

// Initial load
loadConfig();
