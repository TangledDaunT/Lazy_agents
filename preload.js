const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hermes', {
  sendToAgent: (agent, text) => ipcRenderer.invoke('send-to-agent', { agent, text }),
  openDashboard: () => ipcRenderer.invoke('open-dashboard'),
  onBusEvent: (callback) => ipcRenderer.on('bus-event', (_event, data) => callback(data)),
});
