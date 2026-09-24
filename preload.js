const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hermes', {
  sendToAgent: (agent, text) => ipcRenderer.invoke('send-to-agent', { agent, text }),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  testConnection: () => ipcRenderer.invoke('test-connection'),
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  onBusEvent: (callback) => {
    ipcRenderer.on('bus-event', (event, data) => callback(data));
  },
  openDashboard: () => ipcRenderer.send('open-dashboard'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  enableAutoUpdate: (enabled) => ipcRenderer.invoke('enable-auto-update', enabled),
  routeVoiceCommand: (text) => ipcRenderer.invoke('route-voice-command', text),
  onOverlayEvent: (callback) => {
    ipcRenderer.on('voice-overlay-event', (event, data) => callback(data));
  },
});

contextBridge.exposeInMainWorld('hermesVoice', {
  sendOverlayAction: (action) => ipcRenderer.send('voice-overlay-action', action),
  resizeOverlay: (width) => ipcRenderer.send('resize-voice-overlay', width),
  onOverlayEvent: (callback) => {
    ipcRenderer.on('voice-overlay-event', (event, data) => callback(data));
  },
});
