const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'Zeus OS — Municipal Dispatch Command (Portable)',
    backgroundColor: '#020617', // Slate 950 deep dark theme
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // Allows MapLibre and DeckGL WebGL map tile fetching on file:// protocol
      allowRunningInsecureContent: true,
    },
  });

  // Smooth appearance once rendered
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser rather than inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');

  // If running in development and dev server is up, load dev URL; otherwise load packaged dist
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173/#/admin').catch(() => {
      if (fs.existsSync(distIndexPath)) {
        mainWindow.loadFile(distIndexPath, { hash: 'admin' });
      }
    });
  } else {
    if (fs.existsSync(distIndexPath)) {
      mainWindow.loadFile(distIndexPath, { hash: 'admin' });
    } else {
      mainWindow.loadURL('http://localhost:5173/#/admin');
    }
  }

  // F12 shortcut for DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

// Single instance lock for portable execution
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

