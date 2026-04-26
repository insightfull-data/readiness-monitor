'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ReportActions({ reportId, isActive }: { reportId: string; isActive: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      await fetch(`/api/reports/${reportId}/toggle`, { method: 'POST' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={isActive ? 'btn-secondary text-xs' : 'btn-primary text-xs'}
      style={{ padding: '5px 12px' }}
    >
      {loading ? '...' : isActive ? 'Unpublish' : 'Publish'}
    </button>
  )
}
