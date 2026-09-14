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
});
