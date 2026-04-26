export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

async function getData() {
  const [fw, govActions, latestRun] = await Promise.all([
    prisma.frameworkState.findMany(),
    prisma.govAction.findMany({
      orderBy: { loggedAt: 'desc' },
      take: 20,
      include: { logger: { select: { name: true } } },
    }),
    prisma.scoreRun.findFirst({
      where: { status: 'published' },
      orderBy: { runAt: 'desc' },
      include: { checkResults: true, dataset: true },
    }),
  ])
  return { fw, govActions, latestRun }
}

function fwColor(pct: number) {
  if (pct >= 70) return '#5a7a3a'
  if (pct >= 40) return '#9e623a'
  return '#b84a34'
}

export default async function StrategyPage() {
  const { fw, govActions, latestRun } = await getData()
  const nist = fw.find(f => f.framework === 'NIST')
  const iso  = fw.find(f => f.framework === 'ISO')
  const nistPct = nist ? Math.round((nist.metCount / nist.totalCount) * 100) : 0
  const isoPct  = iso  ? Math.round((iso.metCount  / iso.totalCount)  * 100) : 0

  const nistNextGaps = [
    'Immutable audit log (Manage)',
    'Action tracking with owners and due dates (Manage)',
    'Model output and drift monitoring (Measure)',
    'Organisational AI risk culture programme (Govern)',
  ]
  const isoNextGaps = [
    'AI policy document signed by leadership (Clause 5)',
    'Internal audit programme established (Clause 9.2)',
    'Management review cadence defined (Clause 9.3)',
    'Nonconformity and corrective action register (Clause 10.1)',
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium mb-1" style={{ color: 'var(--stone-900)' }}>
          AI data governance strategy
        </h2>
        <p className="text-sm" style={{ color: 'var(--stone-500)' }}>
          Structured on Rumelt's good strategy framework. This document drives what is published, what is fixed next, and how progress is measured.
        </p>
      </div>

      {/* Rumelt three-part */}
      <div className="space-y-3">
        <div className="stripe-diagnosis rounded-r-lg p-5">
          <div className="label-upper mb-2" style={{ color: 'var(--sienna-600)' }}>
            Core challenge — what we are solving
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#4a1a10' }}>
            Commercial transaction data is used monthly to generate AI insights that inform business decisions. The fundamental obstacle is that AI systems present outputs with uniform confidence regardless of input quality. Missing customer IDs, inconsistent business rules, and undocumented data lineage create systematic errors that are invisible in the AI output itself. Without a scored, monthly readiness gate, weak data produces confident-sounding but unreliable insights — and organisations act on them without knowing.
          </p>
        </div>

        <div className="stripe-policy rounded-r-lg p-5">
          <div className="label-upper mb-2" style={{ color: 'var(--earth-700)' }}>
            Our approach — how we respond to it
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--earth-900)' }}>
            Data readiness is treated as a scored monthly gate, not a one-time setup. AI outputs are only permitted at the level their underlying data quality supports — and that level is stated explicitly and publicly. Governance improvements are recorded as traceable actions, not assumed. Progress toward NIST AI RMF and ISO 42001 is tracked internally as evidence of closed gaps, not claimed as compliance. The strategy is internal; the evidence of it is public.
          </p>
        </div>

        <div className="stripe-actions rounded-r-lg p-5">
          <div className="label-upper mb-2" style={{ color: '#4a6030' }}>
            Actions — what we are doing about it
          </div>
          <ol className="space-y-2">
            {[
              'Run a scored readiness assessment every month and publish the result publicly — score, band, plain-language meaning, and permitted use.',
              'Record every governance action taken as a dated, attributed entry — not as a claimed status. The public governance log is the evidence trail.',
              'Use the score band as the enforcement mechanism: AI outputs are restricted to what the data quality justifies. This is not advisory.',
              'Close NIST AI RMF and ISO 42001 gaps sequentially by logging real actions against specific framework areas. Progress advances only when work is done.',
              'Generate the plain-language public narrative using one targeted AI call per published report — keeping cost minimal and purpose clear.',
            ].map((a, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: '#2d4a18' }}>
                <span className="font-medium flex-shrink-0">{i + 1}.</span>
                <span>{a}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Framework alignment — internal accountability view */}
      <div className="card card-inner">
        <div className="label-upper mb-1">Framework alignment</div>
        <p className="text-sm mb-5" style={{ color: 'var(--stone-500)' }}>
          Internal accountability view. Not published to the public dashboard. Progress advances only when governance actions are logged against specific framework areas.
        </p>

        <div className="grid grid-cols-2 gap-8">
          {/* NIST */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--stone-800)' }}>NIST AI RMF</span>
              <span className="text-xs" style={{ color: 'var(--stone-500)' }}>
                {nist?.metCount ?? 0} of {nist?.totalCount ?? 15} · {nistPct}%
              </span>
            </div>
            <div className="fw-bar-bg mb-3">
              <div className="fw-bar-fill" style={{ width: `${nistPct}%`, background: fwColor(nistPct) }} />
            </div>
            <div className="label-upper mb-2" style={{ color: 'var(--stone-500)' }}>Open gaps</div>
            <ul className="space-y-1.5">
              {nistNextGaps.map((g, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--stone-600)' }}>
                  <span style={{ color: 'var(--earth-400)' }}>—</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>

          {/* ISO */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--stone-800)' }}>ISO 42001</span>
              <span className="text-xs" style={{ color: 'var(--stone-500)' }}>
                {iso?.metCount ?? 0} of {iso?.totalCount ?? 16} · {isoPct}%
              </span>
            </div>
            <div className="fw-bar-bg mb-3">
              <div className="fw-bar-fill" style={{ width: `${isoPct}%`, background: fwColor(isoPct) }} />
            </div>
            <div className="label-upper mb-2" style={{ color: 'var(--stone-500)' }}>Open gaps</div>
            <ul className="space-y-1.5">
              {isoNextGaps.map((g, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--stone-600)' }}>
                  <span style={{ color: 'var(--earth-400)' }}>—</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Latest run summary */}
      {latestRun && (
        <div className="card card-inner">
          <div className="label-upper mb-3">Latest assessment — {latestRun.dataset.period}</div>
          <div className="grid grid-cols-5 gap-3">
            {latestRun.checkResults.map(c => (
              <div key={c.id} className="text-center">
                <div
                  className="text-2xl font-medium mb-1"
                  style={{ color: c.score >= 80 ? '#5a7a3a' : c.score >= 65 ? '#9e623a' : '#b84a34' }}
                >
                  {c.score}
                </div>
                <div className="text-xs" style={{ color: 'var(--stone-500)' }}>{c.checkName}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
