'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'

interface GovAction {
  id: string
  action: string
  framework: string
  notes: string
  nistPoints: number
  isoPoints: number
  loggedAt: string
  logger: { name: string | null }
}

const ACTION_TYPES = [
  'Lineage documentation completed',
  'Human reviewer assigned',
  'Customer ID nulls resolved',
  'Return/cancellation codes standardised',
  'AI policy document established',
  'Permitted use boundaries defined',
  'ETL transformation steps documented',
  'Data extraction SLA established',
  'Internal audit completed',
  'Management review conducted',
  'Staff AI literacy training delivered',
  'Audit log implemented',
  'Action tracking with owners established',
  'Other governance action',
]

const FRAMEWORKS = [
  'NIST — Govern', 'NIST — Map', 'NIST — Measure', 'NIST — Manage',
  'ISO — Clause 4 (Context)', 'ISO — Clause 5 (Leadership)',
  'ISO — Clause 6 (Planning)', 'ISO — Clause 8 (Operations)',
  'ISO — Clause 9 (Evaluation)', 'ISO — Clause 10 (Improvement)',
  'Both frameworks',
]

export default function GovLogPage() {
  const [actions, setActions] = useState<GovAction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionType, setActionType] = useState(ACTION_TYPES[0])
  const [framework, setFramework] = useState(FRAMEWORKS[0])
  const [notes, setNotes] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  useEffect(() => { fetchActions() }, [])

  async function fetchActions() {
    const res = await fetch('/api/gov-actions')
    const data = await res.json()
    setActions(data)
    setLoading(false)
  }

  async function logAction() {
    if (!notes.trim()) { alert('Please describe what was done and by whom.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/gov-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType, framework, notes, isPublic }),
      })
      if (!res.ok) throw new Error(await res.text())
      setNotes('')
      fetchActions()
    } catch (e) {
      alert('Error: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium mb-1" style={{ color: 'var(--stone-900)' }}>Governance log</h2>
        <p className="text-sm" style={{ color: 'var(--stone-500)' }}>
          Record concrete governance actions taken. Each entry advances framework alignment and — if marked public — appears on the public dashboard governance improvement log.
        </p>
      </div>

      {/* Log form */}
      <div className="card card-inner">
        <div className="label-upper mb-4">Log a governance action</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="label-upper text-xs block mb-1.5">Action taken</label>
            <select className="select-field" value={actionType} onChange={e => setActionType(e.target.value)}>
              {ACTION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label-upper text-xs block mb-1.5">Framework area closed</label>
            <select className="select-field" value={framework} onChange={e => setFramework(e.target.value)}>
              {FRAMEWORKS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="label-upper text-xs block mb-1.5">What was done and by whom</label>
          <textarea
            className="textarea-field"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Jane Smith completed ETL documentation for the Shopify pipeline. Filed in Confluence under Data Governance / Lineage."
            style={{ minHeight: '72px' }}
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--stone-600)' }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="rounded"
            />
            Show on public governance log
          </label>
          <button className="btn-primary" onClick={logAction} disabled={saving}>
            {saving ? 'Logging...' : 'Log action'}
          </button>
        </div>
      </div>

      {/* Action history */}
      <div className="card card-inner">
        <div className="label-upper mb-4">Action history</div>
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--stone-400)' }}>Loading...</p>
        ) : actions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--stone-400)' }}>No actions logged yet.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--earth-100)' }}>
            {actions.map(a => (
              <div key={a.id} className="flex gap-3 py-4">
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: 'var(--earth-500)' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-0.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--stone-800)' }}>{a.action}</span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {a.nistPoints > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--earth-100)', color: 'var(--earth-700)', border: '1px solid var(--earth-200)' }}>NIST</span>
                      )}
                      {a.isoPoints > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--sand-100)', color: 'var(--stone-600)', border: '1px solid var(--stone-200)' }}>ISO</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs mb-1" style={{ color: 'var(--stone-400)' }}>
                    {a.framework} · {format(new Date(a.loggedAt), 'MMM d, yyyy')}
                    {a.logger.name ? ` · ${a.logger.name}` : ''}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--stone-600)' }}>{a.notes}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
