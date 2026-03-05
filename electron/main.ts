import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, screen, shell } from 'electron'
import { join } from 'path'
import WebSocket = require('ws')
import { Key, keyboard } from '@nut-tree-fork/nut-js'
import { addCorrection, findCorrection, getSetting, setSetting, setApiKey, getApiKey } from './store'

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

  const { default: activeWindow } = await import('active-win')
  const focused = await activeWindow()
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
      await injectText(msg.data ?? '', appName)
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
  // isRecording stays true until ws 'done' or 'error' resets it
}

const CODE_APPS = new Set(['terminal', 'code', 'cursor'])

async function injectText(text: string, appName: string): Promise<void> {
  // Apply any learned user corrections first
  const corrected = findCorrection(text) ?? text

  try {
    // For normal apps (not code editors/terminals), select-all first
    // so the dictated text replaces any stale selection.
    // Skip for coding tools to avoid clobbering existing work.
    if (!CODE_APPS.has(appName.toLowerCase())) {
      await keyboard.pressKey(Key.LeftCmd, Key.A)
      await keyboard.releaseKey(Key.LeftCmd, Key.A)
    }

    // Let focus fully settle before typing
    await new Promise<void>((resolve) => setTimeout(resolve, 50))

    await keyboard.type(corrected)
  } catch (err) {
    console.error('[nut-js] injection failed:', err)
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      message: 'Flow needs Accessibility access',
      detail:
        'To inject text, enable Flow in System Settings → Privacy & Security → Accessibility.',
      buttons: ['Open System Settings', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 0) {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      )
    }
    return
  }

  // 3-second clipboard diff: if user edited the injected text, store correction
  setTimeout(() => {
    const clipped = clipboard.readText()
    if (clipped && clipped !== corrected) {
      addCorrection(corrected, clipped, appName)
    }
  }, 3000)
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
  ipcMain.handle('get-setting', (_e, key: string) => getSetting(key))
  ipcMain.handle('set-setting', (_e, key: string, value: string) => setSetting(key, value))
  ipcMain.handle('set-api-key', (_e, name: string, value: string) => setApiKey(name, value))
  ipcMain.handle('get-api-key', (_e, name: string) => getApiKey(name))
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
