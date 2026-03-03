import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('voxi', {
  startRecording: () => ipcRenderer.send('start-recording'),
  stopRecording: () => ipcRenderer.send('stop-recording'),
  onTranscript: (cb: (text: string) => void) =>
    ipcRenderer.on('transcript', (_e, text) => cb(text)),
  onStatus: (cb: (status: string) => void) =>
    ipcRenderer.on('status', (_e, status) => cb(status)),
})
