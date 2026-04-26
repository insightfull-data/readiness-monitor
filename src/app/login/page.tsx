'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid credentials')
      } else {
        router.push('/admin/strategy')
        router.refresh()
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--cream)' }}>
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--earth-600)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--stone-700)' }}>AI Readiness Monitor</span>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <h1 className="text-lg font-medium mb-1" style={{ color: 'var(--stone-900)' }}>Admin sign in</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--stone-500)' }}>
            Access the strategy, assessment, and governance tools.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label-upper text-xs block mb-1.5">Email</label>
              <input
                className="input-field"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@readiness.local"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label-upper text-xs block mb-1.5">Password</label>
              <input
                className="input-field"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--sienna-600)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-sm"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t text-center" style={{ borderColor: 'var(--earth-100)' }}>
            <p className="text-xs" style={{ color: 'var(--stone-400)' }}>
              Demo credentials: admin@readiness.local / demo1234
            </p>
          </div>
        </div>

        <p className="text-center mt-5 text-xs" style={{ color: 'var(--stone-400)' }}>
          <a href="/dashboard" style={{ color: 'var(--earth-600)' }}>← Back to public dashboard</a>
        </p>
      </div>
    </div>
  )
}
