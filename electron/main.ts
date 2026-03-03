import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null
let isRecording = false

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const SIZE = 80
  const MARGIN = 24

  mainWindow = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    x: width - SIZE - MARGIN,
    y: height - SIZE - MARGIN,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  globalShortcut.register('CommandOrControl+Shift+V', () => {
    isRecording = !isRecording
    mainWindow?.webContents.send('status', isRecording ? 'recording' : 'idle')
  })

  ipcMain.on('start-recording', () => {
    isRecording = true
    mainWindow?.webContents.send('status', 'recording')
  })

  ipcMain.on('stop-recording', () => {
    isRecording = false
    mainWindow?.webContents.send('status', 'idle')
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
