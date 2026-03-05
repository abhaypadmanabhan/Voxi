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
})
