import { useState, useEffect, useCallback } from "react"

type ToastProps = {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: "default" | "destructive"
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const toast = useCallback(
    ({ title, description, variant, ...props }: Omit<ToastProps, "id">) => {
      const id = Math.random().toString(36).substring(2, 9)
      setToasts((toasts) => [...toasts, { id, title, description, variant, ...props }])
      return id
    },
    []
  )

  const dismiss = useCallback((id: string) => {
    setToasts((toasts) => toasts.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setToasts((toasts) => {
        if (toasts.length > 0) {
          const [, ...rest] = toasts
          return rest
        }
        return toasts
      })
    }, 5000)

    return () => clearTimeout(timer)
  }, [toasts])

  return { toast, dismiss, toasts }
}
