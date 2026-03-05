import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'path'
import WebSocket = require('ws')
import { keyboard } from '@nut-tree-fork/nut-js'

let mainWindow: BrowserWindow | null = null
let ws: WebSocket | null = null
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

async function startPipeline() {
  if (isRecording) return
  isRecording = true

  const activeWin = await import('active-win')
  const focused = await activeWin()
  const appName = focused?.owner?.name ?? 'Unknown'

  ws = new WebSocket('ws://localhost:3001/transcribe')

  ws.on('open', () => {
    ws!.send(JSON.stringify({ type: 'context', appName }))
    mainWindow?.webContents.send('status', 'recording')
    mainWindow?.webContents.send('start-mic')
  })

  ws.on('message', async (raw: WebSocket.RawData) => {
    const msg = JSON.parse(raw.toString()) as { type: string; data?: string }
    if (msg.type === 'token') {
      mainWindow?.webContents.send('status', 'processing')
      mainWindow?.webContents.send('streaming-preview', msg.data)
    } else if (msg.type === 'done') {
      await keyboard.type(msg.data ?? '')
      mainWindow?.webContents.send('transcript', msg.data)
      mainWindow?.webContents.send('status', 'idle')
      ws?.close()
      ws = null
      isRecording = false
    } else if (msg.type === 'error') {
      mainWindow?.webContents.send('status', 'idle')
      ws?.close()
      ws = null
      isRecording = false
    }
  })

  ws.on('error', () => {
    mainWindow?.webContents.send('status', 'idle')
    ws = null
    isRecording = false
  })
}

function stopPipeline() {
  if (!isRecording) return
  mainWindow?.webContents.send('stop-mic')
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'end_stream' }))
  }
  isRecording = false
}

app.whenReady().then(() => {
  createWindow()

  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (isRecording) {
      stopPipeline()
    } else {
      startPipeline()
    }
  })

  ipcMain.on('start-recording', () => startPipeline())
  ipcMain.on('stop-recording', () => stopPipeline())
  ipcMain.on('audio-chunk', (_e, b64: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'audio_chunk', data: b64 }))
    }
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
