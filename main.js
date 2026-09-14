const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

let mainWindow;
let dashboardWindow;
let pyBridge;        // python/hermes_bridge.py subprocess (the Hermes API bridge)
let pyWakeword;      // python/wakeword_listener.py subprocess (offline wake-word engine)
let wsClient;        // websocket connection into the python bridge
let reconnectTimer;
let isQuitting = false;

const PY = process.env.PYTHON_BIN || '/usr/bin/python3';
const PYTHON_DIR = path.join(__dirname, 'python');

function startBackend() {
  // Start the Hermes bridge (connects to gateway API)
  pyBridge = spawn(PY, [path.join(PYTHON_DIR, 'hermes_bridge.py')], { stdio: 'inherit' });
  
  // Start the wake word listener (optional, for voice activation)
  const wakewordPath = path.join(PYTHON_DIR, 'wakeword_listener.py');
  if (fs.existsSync(wakewordPath)) {
    pyWakeword = spawn(PY, [wakewordPath], {
      stdio: 'inherit',
      env: { ...process.env, PYTHONPATH: PYTHON_DIR }
    });
  }

  // Connect to the bridge websocket after a short delay
  setTimeout(connectWS, 2000);
}

function connectWS() {
  if (isQuitting || (mainWindow && mainWindow.isDestroyed())) return;

  // Connect to hermes_bridge.py on port 8766 (default)
  const client = new WebSocket('ws://localhost:8766/bus');
  wsClient = client;

  const sendToRenderer = (event) => {
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bus-event', event);
    }
  };
  
  client.on('open', () => {
    console.log('[main] connected to hermes bridge bus');
    sendToRenderer({ type: 'bus-status', connected: true });
  });
  
  client.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch (error) { return; }
    // Forward every backend event straight to the renderer's state machine
    sendToRenderer(data);
  });
  
  client.on('close', () => {
    if (wsClient === client) wsClient = null;
    sendToRenderer({ type: 'bus-status', connected: false });
    if (!isQuitting && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWS();
      }, 2000);
    }
  });
  client.on('error', (e) => console.error('[main] WS error:', e.message));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 700,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  dashboardWindow.loadFile(path.join(__dirname, 'dashboard.html'));
}

// Renderer -> backend: user typed/spoke to a specific agent
ipcMain.handle('send-to-agent', (event, { agent, text }) => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ 
      type: 'create_run', 
      agent,
      prompt: text,
      stream: true
    }));
    return { ok: true };
  }
  return { error: 'Hermes bridge is offline' };
});

ipcMain.handle('open-dashboard', () => {
  if (!dashboardWindow) createDashboardWindow();
});

app.whenReady().then(() => {
  createMainWindow();
  startBackend();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (wsClient && wsClient.readyState === WebSocket.OPEN) wsClient.close();
  if (pyBridge) pyBridge.kill();
  if (pyWakeword) pyWakeword.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
