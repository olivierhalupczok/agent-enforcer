import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from './toastContext'

/** Holds the one toast the app shows at a time. The Layout mounts it around the routed page. */
export function ToastProvider({ children, duration = 4200 }: { children: ReactNode; duration?: number }) {
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback(
    (next: string) => {
      clearTimeout(timer.current)
      setMessage(next)
      timer.current = setTimeout(() => setMessage(''), duration)
    },
    [duration],
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <ToastContext value={show}>
      {children}
      {/* Mounted while empty, so screen readers announce each new message. */}
      <p
        role="status"
        aria-live="polite"
        className="fixed right-6 bottom-6 z-50 m-0 max-w-[420px] rounded-[10px] border border-teal/30 bg-teal-soft px-4 py-3 text-sm leading-5 font-medium text-teal-dark shadow-[0_8px_24px_rgba(23,25,30,.12)] empty:hidden"
      >
        {message}
      </p>
    </ToastContext>
  )
}
