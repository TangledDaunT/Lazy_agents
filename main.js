const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

let mainWindow;
let dashboardWindow;
let pyOrchestrator;   // python orchestrator.py subprocess (the LLM brain)
let pyWakeword;       // python wakeword_listener.py subprocess (offline wake-word engine)
let wsClient;         // websocket connection into the python orchestrator

const PY = process.env.PYTHON_BIN || 'python3';
const PYTHON_DIR = path.join(__dirname, 'python');

function startBackend() {
  pyOrchestrator = spawn(PY, [path.join(PYTHON_DIR, 'orchestrator.py')], { stdio: 'inherit' });
  pyWakeword = spawn(PY, [path.join(PYTHON_DIR, 'wakeword_listener.py')], { stdio: 'inherit' });

  // Wake word events come back over stdout as JSON lines, but easiest is a
  // second tiny websocket the wakeword script pushes to. Orchestrator relays
  // both agent replies and wake events on the same socket, tagged by "type".
  setTimeout(connectWS, 1500);
}

function connectWS() {
  wsClient = new WebSocket('ws://localhost:8765/bus');
  wsClient.on('open', () => console.log('[main] connected to orchestrator bus'));
  wsClient.on('message', (raw) => {
    const data = JSON.parse(raw.toString());
    // Forward every backend event straight to the renderer's state machine
    if (mainWindow) mainWindow.webContents.send('bus-event', data);
  });
  wsClient.on('close', () => setTimeout(connectWS, 2000));
  wsClient.on('error', () => {});
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,       // needed for the Instagram panel <webview>
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
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
  dashboardWindow.loadFile(path.join(__dirname, 'renderer', 'dashboard.html'));
}

// Renderer -> backend: user typed/spoke to a specific agent, or triggered /council
ipcMain.handle('send-to-agent', (event, { agent, text }) => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ type: 'user_message', agent, text }));
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
  if (pyOrchestrator) pyOrchestrator.kill();
  if (pyWakeword) pyWakeword.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
