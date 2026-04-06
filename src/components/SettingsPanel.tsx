import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const [useLlm, setUseLlm] = useState(true)

  useEffect(() => {
    window.voxi.getSetting('use_llm_formatter').then((val) => {
      setUseLlm(val !== 'false')
    })
  }, [])

  async function toggleLlm() {
    const next = !useLlm
    setUseLlm(next)
    await window.voxi.setSetting('use_llm_formatter', next ? 'true' : 'false')
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <div
        className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-6 w-72 text-sm text-white/80"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-white text-base tracking-wide">Settings</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors focus:outline-none"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-4 font-medium tracking-wide">
          <div className="flex justify-between items-center bg-white/5 rounded-lg p-3 border border-white/5">
            <span className="text-white/70">Global shortcut</span>
            <kbd className="px-2 py-1 bg-black/60 border border-white/10 rounded-md text-[11px] font-mono shadow-inner text-white/90">⌘0 (toggle)</kbd>
          </div>
          <div className="flex justify-between items-center bg-white/5 rounded-lg p-3 border border-white/5">
            <span className="text-white/70">STT engine</span>
            <span className="text-[11px] font-mono text-indigo-300">Moonshine (local)</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 rounded-lg p-3 border border-white/5">
            <span className="text-white/70">LLM formatter</span>
            <button
              onClick={toggleLlm}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                useLlm ? 'bg-indigo-500' : 'bg-white/20'
              }`}
              aria-label="Toggle LLM formatter"
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  useLlm ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {useLlm && (
            <div className="flex justify-between items-center bg-white/5 rounded-lg p-3 border border-white/5">
              <span className="text-white/50 text-[11px]">Model</span>
              <span className="text-[11px] font-mono text-indigo-300">gemma4:e4b</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
