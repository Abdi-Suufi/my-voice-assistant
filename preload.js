const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getGeminiApiKey: () => ipcRenderer.invoke('get-gemini-api-key'),
  closeOverlay: () => ipcRenderer.send('close-overlay'),
});