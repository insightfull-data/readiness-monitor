'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/admin/strategy', label: 'Strategy' },
  { href: '/admin/assess',   label: 'Run assessment' },
  { href: '/admin/govlog',   label: 'Governance log' },
  { href: '/admin/reports',  label: 'Reports' },
]

export default function AdminNav() {
  const path = usePathname()
  return (
    <nav className="flex gap-1 border-b pb-0" style={{ borderColor: 'var(--earth-200)' }}>
      {links.map(l => (
        <Link
          key={l.href}
          href={l.href}
          className={`tab-btn mr-4 ${path.startsWith(l.href) ? 'active' : ''}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
