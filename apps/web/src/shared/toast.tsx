import { CircleAlert } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ToastContent = {
  title: string
  description?: string
}

type ToastContextValue = {
  showToast: (content: string | ToastContent) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_MS = 4000

function normalizeToast(content: string | ToastContent): ToastContent {
  if (typeof content === 'string') {
    return { title: content }
  }
  return content
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastContent | null>(null)

  const showToast = useCallback((content: string | ToastContent) => {
    setToast(normalizeToast(content))
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, TOAST_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-orange-200/60 bg-orange-50/80 px-4 py-3 text-left shadow-sm backdrop-blur-md">
            <CircleAlert
              className="mt-0.5 size-5 shrink-0 text-orange-700"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-orange-950">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-sm text-orange-900/70">
                  {toast.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
