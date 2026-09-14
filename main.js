const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

let mainWindow;
let settingsWindow;
let pyBridge;
let pyWakeword;
let wsClient;
let reconnectTimer;
let isQuitting = false;

const PY = process.env.PYTHON_BIN || '/usr/bin/python3';
const PYTHON_DIR = path.join(__dirname, 'python');
const BRIDGE_SCRIPT = path.join(PYTHON_DIR, 'hermes_bridge.py');

// Settings management
let appSettings = {
  gatewayUrl: process.env.HERMES_GATEWAY_URL || 'http://localhost:8642',
  apiKey: process.env.HERMES_API_KEY || '',
  bridgePort: 8766,
  autoStart: true,
  wakeWord: false,
  debug: false
};

function loadSettings() {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    if (fs.existsSync(settingsPath)) {
      const loaded = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      appSettings = { ...appSettings, ...loaded };
    }
  } catch (e) {
    console.error('[main] Failed to load settings:', e.message);
  }
}

function saveSettings() {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2));
  } catch (e) {
    console.error('[main] Failed to save settings:', e.message);
  }
}

function startBackend() {
  const port = appSettings.bridgePort || 8766;
  
  // Start the Hermes bridge with environment variables
  const env = {
    ...process.env,
    HERMES_GATEWAY_URL: appSettings.gatewayUrl,
    HERMES_API_KEY: appSettings.apiKey,
    BRIDGE_PORT: String(port)
  };
  
  if (fs.existsSync(BRIDGE_SCRIPT)) {
    pyBridge = spawn(PY, [BRIDGE_SCRIPT], { 
      stdio: 'inherit',
      env
    });
    pyBridge.on('exit', (code) => console.log(`[main] Bridge exited: ${code}`));
  } else {
    console.error('[main] Bridge script not found:', BRIDGE_SCRIPT);
  }
  
  // Wake word listener (optional)
  if (appSettings.wakeWord) {
    const wakewordPath = path.join(__dirname, 'wakeword_listener.py');
    if (fs.existsSync(wakewordPath)) {
      pyWakeword = spawn(PY, [wakewordPath], {
        stdio: 'inherit',
        env: { ...env, PYTHONPATH: PYTHON_DIR }
      });
    }
  }
  
  setTimeout(connectWS, 2000);
}

function connectWS() {
  if (isQuitting || (mainWindow && mainWindow.isDestroyed())) return;
  
  const port = appSettings.bridgePort || 8766;
  const client = new WebSocket(`ws://localhost:${port}/bus`);
  wsClient = client;
  
  const sendToRenderer = (event) => {
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bus-event', event);
    }
  };
  
  client.on('open', () => {
    console.log('[main] Connected to Hermes bridge');
    sendToRenderer({ type: 'bus-status', connected: true });
  });
  
  client.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
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
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    backgroundColor: '#000000',
    title: 'LazyAgents',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:lazyagents',
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  
  settingsWindow = new BrowserWindow({
    width: 900,
    height: 800,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
}

// IPC handlers
ipcMain.handle('send-to-agent', async (event, { agent, text }) => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({
      type: 'create_run',
      agent,
      prompt: text,
      stream: true
    }));
    return { ok: true };
  }
  return { error: 'Bridge not connected' };
});

ipcMain.handle('get-settings', () => appSettings);

ipcMain.handle('save-settings', (event, newSettings) => {
  const restartNeeded = newSettings.gatewayUrl !== appSettings.gatewayUrl ||
                        newSettings.apiKey !== appSettings.apiKey ||
                        newSettings.bridgePort !== appSettings.bridgePort;

  appSettings = { ...appSettings, ...newSettings };
  saveSettings();

  if (restartNeeded) {
    // Restart bridge with new settings
    if (pyBridge) pyBridge.kill();
    setTimeout(startBackend, 500);
  }

  return { ok: true, restartNeeded };
});

ipcMain.handle('test-connection', async () => {
  const http = require('http');
  const url = new URL(`${appSettings.gatewayUrl}/v1/models`);

  return new Promise((resolve) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: appSettings.apiKey ? { 'Authorization': `Bearer ${appSettings.apiKey}` } : {}
    }, (res) => {
      resolve({ ok: res.statusCode === 200, statusCode: res.statusCode });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.end();
  });
});

ipcMain.handle('open-settings', () => createSettingsWindow());

ipcMain.handle('check-for-updates', async () => {
  try {
    // Get current commit hash
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Get current commit
    const { stdout: currentHash } = await execAsync('git rev-parse HEAD', { cwd: __dirname });
    
    // Fetch latest from remote
    await execAsync('git fetch origin', { cwd: __dirname });
    
    // Get latest commit hash
    const { stdout: latestHash } = await execAsync('git rev-parse origin/master', { cwd: __dirname });
    
    // Check if there are updates
    const hasUpdates = currentHash.trim() !== latestHash.trim();
    
    return {
      ok: true,
      hasUpdates,
      currentHash: currentHash.trim(),
      latestHash: latestHash.trim()
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('enable-auto-update', (event, enabled) => {
  // Save the auto-update preference
  appSettings.autoUpdate = enabled;
  saveSettings();
  return { ok: true };
});

app.whenReady().then(() => {
  loadSettings();
  createMainWindow();
  if (appSettings.autoStart) {
    startBackend();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (wsClient && wsClient.readyState === WebSocket.OPEN) wsClient.close();
  if (pyBridge) pyBridge.kill();
  if (pyWakeword) pyWakeword.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
