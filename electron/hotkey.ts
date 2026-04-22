import { UiohookKey } from 'uiohook-napi'

export interface HotkeySpec {
  meta: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
  key: string
}

export const DEFAULT_HOTKEY: HotkeySpec = {
  meta: process.platform === 'darwin',
  ctrl: process.platform !== 'darwin',
  alt: false,
  shift: false,
  key: '0',
}

export function parseHotkey(raw: string | null): HotkeySpec {
  if (!raw) return { ...DEFAULT_HOTKEY }
  try {
    const p = JSON.parse(raw) as Partial<HotkeySpec>
    return {
      meta: !!p.meta,
      ctrl: !!p.ctrl,
      alt: !!p.alt,
      shift: !!p.shift,
      key: typeof p.key === 'string' && p.key.length > 0 ? p.key : DEFAULT_HOTKEY.key,
    }
  } catch {
    return { ...DEFAULT_HOTKEY }
  }
}

export function keycodeFor(key: string): number | null {
  const table = UiohookKey as unknown as Record<string, number>
  const code = table[key]
  return typeof code === 'number' ? code : null
}

export function formatHotkey(h: HotkeySpec): string {
  const parts: string[] = []
  if (h.meta) parts.push(process.platform === 'darwin' ? '⌘' : 'Win')
  if (h.ctrl) parts.push(process.platform === 'darwin' ? '⌃' : 'Ctrl')
  if (h.alt) parts.push(process.platform === 'darwin' ? '⌥' : 'Alt')
  if (h.shift) parts.push('⇧')
  parts.push(h.key)
  return parts.join(' ')
}
