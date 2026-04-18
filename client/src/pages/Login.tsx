import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

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
      setError('Missing VITE_GOOGLE_CLIENT_ID in environment')
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
            setError(err?.message ?? 'Login failed')
          }
        },
      })
      window.google.accounts.id.renderButton(btnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 280,
      })
    }

    if (window.google?.accounts?.id) {
      init()
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval)
          init()
        }
      }, 100)
      return () => { cancelled = true; clearInterval(interval) }
    }
    return () => { cancelled = true }
  }, [loginWithGoogle, navigate])

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-white">
      <div className="w-full max-w-sm bg-surface rounded-xl shadow-lg p-8 text-center">
        <div className="w-12 h-12 mx-auto bg-accent rounded-lg flex items-center justify-center text-white font-bold text-xl mb-4">T</div>
        <h1 className="text-2xl font-bold mb-1">Welcome to Taskr</h1>
        <p className="text-sm text-text-secondary mb-6">Sign in to continue</p>

        {loading && <div className="text-sm text-text-secondary">Loading…</div>}
        <div className={loading ? 'hidden' : 'flex justify-center'}>
          <div ref={btnRef} />
        </div>

        {error && (
          <div className="mt-4 text-sm text-danger bg-surface border border-danger rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
