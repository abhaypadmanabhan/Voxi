interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-72 text-sm text-gray-700"
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 text-base">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Global shortcut</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">⌘⇧V</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Server URL</span>
            <span className="text-xs font-mono text-gray-600">ws://localhost:3001</span>
          </div>
        </div>
      </div>
    </div>
  )
}
