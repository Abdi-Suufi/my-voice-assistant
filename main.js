const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const { Porcupine } = require('@picovoice/porcupine-node');
const record = require('node-mic-record');
require('dotenv').config();

let tray = null;
let overlayWindow = null;
let porcupine = null;
let micProcess = null;

// --- Application Setup ---

// This function will be called when Electron has finished initialization.
app.on('ready', () => {
  createTray();
  setupLoginItem();
  startWakeWordDetection();
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Do not quit. The app lives in the tray.
  }
});

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// --- System Tray ---

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png')); // You'll need an icon.png in an assets folder
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Quit', type: 'normal', click: () => app.quit() }
  ]);
  tray.setToolTip('AI Assistant is running.');
  tray.setContextMenu(contextMenu);
}

// --- Auto-Startup ---

function setupLoginItem() {
  if (process.env.NODE_ENV !== 'development') {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe'),
    });
  }
}

// --- Wake Word Detection ---

function startWakeWordDetection() {
  try {
    porcupine = new Porcupine(
      process.env.PICOVOICE_ACCESS_KEY,
      [path.join(__dirname, 'models', 'picovoice_windows.ppn')],
      [0.65] // Sensitivity
    );

    micProcess = record.start({
      sampleRate: porcupine.sampleRate,
      channels: 1,
      bitwidth: 16,
      encoding: 'signed-integer',
      endian: 'little',
      verbose: true,
      device: 'Microphone', 
    });

    micProcess.on('data', (data) => {
      if (!porcupine) return;
      console.log('Received audio data:', data.length);
      const frameLength = porcupine.frameLength;
      const int16Array = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
      for (let i = 0; i + frameLength <= int16Array.length; i += frameLength) {
        const frame = int16Array.slice(i, i + frameLength);
        const keywordIndex = porcupine.process(frame);
        console.log('Processed frame, keywordIndex:', keywordIndex);
        if (keywordIndex >= 0) {
          console.log('Wake word detected!');
          showOverlayWindow();
        }
      }
    });

    console.log('Listening for "Picovoice"...');
  } catch (error) {
    console.error('Error starting wake word detection:', error);
  }
}

function stopWakeWordDetection() {
  if (micProcess) {
    record.stop();
    micProcess = null;
  }
  if (porcupine) {
    porcupine.release();
    porcupine = null;
  }
  console.log('Wake word detection stopped.');
}

// --- Overlay Window Management ---

function showOverlayWindow() {
  // Stop listening for wake word to free up the microphone
  stopWakeWordDetection();

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
    return;
  }

  overlayWindow = new BrowserWindow({
    width: 700,
    height: 450,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, 'ui', 'overlay.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    // Restart wake word detection after window is closed
    startWakeWordDetection();
  });
}

// --- Inter-Process Communication (IPC) ---

ipcMain.on('close-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
});