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
  checks: CheckResult[]
  diagnosis: string
  guidingPolicy: string
  coherentActions: string
  permittedUse: string
}

const LINEAGE_OPTIONS = [
  { value: 'full', label: 'Yes — full source-to-output map' },
  { value: 'partial', label: 'Partial — source known, transforms unclear' },
  { value: 'none', label: 'No lineage documentation' },
]

const UC_TYPES = [
  'Sales trend summary', 'Customer segment insights',
  'Churn prediction narrative', 'Product performance report',
]

function statusColor(s: string) {
  if (s === 'pass') return '#5a7a3a'
  if (s === 'warn') return '#9e623a'
  return '#b84a34'
}
function statusLabel(s: string) {
  if (s === 'pass') return 'Pass'
  if (s === 'warn') return 'Warning'
  return 'Fail'
}
function scoreColor(n: number) {
  if (n >= 80) return '#5a7a3a'
  if (n >= 65) return '#9e623a'
  return '#b84a34'
}

export default function AssessPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [csvText, setCsvText] = useState<string | null>(null)
  const [filename, setFilename] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [notes, setNotes] = useState('')

  // Step 2 meta fields
  const [ucName, setUcName] = useState('')
  const [ucBu, setUcBu] = useState('')
  const [ucType, setUcType] = useState(UC_TYPES[0])
  const [ucIntent, setUcIntent] = useState('')
  const [period, setPeriod] = useState('')
  const [sourceSystem, setSourceSystem] = useState('')
  const [extractedAt, setExtractedAt] = useState('')
  const [lineageStatus, setLineageStatus] = useState('partial')
  const [reviewerName, setReviewerName] = useState('')
  const [rowCount, setRowCount] = useState('')

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
    // Simulate a demo CSV with realistic transaction data
    const header = 'transaction_id,customer_id,product_category,transaction_value,return_status,transaction_date'
    const rows: string[] = [header]
    const categories = ['Electronics', 'Apparel', 'Home', 'Beauty', 'Sports', 'Books', 'Toys', 'Food', 'Garden', 'Auto', 'Health', 'Office']
    const returnCodes = { Electronics: 'RET', Apparel: 'RTN', Home: 'RETURN', Beauty: 'RET', Sports: 'RTN', Books: 'RET', Toys: 'RET', Food: 'VOID', Garden: 'RTN', Auto: 'RETURN', Health: 'RET', Office: 'RTN' }
    for (let i = 1; i <= 4218; i++) {
      const custId = Math.random() > 0.14 ? `CUST${String(Math.floor(Math.random() * 50000)).padStart(6, '0')}` : ''
      const cat = categories[Math.floor(Math.random() * categories.length)]
      const val = Math.random() > 0.08 ? (Math.random() * 500 + 10).toFixed(2) : ''
      const ret = Math.random() > 0.85 ? returnCodes[cat as keyof typeof returnCodes] : 'SALE'
      const date = `2025-04-${String(Math.floor(Math.random() * 30) + 1).padStart(2, '0')}`
      rows.push(`TXN${String(i).padStart(7, '0')},${custId},${cat},${val},${ret},${date}`)
    }
    setCsvText(rows.join('\n'))
    setFilename('demo_transactions_apr2025.csv')
    setPeriod('April 2025')
    setSourceSystem('Shopify + Salesforce')
    setReviewerName('Jane Smith, Analytics Lead')
    setLineageStatus('partial')
    setRowCount('4218')
    setExtractedAt('2025-04-19')
    setUcName('Monthly Sales AI Insights — April 2025')
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
          csvText,
          filename,
          ucName, ucBu, ucType, ucIntent,
          period, sourceSystem, extractedAt, lineageStatus, reviewerName,
          rowCount: rowCount ? parseInt(rowCount) : null,
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
      setAiSummary(data.summary)
    } catch {
      alert('Could not generate AI summary.')
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

  const steps = ['Upload CSV', 'Metadata', 'Review checks', 'Publish']

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium mb-1" style={{ color: 'var(--stone-900)' }}>Run readiness assessment</h2>
        <p className="text-sm" style={{ color: 'var(--stone-500)' }}>Upload commercial transaction data and run the five weighted readiness checks.</p>
      </div>

      {/* Stepper */}
      <div className="flex border-b" style={{ borderColor: 'var(--earth-200)' }}>
        {steps.map((s, i) => (
          <button
            key={i}
            className={`tab-btn mr-6 ${step === i + 1 ? 'active' : ''}`}
            onClick={() => i + 1 < step ? setStep((i + 1) as Step) : null}
          >
            <span className="mr-1.5 text-xs">{i + 1}.</span>{s}
          </button>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="card card-inner">
          <div className="label-upper mb-4">Upload dataset</div>
          <label className="block border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors"
            style={{ borderColor: 'var(--earth-300)', background: 'var(--sand-100)' }}
            onDragOver={e => e.preventDefault()}>
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--stone-700)' }}>Drop CSV here or click to browse</div>
            <div className="text-xs" style={{ color: 'var(--stone-400)' }}>Expects columns: customer_id, transaction_value, return_status, product_category</div>
          </label>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 border-t" style={{ borderColor: 'var(--earth-200)' }} />
            <span className="text-xs" style={{ color: 'var(--stone-400)' }}>or</span>
            <div className="flex-1 border-t" style={{ borderColor: 'var(--earth-200)' }} />
          </div>
          <div className="mt-4 text-center">
            <button className="btn-secondary" onClick={loadDemo}>Load demo dataset (4,218 rows)</button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="card card-inner space-y-5">
          <div>
            <div className="label-upper mb-3">Use case</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper text-xs block mb-1.5">Use case name</label>
                <input className="input-field" value={ucName} onChange={e => setUcName(e.target.value)} placeholder="Monthly Sales AI Insights — May 2025" />
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">Business unit</label>
                <input className="input-field" value={ucBu} onChange={e => setUcBu(e.target.value)} placeholder="Commercial Analytics" />
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">AI output type</label>
                <select className="select-field" value={ucType} onChange={e => setUcType(e.target.value)}>
                  {UC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">Intended use</label>
                <input className="input-field" value={ucIntent} onChange={e => setUcIntent(e.target.value)} placeholder="Internal briefing only" />
              </div>
            </div>
          </div>

          <div>
            <div className="label-upper mb-3">Dataset metadata</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-upper text-xs block mb-1.5">Data period</label>
                <input className="input-field" value={period} onChange={e => setPeriod(e.target.value)} placeholder="May 2025" />
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">Source system</label>
                <input className="input-field" value={sourceSystem} onChange={e => setSourceSystem(e.target.value)} placeholder="Shopify + Salesforce" />
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">Extraction date</label>
                <input className="input-field" type="date" value={extractedAt} onChange={e => setExtractedAt(e.target.value)} />
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">Human reviewer</label>
                <input className="input-field" value={reviewerName} onChange={e => setReviewerName(e.target.value)} placeholder="Name, Role" />
              </div>
              <div>
                <label className="label-upper text-xs block mb-1.5">Row count</label>
                <input className="input-field" type="number" value={rowCount} onChange={e => setRowCount(e.target.value)} placeholder="4218" />
              </div>
              <div>
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

      {/* Step 3 — check results */}
      {step === 3 && result && (
        <div className="space-y-4">
          {/* Score summary */}
          <div className="card card-inner">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-4xl font-medium leading-none mb-1" style={{ color: scoreColor(result.score) }}>
                  {result.score}
                </div>
                <div className="text-xs" style={{ color: 'var(--stone-500)' }}>Overall score</div>
              </div>
              <div className="border-l pl-6" style={{ borderColor: 'var(--earth-200)' }}>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--stone-800)' }}>
                  {result.band === 'ready' ? 'Ready' : result.band === 'usable' ? 'Usable with controls' : result.band === 'limited' ? 'Limited use' : 'Not ready'}
                </div>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--stone-500)' }}>{result.permittedUse}</div>
              </div>
            </div>
          </div>

          {/* Check results */}
          <div className="card card-inner">
            <div className="label-upper mb-4">Check results</div>
            <div className="space-y-3">
              {result.checks.map((c, i) => (
                <div key={i} className="p-4 rounded-md border" style={{ background: 'var(--sand-50)', borderColor: 'var(--earth-200)' }}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--stone-800)' }}>{c.checkName}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--stone-400)' }}>{Math.round(c.weight * 100)}% weight</span>
                    </div>
                    <div className="flex items-center gap-2">
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

      {/* Step 4 — publish */}
      {step === 4 && result && (
        <div className="space-y-4">
          <div className="card card-inner">
            <div className="label-upper mb-3">Rumelt strategy — generated from checks</div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="label-upper mb-1" style={{ color: 'var(--sienna-600)' }}>Diagnosis</div>
                <p style={{ color: 'var(--stone-700)' }}>{result.diagnosis}</p>
              </div>
              <div>
                <div className="label-upper mb-1" style={{ color: 'var(--earth-600)' }}>Guiding policy</div>
                <p style={{ color: 'var(--stone-700)' }}>{result.guidingPolicy}</p>
              </div>
              <div>
                <div className="label-upper mb-1" style={{ color: '#4a6030' }}>Coherent actions</div>
                <p className="whitespace-pre-line" style={{ color: 'var(--stone-700)' }}>{result.coherentActions}</p>
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
            <div className="label-upper mb-2">Plain-language AI summary</div>
            <p className="text-xs mb-3" style={{ color: 'var(--stone-500)' }}>
              One Claude API call, manually triggered. Generates a plain-language narrative for the public report.
            </p>
            {aiSummary ? (
              <div className="p-4 rounded-md text-sm leading-relaxed mb-3"
                style={{ background: 'var(--earth-50)', border: '1px solid var(--earth-200)', color: 'var(--stone-700)' }}>
                {aiSummary}
              </div>
            ) : null}
            <button className="btn-secondary text-sm" onClick={generateAI} disabled={aiLoading}>
              {aiLoading ? 'Generating...' : aiSummary ? 'Regenerate summary' : 'Generate plain-language summary (1 AI call)'}
            </button>
          </div>

          <div className="flex gap-3">
            <button className="btn-primary" onClick={publish} disabled={loading}>
              {loading ? 'Publishing...' : 'Approve and publish to public dashboard'}
            </button>
            <button className="btn-secondary" onClick={() => setStep(3)}>Back</button>
          </div>
        </div>
      )}
    </div>
  )
}
