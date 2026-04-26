import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <header className="topbar sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--earth-600)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--stone-800)' }}>
              AI Readiness Monitor
            </span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--earth-200)', color: 'var(--earth-800)' }}>
              Admin
            </span>
          </div>
          <nav className="flex gap-1">
            <Link href="/dashboard" className="nav-link">Public dashboard</Link>
            <span className="nav-link active">Admin</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--stone-500)' }}>
              {session.user.name || session.user.email}
            </span>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="btn-ghost text-xs">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <AdminNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
