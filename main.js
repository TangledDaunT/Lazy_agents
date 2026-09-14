const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

let mainWindow;
let dashboardWindow;
let pyBridge;        // python/hermes_bridge.py subprocess (the Hermes API bridge)
let pyWakeword;      // python/wakeword_listener.py subprocess (offline wake-word engine)
let wsClient;        // websocket connection into the python bridge

const PY = process.env.PYTHON_BIN || 'python3';
const PYTHON_DIR = path.join(__dirname, 'python');

function startBackend() {
  // Start the Hermes bridge (connects to gateway API)
  pyBridge = spawn(PY, [path.join(PYTHON_DIR, 'hermes_bridge.py')], { stdio: 'inherit' });
  
  // Start the wake word listener (optional, for voice activation)
  pyWakeword = spawn(PY, [path.join(PYTHON_DIR, 'wakeword_listener.py')], { 
    stdio: 'inherit',
    env: { ...process.env, PYTHONPATH: PYTHON_DIR }
  });

  // Connect to the bridge websocket after a short delay
  setTimeout(connectWS, 2000);
}

function connectWS() {
  // Connect to hermes_bridge.py on port 8766 (default)
  wsClient = new WebSocket('ws://localhost:8766/bus');
  
  wsClient.on('open', () => console.log('[main] connected to hermes bridge bus'));
  
  wsClient.on('message', (raw) => {
    const data = JSON.parse(raw.toString());
    // Forward every backend event straight to the renderer's state machine
    if (mainWindow) mainWindow.webContents.send('bus-event', data);
  });
  
  wsClient.on('close', () => setTimeout(connectWS, 2000));
  wsClient.on('error', (e) => console.error('[main] WS error:', e.message));
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
      agent_id: agent,
      prompt: text,
      stream: true
    }));
  }
});

ipcMain.handle('open-dashboard', () => {
  if (!dashboardWindow) createDashboardWindow();
});

app.whenReady().then(() => {
  createMainWindow();
  startBackend();
});

app.on('before-quit', () => {
  if (pyBridge) pyBridge.kill();
  if (pyWakeword) pyWakeword.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
