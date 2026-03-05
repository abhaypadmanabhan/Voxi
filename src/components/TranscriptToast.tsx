import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  text: string
  isStreaming: boolean
  onDismiss: () => void
}

export default function TranscriptToast({ text, isStreaming, onDismiss }: Props) {
  useEffect(() => {
    if (!isStreaming && text) {
      const timer = setTimeout(onDismiss, 3000)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, text, onDismiss])

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-24 right-6 max-w-xs bg-white rounded-2xl shadow-xl px-4 py-3 text-sm text-gray-800 leading-relaxed"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
        >
          <div className="flex items-start gap-2">
            <span className="flex-1">{text}</span>
            {!isStreaming && (
              <button
                onClick={onDismiss}
                className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0 focus:outline-none"
                aria-label="Dismiss"
              >
                ✕
              </button>
            )}
          </div>
          {isStreaming && (
            <div className="mt-1 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
