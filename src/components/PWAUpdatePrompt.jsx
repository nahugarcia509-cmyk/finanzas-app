import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

export default function PWAUpdatePrompt() {
  const [registration, setRegistration] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

    let mounted = true
    let refreshing = false

    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker.register('/sw.js').then(reg => {
      if (!mounted) return
      setRegistration(reg)

      if (reg.waiting && navigator.serviceWorker.controller) setVisible(true)

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller && mounted) {
            setRegistration(reg)
            setVisible(true)
          }
        })
      })

      reg.update().catch(() => undefined)
    }).catch(error => console.error('No se pudo registrar la PWA:', error))

    return () => {
      mounted = false
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const updateNow = () => {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  }

  if (!visible) return null

  return <aside className="pwa-update-banner" role="status" aria-live="polite">
    <div>
      <strong>Nueva versión disponible</strong>
      <span>Actualizar para aplicar los últimos cambios sin perder los datos guardados.</span>
    </div>
    <div className="pwa-update-actions">
      <button type="button" onClick={updateNow}><RefreshCw /> Actualizar ahora</button>
      <button type="button" className="ghost" onClick={() => setVisible(false)} aria-label="Cerrar aviso"><X /></button>
    </div>
  </aside>
}
