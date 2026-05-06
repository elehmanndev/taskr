import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import Wordmark from '../components/ui/Wordmark'

const GSI_SRC = 'https://accounts.google.com/gsi/client'

function loadGsiScript(): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${GSI_SRC}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
}

export default function Login() {
  const { user, loading, loginWithGoogle } = useAuthStore()
  const navigate = useNavigate()
  const btnRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      setError('Falta VITE_GOOGLE_CLIENT_ID en el entorno')
      return
    }
    let cancelled = false

    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !btnRef.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: any) => {
          try {
            await loginWithGoogle(resp.credential)
            navigate('/dashboard', { replace: true })
          } catch (err: any) {
            setError(err?.message ?? 'Error al iniciar sesión')
          }
        },
      })
      window.google.accounts.id.renderButton(btnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: 280,
      })
    }

    loadGsiScript().then(() => {
      if (cancelled) return
      if (window.google?.accounts?.id) {
        init()
      } else {
        const interval = setInterval(() => {
          if (window.google?.accounts?.id) {
            clearInterval(interval)
            init()
          }
        }, 100)
      }
    })
    return () => { cancelled = true }
  }, [loginWithGoogle, navigate])

  return (
    <div className="relative min-h-full overflow-hidden flex items-center justify-center p-4 bg-app">
      {/* Atmospheric backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Two soft radial glows, theme-aware via CSS vars */}
        <div
          className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--auth-glow-1) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[640px] h-[640px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--auth-glow-2) 0%, transparent 70%)' }}
        />
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(var(--auth-dot) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          }}
        />
      </div>

      {/* Glass card */}
      <div
        className="relative w-full max-w-lg rounded-2xl p-10 text-center backdrop-blur-xl"
        style={{
          backgroundColor: 'var(--auth-card-bg)',
          border: '1px solid var(--auth-card-border)',
          boxShadow:
            'var(--shadow-card), inset 0 1px 0 0 var(--auth-card-highlight)',
        }}
      >
        {/* Wordmark — single colored period as the only accent */}
        <h1 className="relative inline-flex items-end justify-center mb-3 leading-none">
          <span
            aria-hidden
            className="absolute inset-0 blur-2xl opacity-40 -z-10"
            style={{ background: 'radial-gradient(ellipse at center, var(--accent) 0%, transparent 70%)' }}
          />
          <Wordmark size="lg" />
        </h1>
        <p className="text-sm text-text-secondary mb-8 tracking-wide">
          Gestionar las tareas de tu equipo nunca ha sido tan fácil.
        </p>

        {loading && <div className="text-sm text-text-secondary py-3">Cargando…</div>}
        <div className={loading ? 'hidden' : 'flex justify-center'}>
          <div ref={btnRef} />
        </div>

        {error && (
          <div className="mt-5 text-sm text-danger bg-surface-sunken border border-danger/40 rounded-md px-3 py-2 text-left">
            {error}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-border/60 flex items-center justify-center gap-2 text-xs text-text-muted">
          <span>Reverse-Engineered by</span>
          <a
            href="https://github.com/ericll93/taskr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors"
          >
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.94 10.94 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
            </svg>
            <span>ericll93/taskr</span>
          </a>
        </div>
      </div>
    </div>
  )
}
