const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getGeminiApiKey: () => process.env.GEMINI_API_KEY,
  closeOverlay: () => ipcRenderer.send('close-overlay'),
});