'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3 | 4

interface CheckResult {
  checkName: string
  weight: number
  score: number
  status: string
  finding: string
}

interface RunResult {
  runId: string
  score: number
  band: string
  period: string
  datasetType: string
  detectedPeriod: string | null
  checks: CheckResult[]
  diagnosis: string
  guidingPolicy: string
  coherentActions: string
  permittedUse: string
}

const LINEAGE_OPTIONS = [
  { value: 'full',    label: 'Yes — full source-to-output map' },
  { value: 'partial', label: 'Partial — source known, transforms unclear' },
  { value: 'none',    label: 'No lineage documentation' },
]

const UC_TYPES = [
  'Sales trend summary',
  'Customer segment insights',
  'Churn prediction narrative',
  'Marketing attribution analysis',
  'Product performance report',
  'Financial performance summary',
]

const DATASET_TYPE_LABELS: Record<string, string> = {
  marketing:   'Marketing / Media spend',
  transaction: 'Transaction data',
  financial:   'Financial data',
  timeseries:  'Time-series data',
  generic:     'General dataset',
}

function statusColor(s: string) {
  if (s === 'pass') return '#5a7a3a'
  if (s === 'warn') return '#9e623a'
  return '#b84a34'
}
function statusLabel(s: string) {
  return s === 'pass' ? 'Pass' : s === 'warn' ? 'Warning' : 'Fail'
}
function scoreColor(n: number) {
  if (n >= 80) return '#5a7a3a'
  if (n >= 65) return '#9e623a'
  return '#b84a34'
}
function bandLabel(band: string) {
  if (band === 'ready')   return 'Ready'
  if (band === 'usable')  return 'Usable with controls'
  if (band === 'limited') return 'Limited use'
  return 'Not ready'
}

export default function AssessPage() {
  const router = useRouter()
  const [step, setStep]         = useState<Step>(1)
  const [loading, setLoading]   = useState(false)
  const [csvText, setCsvText]   = useState<string | null>(null)
  const [filename, setFilename] = useState('')
  const [result, setResult]     = useState<RunResult | null>(null)
  const [aiSummary, setAiSummary]   = useState('')
  const [aiLoading, setAiLoading]   = useState(false)
  const [notes, setNotes]           = useState('')

  // Metadata fields — no extraction date
  const [ucName, setUcName]               = useState('')
  const [ucBu, setUcBu]                   = useState('')
  const [ucType, setUcType]               = useState(UC_TYPES[0])
  const [ucIntent, setUcIntent]           = useState('')
  const [sourceSystem, setSourceSystem]   = useState('')
  const [lineageStatus, setLineageStatus] = useState('partial')
  const [reviewerName, setReviewerName]   = useState('')

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      setCsvText(ev.target?.result as string)
      setStep(2)
    }
    reader.readAsText(file)
  }

  function loadDemo() {
    // Generate realistic demo CSV
    const header = 'transaction_id,customer_id,product_category,transaction_value,return_status,transaction_date'
    const rows: string[] = [header]
    const categories = ['Electronics','Apparel','Home','Beauty','Sports','Books','Toys','Food','Garden','Auto','Health','Office']
    const returnCodes: Record<string, string> = {
      Electronics:'RET', Apparel:'RTN', Home:'RETURN', Beauty:'RET', Sports:'RTN',
      Books:'RET', Toys:'RET', Food:'VOID', Garden:'RTN', Auto:'RETURN', Health:'RET', Office:'RTN',
    }
    for (let i = 1; i <= 500; i++) {
      const custId = Math.random() > 0.14 ? `CUST${String(Math.floor(Math.random()*50000)).padStart(6,'0')}` : ''
      const cat = categories[Math.floor(Math.random()*categories.length)]
      const val = Math.random() > 0.08 ? (Math.random()*500+10).toFixed(2) : ''
      const ret = Math.random() > 0.85 ? returnCodes[cat] : 'SALE'
      const day = String(Math.floor(Math.random()*28)+1).padStart(2,'0')
      rows.push(`TXN${String(i).padStart(7,'0')},${custId},${cat},${val},${ret},2025-04-${day}`)
    }
    setCsvText(rows.join('\n'))
    setFilename('demo_transactions_apr2025.csv')
    setSourceSystem('Shopify + Salesforce')
    setReviewerName('Jane Smith, Analytics Lead')
    setLineageStatus('partial')
    setUcName('Monthly Sales AI Insights')
    setUcBu('Commercial Analytics')
    setUcIntent('Weekly leadership briefing, internal review only')
    setStep(2)
  }

  async function runChecks() {
    if (!csvText) return
    setLoading(true)
    try {
      const res = await fetch('/api/score-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText, filename,
          ucName, ucBu, ucType, ucIntent,
          sourceSystem, lineageStatus, reviewerName,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResult(data)
      setStep(3)
    } catch (e) {
      alert('Error running checks: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function generateAI() {
    if (!result) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/score-runs/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: result.runId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiSummary(data.summary)
    } catch (e) {
      alert((e as Error).message || 'Could not generate AI summary.')
    } finally {
      setAiLoading(false)
    }
  }

  async function publish() {
    if (!result) return
    setLoading(true)
    try {
      const res = await fetch(`/api/score-runs/${result.runId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, aiSummary }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.push('/admin/reports')
      router.refresh()
    } catch (e) {
      alert('Publish failed: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const steps = ['Upload CSV', 'Details', 'Review checks', 'Publish']

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium mb-1" style={{ color: 'var(--stone-900)' }}>
          Run readiness assessment
        </h2>
        <p className="text-sm" style={{ color: 'var(--stone-500)' }}>
          Upload your dataset — the system reads the date range automatically and runs five weighted readiness checks.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex border-b" style={{ borderColor: 'var(--earth-200)' }}>
        {steps.map((s, i) => (
          <button
            key={i}
            className={`tab-btn mr-6 ${step === i + 1 ? 'active' : ''}`}
            onClick={() => i + 1 < step ? setStep((i + 1) as Step) : undefined}
          >
            <span className="mr-1.5 text-xs">{i + 1}.</span>{s}
          </button>
        ))}
      </div>

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="card card-inner">
          <div className="label-upper mb-4">Upload dataset</div>
          <label
            className="block border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors"
            style={{ borderColor: 'var(--earth-300)', background: 'var(--sand-100)' }}
          >
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--stone-700)' }}>
              Drop CSV here or click to browse
            </div>
            <div className="text-xs" style={{ color: 'var(--stone-400)' }}>
              Date range is read automatically from the file. Supports transaction, marketing, financial, and time-series data.
            </div>
          </label>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 border-t" style={{ borderColor: 'var(--earth-200)' }} />
            <span className="text-xs" style={{ color: 'var(--stone-400)' }}>or</span>
            <div className="flex-1 border-t" style={{ borderColor: 'var(--earth-200)' }} />
          </div>
          <div className="mt-4 text-center">
            <button className="btn-secondary" onClick={loadDemo}>Load demo dataset</button>
          </div>
        </div>
      )}

      {/* Step 2 — Details (no extraction date) */}
      {step === 2 && (
        <div className="card card-inner space-y-5">
          <div>
            <div className="label-upper mb-3">File loaded</div>
            <div
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm"
              style={{ background: 'var(--earth-50)', border: '1px solid var(--earth-200)' }}
            >
              <span style={{ color: 'var(--stone-600)' }}>📄</span>
              <span style={{ color: 'var(--stone-700)' }}>{filename}</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--stone-400)' }}>
                Date range will be read from the data
              </span>
            </div>
          </div>

          <div>
            <div className="label-upper mb-3">Use case</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper text-xs block mb-1.5">Use case name</label>
                <input className="input-field" value={ucName} onChange={e => setUcName(e.target.value)} placeholder="e.g. Monthly Sales AI Insights" />
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">Business unit</label>
                <input className="input-field" value={ucBu} onChange={e => setUcBu(e.target.value)} placeholder="e.g. Commercial Analytics" />
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">AI output type</label>
                <select className="select-field" value={ucType} onChange={e => setUcType(e.target.value)}>
                  {UC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">Intended use</label>
                <input className="input-field" value={ucIntent} onChange={e => setUcIntent(e.target.value)} placeholder="e.g. Internal briefing only" />
              </div>
            </div>
          </div>

          <div>
            <div className="label-upper mb-3">Dataset details</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper text-xs block mb-1.5">Source system</label>
                <input className="input-field" value={sourceSystem} onChange={e => setSourceSystem(e.target.value)} placeholder="e.g. Shopify, Salesforce, SAP" />
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">Human reviewer</label>
                <input className="input-field" value={reviewerName} onChange={e => setReviewerName(e.target.value)} placeholder="Name, Role" />
              </div>
              <div className="col-span-2">
                <label className="label-upper text-xs block mb-1.5">Lineage documented?</label>
                <select className="select-field" value={lineageStatus} onChange={e => setLineageStatus(e.target.value)}>
                  {LINEAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-primary" onClick={runChecks} disabled={loading}>
              {loading ? 'Running checks...' : 'Run readiness checks'}
            </button>
            <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
          </div>
        </div>
      )}

      {/* Step 3 — Results */}
      {step === 3 && result && (
        <div className="space-y-4">
          {/* Score summary */}
          <div className="card card-inner">
            <div className="flex items-start gap-6">
              <div>
                <div className="text-4xl font-medium leading-none mb-1" style={{ color: scoreColor(result.score) }}>
                  {result.score}
                </div>
                <div className="text-xs mb-2" style={{ color: 'var(--stone-500)' }}>Overall score</div>
                <div className="text-sm font-medium" style={{ color: 'var(--stone-700)' }}>
                  {bandLabel(result.band)}
                </div>
              </div>
              <div className="border-l pl-6 flex-1" style={{ borderColor: 'var(--earth-200)' }}>
                <div className="flex gap-3 flex-wrap mb-2">
                  {result.detectedPeriod && (
                    <span className="text-xs px-2 py-1 rounded font-medium"
                      style={{ background: 'var(--sand-100)', color: 'var(--stone-700)', border: '1px solid var(--earth-200)' }}>
                      📅 {result.detectedPeriod}
                    </span>
                  )}
                  {result.datasetType && (
                    <span className="text-xs px-2 py-1 rounded font-medium"
                      style={{ background: 'var(--earth-100)', color: 'var(--earth-700)', border: '1px solid var(--earth-200)' }}>
                      {DATASET_TYPE_LABELS[result.datasetType] ?? result.datasetType}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--stone-500)' }}>
                  {result.permittedUse}
                </p>
              </div>
            </div>
          </div>

          {/* Check results */}
          <div className="card card-inner">
            <div className="label-upper mb-4">Check results</div>
            <div className="space-y-3">
              {result.checks.map((c, i) => (
                <div key={i} className="p-4 rounded-md border"
                  style={{ background: 'var(--sand-50)', borderColor: 'var(--earth-200)' }}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--stone-800)' }}>{c.checkName}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--stone-400)' }}>
                        {Math.round(c.weight * 100)}% weight
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-lg font-medium" style={{ color: scoreColor(c.score) }}>{c.score}</span>
                      <span className="text-xs px-2 py-0.5 rounded font-medium" style={{
                        background: c.status === 'pass' ? '#e8f0df' : c.status === 'warn' ? 'var(--earth-100)' : '#fcf0ec',
                        color: statusColor(c.status),
                        border: `1px solid ${c.status === 'pass' ? '#c2d9a8' : c.status === 'warn' ? 'var(--earth-300)' : '#f0b8a8'}`,
                      }}>
                        {statusLabel(c.status)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--stone-600)' }}>{c.finding}</p>
                </div>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={() => setStep(4)}>Continue to publish</button>
        </div>
      )}

      {/* Step 4 — Publish */}
      {step === 4 && result && (
        <div className="space-y-4">
          <div className="card card-inner">
            <div className="label-upper mb-3">Summary — generated from checks</div>
            <div className="space-y-4 text-sm">
              <div>
                <div className="label-upper mb-1" style={{ color: 'var(--sienna-600)', fontSize: '10px' }}>What the data shows</div>
                <p style={{ color: 'var(--stone-700)', lineHeight: '1.6' }}>{result.diagnosis}</p>
              </div>
              <div>
                <div className="label-upper mb-1" style={{ color: 'var(--earth-600)', fontSize: '10px' }}>What this means for AI use</div>
                <p style={{ color: 'var(--stone-700)', lineHeight: '1.6' }}>{result.guidingPolicy}</p>
              </div>
              <div>
                <div className="label-upper mb-1" style={{ color: '#4a6030', fontSize: '10px' }}>What needs to happen next</div>
                <p className="whitespace-pre-line" style={{ color: 'var(--stone-700)', lineHeight: '1.6' }}>{result.coherentActions}</p>
              </div>
            </div>
          </div>

          <div className="card card-inner">
            <div className="label-upper mb-3">Analyst notes</div>
            <textarea
              className="textarea-field"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add caveats, context, or findings for the record..."
            />
          </div>

          <div className="card card-inner">
            <div className="label-upper mb-1">Plain-language AI summary</div>
            <p className="text-xs mb-3" style={{ color: 'var(--stone-500)' }}>
              One AI call, manually triggered. Writes a plain narrative for the public report.
            </p>
            {aiSummary && (
              <div className="p-4 rounded-md text-sm leading-relaxed mb-3"
                style={{ background: 'var(--earth-50)', border: '1px solid var(--earth-200)', color: 'var(--stone-700)' }}>
                {aiSummary}
              </div>
            )}
            <button className="btn-secondary text-sm" onClick={generateAI} disabled={aiLoading}>
              {aiLoading ? 'Generating...' : aiSummary ? 'Regenerate' : 'Generate plain-language summary (1 AI call)'}
            </button>
          </div>

          <div className="flex gap-3">
            <button className="btn-primary" onClick={publish} disabled={loading}>
              {loading ? 'Publishing...' : 'Approve and publish to dashboard'}
            </button>
            <button className="btn-secondary" onClick={() => setStep(3)}>Back</button>
          </div>
        </div>
      )}
    </div>
  )
}
