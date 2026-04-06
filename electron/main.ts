import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, screen, session, shell } from 'electron'
import { join } from 'path'
import WebSocket = require('ws')
import { Key, keyboard } from '@nut-tree-fork/nut-js'
import levenshtein from 'fast-levenshtein'
import { addCorrection, clearCorrections, findCorrection, getRecentCorrections, getSetting, setSetting, setApiKey, getApiKey } from './store'

let mainWindow: BrowserWindow | null = null
let ws: WebSocket | null = null
let isRecording = false
let autoStopTimer: ReturnType<typeof setTimeout> | null = null

const MAX_RECORDING_MS = 30_000

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const WIN_W = 420
  const WIN_H = 300

  mainWindow = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: Math.round((width - WIN_W) / 2),
    y: height - WIN_H,
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

  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (process.env['NODE_ENV'] === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

async function startPipeline() {
  if (isRecording) return
  isRecording = true

  autoStopTimer = setTimeout(() => {
    console.log('[main] auto-stop: max recording time reached')
    stopPipeline()
  }, MAX_RECORDING_MS)

  mainWindow?.webContents.send('status', 'recording')

  const appName = 'Unknown'
  ws = new WebSocket('ws://localhost:3001/transcribe')

  ws.on('open', () => {
    const corrections = getRecentCorrections(10)
    const skipFormatter = getSetting('use_llm_formatter') === 'false'
    ws!.send(JSON.stringify({ type: 'context', appName, corrections, skipFormatter }))
    mainWindow?.webContents.send('start-mic')
  })

  ws.on('message', async (raw: WebSocket.RawData) => {
    const msg = JSON.parse(raw.toString()) as { type: string; data?: string; message?: string }
    console.log('[main] ws message:', msg.type, msg.data?.slice(0, 80) ?? '')

    if (msg.type === 'raw_transcript') {
      const rawText = msg.data ?? ''
      if (rawText.toLowerCase().startsWith('hey voxi')) {
        const clipboardContent = clipboard.readText()
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'command',
            instruction: rawText,
            clipboardContent
          }))
        }
      }
      return
    }

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

  ws.on('error', (err) => {
    console.error('[ws] connection error:', err.message)
    mainWindow?.webContents.send('status', 'idle')
    ws = null
    isRecording = false
  })
}

function stopPipeline() {
  if (!isRecording) return
  isRecording = false
  if (autoStopTimer) { clearTimeout(autoStopTimer); autoStopTimer = null }
  mainWindow?.webContents.send('status', 'processing')
  mainWindow?.webContents.send('stop-mic')
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'end_stream' }))
  }
}

const CODE_APPS = new Set(['terminal', 'code', 'cursor'])

function startCorrectionPolling(injected: string, appName: string): void {
  if (injected.length < 5) return
  let polls = 0
  let lastClip = ''
  const id = setInterval(() => {
    if (++polls > 30) {
      clearInterval(id)
      return
    }
    const clip = clipboard.readText().trim()
    if (!clip || clip === lastClip || clip === injected) return
    lastClip = clip
    const maxLen = Math.max(injected.length, clip.length)
    const similarity = 1 - levenshtein.get(injected, clip) / maxLen
    if (similarity > 0.3 && similarity < 1.0) {
      clearInterval(id)
      addCorrection(injected, clip, appName, similarity)
      mainWindow?.webContents.send('correction-learned')
    }
  }, 500)
}

async function injectText(text: string, appName: string): Promise<void> {
  const corrected = findCorrection(text) ?? text

  try {
    if (!CODE_APPS.has(appName.toLowerCase())) {
      await keyboard.pressKey(Key.LeftCmd, Key.A)
      await keyboard.releaseKey(Key.LeftCmd, Key.A)
    }

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

  startCorrectionPolling(corrected, appName)
}

app.whenReady().then(() => {
  createWindow()

  globalShortcut.register('CommandOrControl+0', () => {
    if (isRecording) stopPipeline()
    else startPipeline()
  })

  ipcMain.on('start-recording', () => startPipeline())
  ipcMain.on('stop-recording', () => stopPipeline())
  ipcMain.handle('get-setting', (_e, key: string) => getSetting(key))
  ipcMain.handle('set-setting', (_e, key: string, value: string) => setSetting(key, value))
  ipcMain.handle('set-api-key', (_e, name: string, value: string) => setApiKey(name, value))
  ipcMain.handle('get-api-key', (_e, name: string) => getApiKey(name))
  ipcMain.handle('clear-corrections', () => clearCorrections())

  // Clear stale ghost corrections on startup
  clearCorrections()
  ipcMain.on('audio-chunk', (_e, b64: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'audio_chunk', data: b64 }))
    }
  })

  ipcMain.on('mouse-enter-interactive', () => mainWindow?.setIgnoreMouseEvents(false))
  ipcMain.on('mouse-leave-interactive', () => mainWindow?.setIgnoreMouseEvents(true, { forward: true }))

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
