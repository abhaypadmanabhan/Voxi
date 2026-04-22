import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, screen, session, shell } from 'electron'
import { join } from 'path'
import WebSocket = require('ws')
import { Key, keyboard } from '@nut-tree-fork/nut-js'
import { getSetting, setSetting, setApiKey, getApiKey, addVocabEntry, removeVocabEntry, getVocabulary } from './store'

let mainWindow: BrowserWindow | null = null
let ws: WebSocket | null = null
let isRecording = false
let autoStopTimer: ReturnType<typeof setTimeout> | null = null

const MAX_RECORDING_MS = 30_000

const WIN_W = 420
const WIN_H_IDLE = 300
const WIN_H_SETTINGS = 640

function resizeForSettings(open: boolean) {
  if (!mainWindow) return
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const newH = open ? WIN_H_SETTINGS : WIN_H_IDLE
  mainWindow.setBounds({
    x: Math.round((width - WIN_W) / 2),
    y: height - newH,
    width: WIN_W,
    height: newH,
  })
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: WIN_W,
    height: WIN_H_IDLE,
    x: Math.round((width - WIN_W) / 2),
    y: height - WIN_H_IDLE,
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
    const vocabulary = getVocabulary()
    // Default OFF for speed — LLM formatter is opt-in via settings
    const skipFormatter = getSetting('use_llm_formatter') !== 'true'
    ws!.send(JSON.stringify({ type: 'context', appName, vocabulary, skipFormatter }))
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

async function injectText(text: string, _appName: string): Promise<void> {
  const corrected = text
  if (!corrected.trim()) {
    console.log('[inject] skip — empty transcript')
    return
  }

  try {
    const prevClipboard = clipboard.readText()
    clipboard.writeText(corrected)

    // Delay so clipboard write fully propagates before paste keystroke
    await new Promise<void>((resolve) => setTimeout(resolve, 40))

    // Insert at cursor — no select-all. Dictation is insertion, not replacement.
    await keyboard.pressKey(Key.LeftCmd, Key.V)
    await keyboard.releaseKey(Key.LeftCmd, Key.V)

    // Restore previous clipboard after paste has settled
    setTimeout(() => {
      if (prevClipboard) clipboard.writeText(prevClipboard)
    }, 500)
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
  ipcMain.handle('add-vocab-entry', (_e, word: string) => addVocabEntry(word))
  ipcMain.handle('remove-vocab-entry', (_e, word: string) => removeVocabEntry(word))
  ipcMain.handle('get-vocabulary', () => getVocabulary())
  ipcMain.on('quit-app', () => app.quit())
  ipcMain.on('settings-open', () => {
    resizeForSettings(true)
    mainWindow?.setIgnoreMouseEvents(false)
  })
  ipcMain.on('settings-close', () => {
    resizeForSettings(false)
    mainWindow?.setIgnoreMouseEvents(true, { forward: true })
  })

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
