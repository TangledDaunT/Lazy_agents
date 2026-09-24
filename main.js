const { app, BrowserWindow, ipcMain, session, screen } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const path = require('path');
const { spawn, execFile } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

let mainWindow;
let settingsWindow;
let pyBridge;
let pyWakeword;
let wsClient;
let reconnectTimer;
let isQuitting = false;
let voiceOverlay;
let kevProcess;
let kevReady = false;
let voiceHotkeyListening = false;
let pendingVoiceTranscript = null;
let overlayReady = false;
const pendingOverlayEvents = [];
const voiceRuns = new Set();
let awaitingVoiceRun = false;
const KEV_PORT = 8009;
const KEV_DIR = path.join(__dirname, 'kev');

const PY = process.env.PYTHON_BIN || '/usr/bin/python3';
const PYTHON_DIR = path.join(__dirname, 'python');
const BRIDGE_SCRIPT = path.join(PYTHON_DIR, 'hermes_bridge.py');

// Settings management
let appSettings = {
  gatewayUrl: process.env.HERMES_GATEWAY_URL || 'http://localhost:8642',
  apiKey: process.env.HERMES_API_KEY || '',
  bridgePort: 8766,
  autoStart: true,
  wakeWord: true,
  debug: false,
  kevRun: process.env.KEV_RUN || path.join(__dirname, 'runs', 'kev-router'),
  kevPython: process.env.UV_BIN || 'uv',
  voicePiperModel: process.env.VOICE_PIPER_MODEL ||
    path.join(__dirname, 'models', 'en_GB-alba-medium.onnx')
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
  if (!appSettings.voicePiperModel) {
    appSettings.voicePiperModel = path.join(__dirname, 'models', 'en_GB-alba-medium.onnx');
    saveSettings();
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

function startKev() {
  if (!fs.existsSync(KEV_DIR)) {
    reportVoiceError('Kev source directory is missing.');
    return;
  }
  const args = ['run', '--extra', 'serve', 'python', '-m', 'kev.serve',
    '--run', appSettings.kevRun, '--port', String(KEV_PORT)];
  kevProcess = spawn(appSettings.kevPython, args, { cwd: KEV_DIR, stdio: 'inherit', env: process.env });
  kevProcess.on('error', (error) => reportVoiceError(`Kev failed to start: ${error.message}`));
  kevProcess.on('exit', (code) => {
    kevReady = false;
    if (!isQuitting && code !== 0) reportVoiceError(`Kev exited before becoming ready (code ${code}).`);
  });
  waitForKev();
}

function reportVoiceError(message) {
  console.error(`[voice] ${message}`);
  sendToRenderer({ type: 'voice-status', ready: false, error: message });
  sendVoiceOverlay({ type: 'error', text: message });
}

function sendToRenderer(event) {
  if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('bus-event', event);
  }
}

function waitForKev(attempt = 0) {
  const request = require('http').get(`http://127.0.0.1:${KEV_PORT}/v1/models`, (response) => {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      kevReady = true;
      console.log(`[voice] Kev ready on port ${KEV_PORT} using ${appSettings.kevRun}`);
      sendToRenderer({ type: 'voice-status', ready: true, kevRun: appSettings.kevRun });
      startWakeword();
    } else {
      response.resume();
      retryKev(attempt);
    }
  });
  request.on('error', () => retryKev(attempt));
  request.setTimeout(1000, () => request.destroy());
}

function retryKev(attempt) {
  if (attempt >= 120) {
    reportVoiceError('Kev health check timed out. Voice control is unavailable.');
    return;
  }
  setTimeout(() => waitForKev(attempt + 1), 1000);
}

function startWakeword() {
  const wakewordPath = path.join(__dirname, 'wakeword_listener.py');
  if (!fs.existsSync(wakewordPath)) {
    reportVoiceError('Query listener script is missing.');
    return;
  }
  if (pyWakeword && !pyWakeword.killed) return;
  pyWakeword = spawn(PY, [wakewordPath], {
    stdio: 'inherit',
    env: { ...process.env, PYTHONPATH: PYTHON_DIR, BRIDGE_URL: `ws://localhost:${appSettings.bridgePort || 8766}/bus` }
  });
  pyWakeword.on('error', (error) => reportVoiceError(`Query listener failed: ${error.message}`));
  pyWakeword.on('exit', (code) => {
    if (!isQuitting && code !== 0) reportVoiceError(`Query listener exited (code ${code}).`);
  });
  console.log('[voice] Query listener started unconditionally');
}

function setVoiceHotkeyListening(listening) {
  if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
    if (listening) reportVoiceError('Voice hotkey pressed before the bridge was connected.');
    return;
  }
  const timestamp = Date.now();
  console.log(`[voice][timing] ${listening ? 'hotkey-down' : 't0 key-up'}=${timestamp}`);
  wsClient.send(JSON.stringify({ type: listening ? 'voice_hotkey_down' : 'voice_hotkey_up', timestamp }));
  sendVoiceOverlay({ type: listening ? 'wake' : 'idle' });
}

function registerVoiceHotkey() {
  if (process.platform !== 'darwin') return;
  const pressed = new Set();
  const chord = new Set([UiohookKey.Ctrl, UiohookKey.Alt, UiohookKey.Space]);
  const update = () => {
    const active = [...chord].every((key) => pressed.has(key));
    if (active !== voiceHotkeyListening) {
      voiceHotkeyListening = active;
      setVoiceHotkeyListening(active);
    }
  };
  uIOhook.on('keydown', (event) => {
    pressed.add(event.keycode);
    if (event.keycode === UiohookKey.Space) console.log(`[voice][hotkey] key-down t=${Date.now()}`);
    update();
  });
  uIOhook.on('keyup', (event) => {
    pressed.delete(event.keycode);
    if (event.keycode === UiohookKey.Space) console.log(`[voice][hotkey] key-up t=${Date.now()}`);
    update();
  });
  uIOhook.start();
  console.log('[voice] Push-to-talk registered: Control+Option+Space');
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
  
  startKev();
  setTimeout(connectWS, 2000);
}

function connectWS() {
  if (isQuitting || (mainWindow && mainWindow.isDestroyed())) return;
  
  const port = appSettings.bridgePort || 8766;
  const client = new WebSocket(`ws://localhost:${port}/bus`);
  wsClient = client;
  
  client.on('open', () => {
    console.log('[main] Connected to Hermes bridge');
    sendToRenderer({ type: 'bus-status', connected: true });
  });
  
  client.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    sendToRenderer(data);
    if (data.type === 'wake' && data.agent === 'query') {
      console.log('[voice] Query wake event received');
      if (voiceOverlay && !voiceOverlay.isDestroyed()) voiceOverlay.setIgnoreMouseEvents(true, { forward: true });
      sendVoiceOverlay({ type: 'wake' });
    }
    if (data.type === 'voice_transcript' && data.text) {
      console.log(`[voice][timing] t2 router-received=${Date.now()} transcript=${JSON.stringify(data.text)}`);
      pendingVoiceTranscript = data.text;
      sendVoiceOverlay({ type: 'transcript', text: data.text });
      if (voiceOverlay && !voiceOverlay.isDestroyed()) voiceOverlay.setIgnoreMouseEvents(true, { forward: true });
      sendVoiceOverlay({ type: 'running', text: data.text });
      const text = pendingVoiceTranscript;
      pendingVoiceTranscript = null;
      routeVoiceCommand(text).then((result) => {
        sendVoiceOverlay({ type: result.ok ? 'running' : 'error', text: result.message || result.error || 'Done.' });
        setTimeout(() => sendVoiceOverlay({ type: 'idle' }), result.ok ? 1400 : 2500);
      });
    }
    if (data.type === 'run_created' && awaitingVoiceRun && data.run_id) {
      awaitingVoiceRun = false;
      voiceRuns.add(data.run_id);
      console.log(`[voice] Tracking run ${data.run_id} for completion confirmation`);
    }
    if (data.type === 'run_completed' || data.type === 'run_error') {
      handleVoiceRunEvent(data);
    }
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

function createVoiceOverlay() {
    if (voiceOverlay && !voiceOverlay.isDestroyed()) return;
    const { width } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    voiceOverlay = new BrowserWindow({
      width: 120,
      height: 70,
      x: Math.round((width - 120) / 2),
      y: 12,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    voiceOverlay.setAlwaysOnTop(true, 'screen-saver');
    voiceOverlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    voiceOverlay.setIgnoreMouseEvents(true, { forward: true });
    voiceOverlay.webContents.on('did-finish-load', () => {
      overlayReady = true;
      while (pendingOverlayEvents.length) {
        voiceOverlay.webContents.send('voice-overlay-event', pendingOverlayEvents.shift());
      }
      console.log('[voice][overlay] renderer ready');
    });
    voiceOverlay.loadFile(path.join(__dirname, 'voice-overlay.html'));
}

function sendVoiceOverlay(event) {
  if (voiceOverlay && !voiceOverlay.isDestroyed()) {
    if (!overlayReady) {
      pendingOverlayEvents.push(event);
      return;
    }
    voiceOverlay.webContents.send('voice-overlay-event', event);
  }
}

function speakVoice(text) {
  const model = appSettings.voicePiperModel ||
    path.join(__dirname, 'models', 'en_GB-alba-medium.onnx');
  if (!model) {
    console.log(`[voice][tts] say fallback starting: ${text}`);
    execFile('say', ['-v', 'Kate', text], (error) => {
      console.log(`[voice][tts] say fallback exited code=${error ? error.code || 1 : 0}`);
      if (error) console.error('[voice][tts] say failed:', error.message);
    });
    return;
  }
  console.log(`[voice][tts] Piper starting model=${model} text=${JSON.stringify(text)}`);
  const wavPath = path.join(app.getPath('temp'), 'lazyagents-voice-confirmation.wav');
  if (!fs.existsSync(model)) {
    console.error(`[voice][tts] Piper model missing: ${model}`);
    execFile('say', ['-v', 'Kate', text], (error) => {
      console.log(`[voice][tts] say fallback exited code=${error ? error.code || 1 : 0}`);
    });
    return;
  }
  const piperBinary = process.env.PIPER_BIN ||
    path.join(require('os').homedir(), '.local', 'bin', 'piper');
  execFile(piperBinary, ['--model', model, '--output_file', wavPath], { input: text }, (error) => {
    console.log(`[voice][tts] Piper wav=${wavPath} generated=${!error}`);
    if (error) {
      console.error('[voice] Piper failed:', error.message);
      return;
    }
    execFile('afplay', [wavPath], (playError) => {
      console.log(`[voice][tts] afplay path=${wavPath} exited code=${playError ? playError.code || 1 : 0}`);
      if (playError) console.error('[voice] afplay failed:', playError.message);
    });
  });
}

function loadAgents() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'agents_config.json'), 'utf8'));
  } catch (error) {
    console.error('[voice] Unable to load agents_config.json:', error.message);
    return {};
  }
}

function handleVoiceRunEvent(data) {
  if (!voiceRuns.has(data.run_id)) return;
  if (data.type === 'run_completed') {
    voiceRuns.delete(data.run_id);
    const message = `The ${data.agent || 'Hermes'} agent finished.`;
    sendVoiceOverlay({ type: 'running', text: message });
    speakVoice(message);
    setTimeout(() => {
      if (voiceOverlay && !voiceOverlay.isDestroyed()) voiceOverlay.setIgnoreMouseEvents(true);
      sendVoiceOverlay({ type: 'idle' });
    }, 1400);
  } else {
    voiceRuns.delete(data.run_id);
    const message = `The agent run failed: ${data.error || 'unknown error'}.`;
    sendVoiceOverlay({ type: 'error', text: message });
    speakVoice(message);
  }
}

function sendToClaude(text) {
  const clipboard = spawn('pbcopy');
  clipboard.stdin.end(text);
  execFile('osascript', ['-e', 'tell application "Claude" to activate', '-e',
    'tell application "System Events" to keystroke "v" using command down', '-e',
    'tell application "System Events" to key code 36'], (error) => {
    if (error) console.error('[voice] Claude dispatch failed:', error.message);
  });
}

function sendToDesktopAssistant(appName, text) {
  const clipboard = spawn('pbcopy');
  clipboard.stdin.end(text);
  execFile('osascript', [
    '-e', `tell application "${appName}" to activate`,
    '-e', 'tell application "System Events" to keystroke "v" using command down',
    '-e', 'tell application "System Events" to key code 36'
  ], (error) => {
    if (error) console.error(`[voice] ${appName} dispatch failed:`, error.message);
  });
}

function routeVoiceCommand(text) {
  return new Promise((resolve) => {
    const deterministic = /^\s*(open|launch|start|close|quit|exit)\s+.+$/i.test(text);
    if (!kevReady && !deterministic) {
      resolve({ ok: false, error: 'Kev is not ready; voice control is unavailable.' });
      return;
    }
    const script = path.join(__dirname, 'python', 'voice_router.py');
    execFile(PY, [script, text], {
      env: {
        ...process.env,
        VOICE_AGENT_CONFIG: path.join(__dirname, 'agents_config.json'),
        KEV_URL: `http://127.0.0.1:${KEV_PORT}/v1/systemone`,
        VOICE_PIPER_MODEL: appSettings.voicePiperModel
      }
    }, (error, stdout, stderr) => {
      if (stderr) console.error('[voice] router:', stderr.trim());
      let result;
      try { result = JSON.parse(stdout); } catch {
        resolve({ ok: false, error: error?.message || 'Voice router returned invalid JSON' });
        return;
      }
      if (result.ok && result.route === 'ask_claude') {
        sendToClaude(text);
        result.message = 'Sent your message to Claude.';
        speakVoice(result.message);
      } else if (result.ok && result.route === 'ask_chatgpt') {
        sendToDesktopAssistant('ChatGPT', text);
        result.message = 'Sent your message to ChatGPT.';
        speakVoice(result.message);
      } else if (result.ok && result.route === 'hermes_agent') {
        const agents = loadAgents();
        const agent = result.agent_id || Object.keys(agents).find((id) => {
          const role = `${agents[id].displayName} ${agents[id].role}`.toLowerCase();
          return role.includes(result.target_agent);
        }) || Object.keys(agents).find((id) => agents[id].position === 'center') || 'hermes';
        if (wsClient?.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify({ type: 'create_run', agent, prompt: text, stream: true }));
          result.message = `Sending this to the ${agents[agent]?.displayName || agent} agent.`;
          speakVoice(result.message);
          awaitingVoiceRun = true;
        } else {
          result = { ok: false, error: 'Bridge not connected' };
        }
      } else if (result.ok && result.classification?.route === 'system_command') {
        result.message = result.type === 'app' ? `Opened ${result.target}.` : 'Command completed.';
        speakVoice(result.message);
      } else if (!result.ok) {
        speakVoice(`Voice command failed: ${result.error || 'unknown error'}.`);
      }
      console.log(`[voice][timing] t6 command-complete=${Date.now()} ok=${Boolean(result.ok)}`);
      resolve(result);
    });
  });
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
    if (pyWakeword) pyWakeword.kill();
    if (kevProcess) kevProcess.kill();
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
ipcMain.handle('route-voice-command', async (event, text) => routeVoiceCommand(text));
ipcMain.on('voice-overlay-action', (_event, action) => {
  console.log(`[voice][overlay] action=${action}`);
  if (action === 'cancel') {
    pendingVoiceTranscript = null;
    if (voiceOverlay && !voiceOverlay.isDestroyed()) voiceOverlay.setIgnoreMouseEvents(true, { forward: true });
    sendVoiceOverlay({ type: 'idle' });
  } else if (action === 'accept' && pendingVoiceTranscript) {
    const text = pendingVoiceTranscript;
    pendingVoiceTranscript = null;
    if (voiceOverlay && !voiceOverlay.isDestroyed()) voiceOverlay.setIgnoreMouseEvents(true, { forward: true });
    sendVoiceOverlay({ type: 'running', text: 'Working…' });
    routeVoiceCommand(text).then((result) => {
      sendVoiceOverlay({ type: 'running', text: result.message || result.error || 'Done.' });
      setTimeout(() => sendVoiceOverlay({ type: 'idle' }), 1400);
    });
  }
});

ipcMain.on('resize-voice-overlay', (_event, requestedWidth) => {
  if (!voiceOverlay || voiceOverlay.isDestroyed()) return;
  const width = Math.max(120, Math.min(460, Math.round(Number(requestedWidth) || 120)));
  const bounds = voiceOverlay.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  voiceOverlay.setBounds({
    ...bounds,
    width,
    x: Math.round(display.workArea.x + (display.workArea.width - width) / 2)
  }, true);
});

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
  createVoiceOverlay();
  registerVoiceHotkey();
  if (appSettings.autoStart) {
    startBackend();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (process.platform === 'darwin') uIOhook.stop();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (wsClient && wsClient.readyState === WebSocket.OPEN) wsClient.close();
  if (pyBridge) pyBridge.kill();
  if (pyWakeword) pyWakeword.kill();
  if (kevProcess) kevProcess.kill();
  if (voiceOverlay && !voiceOverlay.isDestroyed()) voiceOverlay.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
