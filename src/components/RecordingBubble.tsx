type Status = 'idle' | 'recording' | 'processing'

interface Props {
  status: Status
  onClick: () => void
  onRightClick: () => void
}

export default function RecordingBubble({ status, onClick, onRightClick }: Props) {
  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onRightClick() }}
      className="w-20 h-20 rounded-full flex items-center justify-center focus:outline-none"
    >
      {status === 'idle' && (
        <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center">
          <MicIcon color="#6C63FF" />
        </div>
      )}

      {status === 'recording' && (
        <div className="w-20 h-20 rounded-full bg-red-500 animate-pulse flex items-center justify-center">
          <MicIcon color="white" />
        </div>
      )}

      {status === 'processing' && (
        <div className="w-20 h-20 rounded-full flex items-center justify-center">
          <div
            className="w-20 h-20 rounded-full border-4 animate-spin"
            style={{ borderColor: '#6C63FF', borderTopColor: 'transparent' }}
          />
        </div>
      )}
    </button>
  )
}

function MicIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="2" width="6" height="11" rx="3" fill={color} />
      <path
        d="M5 10a7 7 0 0 0 14 0"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="21" x2="15" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
