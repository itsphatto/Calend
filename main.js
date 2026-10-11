const { app, BrowserWindow, shell, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Fixed port on purpose: localStorage / IndexedDB are tied to the origin.
// A random port would wipe the profile, recent boards AND the Firebase
// anonymous uid (= lose the ability to delete boards you created) every launch.
const PORT = 47321;
const ORIGIN = `http://localhost:${PORT}`;
const START_PAGE = '/Software/MainHub.html';
const ROOT = __dirname; // repo root: contains Website/, Software/, assets/

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// Serve the repo over http so absolute paths like /Website/x.css and
// /assets/x.png work unchanged. Firebase Auth also refuses file:// and
// custom schemes, but accepts http://localhost.
function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath;
      try { urlPath = decodeURIComponent(req.url.split('?')[0]); }
      catch (e) { res.writeHead(400); return res.end(); }

      const file = path.normalize(path.join(ROOT, urlPath));
      if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }

      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, {
          'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'
        });
        res.end(data);
      });
    });
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

let win = null;

function openExternalSafe(url) {
  if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1380,
    height: 900,
    icon: path.join(__dirname, 'assets', 'CalendLogo.png'),
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  win.loadURL(ORIGIN + START_PAGE);

  // Links to our own pages (Privacy, Terms) open in-app; everything else
  // (GitHub, mailto) goes to the system browser / mail client.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN)) return { action: 'allow' };
    openExternalSafe(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) { e.preventDefault(); openExternalSafe(url); }
  });

  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit(); // second instance can't bind the port anyway
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(async () => {
    try {
      await startServer();
    } catch (e) {
      dialog.showErrorBox('Calend', `Couldn't start (port ${PORT} is in use). Close whatever is using it and try again.`);
      app.quit();
      return;
    }
    createWindow();
    app.on('activate', () => { if (!win) createWindow(); });
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}