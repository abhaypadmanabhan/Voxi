import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('voxi', {
  startRecording: () => ipcRenderer.send('start-recording'),
  stopRecording: () => ipcRenderer.send('stop-recording'),
  onTranscript: (cb: (text: string) => void) =>
    ipcRenderer.on('transcript', (_e, text) => cb(text)),
  onStatus: (cb: (status: string) => void) =>
    ipcRenderer.on('status', (_e, status) => cb(status)),
  onStartMic: (cb: () => void) =>
    ipcRenderer.on('start-mic', cb),
  onStopMic: (cb: () => void) =>
    ipcRenderer.on('stop-mic', cb),
  sendAudioChunk: (b64: string) =>
    ipcRenderer.send('audio-chunk', b64),
  onStreamingPreview: (cb: (text: string) => void) =>
    ipcRenderer.on('streaming-preview', (_e, t) => cb(t)),
  getSetting: (key: string) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('set-setting', key, value),
  setApiKey: (name: string, value: string) => ipcRenderer.invoke('set-api-key', name, value),
  getApiKey: (name: string) => ipcRenderer.invoke('get-api-key', name),
  addVocabEntry: (word: string) => ipcRenderer.invoke('add-vocab-entry', word),
  removeVocabEntry: (word: string) => ipcRenderer.invoke('remove-vocab-entry', word),
  getVocabulary: (): Promise<string[]> => ipcRenderer.invoke('get-vocabulary'),
  getHotkey: () => ipcRenderer.invoke('get-hotkey'),
  setHotkey: (spec: unknown) => ipcRenderer.invoke('set-hotkey', spec),
  quitApp: () => ipcRenderer.send('quit-app'),
  settingsOpen: () => ipcRenderer.send('settings-open'),
  settingsClose: () => ipcRenderer.send('settings-close'),
  mouseEnterInteractive: () => ipcRenderer.send('mouse-enter-interactive'),
  mouseLeaveInteractive: () => ipcRenderer.send('mouse-leave-interactive'),
})
