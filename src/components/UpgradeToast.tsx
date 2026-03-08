import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  onDismiss: () => void
}

export default function UpgradeToast({ onDismiss }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        key="upgrade-toast"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2 }}
        className="fixed bottom-24 right-6 max-w-xs bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl shadow-xl px-4 py-3 text-sm text-white leading-relaxed"
        style={{ boxShadow: '0 8px 32px rgba(99,0,255,0.25)' }}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="font-semibold">Voxi Pro required</p>
            <p className="text-purple-200 text-xs mt-0.5">
              "Hey Voxi" commands are a Pro feature. Upgrade to unlock.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-purple-300 hover:text-white flex-shrink-0 focus:outline-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
