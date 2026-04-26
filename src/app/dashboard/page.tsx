import { prisma } from '@/lib/prisma'
import { BAND_INFO, scoreColor } from '@/types'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getActiveReport() {
  return prisma.publicReport.findFirst({
    where: { isActive: true },
    orderBy: { publishedAt: 'desc' },
    include: {
      scoreRun: {
        include: {
          checkResults: { orderBy: { weight: 'desc' } },
          dataset: true,
          useCase: true,
        },
      },
    },
  })
}

async function getGovActions() {
  return prisma.govAction.findMany({
    where: { isPublic: true },
    orderBy: { loggedAt: 'desc' },
    take: 10,
    include: { logger: { select: { name: true } } },
  })
}

async function getTrend() {
  const runs = await prisma.scoreRun.findMany({
    where: { status: 'published' },
    orderBy: { runAt: 'asc' },
    take: 6,
    include: { dataset: { select: { period: true } } },
  })
  return runs.map(r => ({ period: r.dataset.period, score: r.overallScore, runAt: r.runAt }))
}

async function getFrameworkState() {
  return prisma.frameworkState.findMany()
}

export default async function DashboardPage() {
  const [report, govActions, trend, fwState] = await Promise.all([
    getActiveReport(), getGovActions(), getTrend(), getFrameworkState(),
  ])

  const bi = report ? BAND_INFO[report.scoreRun.band] ?? BAND_INFO.notready : null
  const nist = fwState.find(f => f.framework === 'NIST')
  const iso  = fwState.find(f => f.framework === 'ISO')
  const nistPct = nist ? Math.round((nist.metCount / nist.totalCount) * 100) : 0
  const isoPct  = iso  ? Math.round((iso.metCount  / iso.totalCount)  * 100) : 0

  const maxTrendScore = trend.length ? Math.max(...trend.map(t => t.score)) : 100
  const prevScore = trend.length >= 2 ? trend[trend.length - 2].score : null
  const currScore = report?.scoreRun.overallScore ?? null
  const delta = currScore !== null && prevScore !== null ? currScore - prevScore : null

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      {/* Topbar */}
      <header className="topbar sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--earth-600)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--stone-800)' }}>
              AI Readiness Monitor
            </span>
          </div>
          <nav className="flex gap-1">
            <span className="nav-link active">Public dashboard</span>
            <Link href="/admin" className="nav-link">Admin</Link>
          </nav>
          {report && (
            <span className="text-xs" style={{ color: 'var(--stone-500)' }}>
              Updated {formatDistanceToNow(new Date(report.publishedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-medium mb-1" style={{ color: 'var(--stone-900)' }}>
            AI Insight Readiness
          </h1>
          <p className="text-sm" style={{ color: 'var(--stone-500)' }}>
            Monthly commercial data assessment
            {report ? ` · ${report.period}` : ''}
          </p>
        </div>

        {!report ? (
          <div className="card card-inner text-center py-16">
            <p style={{ color: 'var(--stone-500)' }} className="text-sm">
              No published report yet. Sign in to the admin area to run the first assessment.
            </p>
            <Link href="/admin" className="btn-primary inline-block mt-4">Go to admin</Link>
          </div>
        ) : (
          <>
            {/* Score hero — Rumelt framing */}
            <div className="card card-inner mb-5">
              <div className="flex gap-8 items-start">
                {/* Score */}
                <div className="flex-shrink-0 min-w-[130px]">
                  <div className="text-5xl font-medium leading-none mb-2" style={{ color: scoreColor(report.scoreRun.overallScore) }}>
                    {report.scoreRun.overallScore}
                  </div>
                  <div className="label-upper mb-2">Overall score</div>
                  <span
                    className="inline-block px-2.5 py-1 rounded text-xs font-medium"
                    style={{ background: 'var(--earth-100)', color: 'var(--earth-800)', border: '1px solid var(--earth-200)' }}
                  >
                    {bi?.label}
                  </span>
                  {delta !== null && (
                    <div className="mt-2 text-xs" style={{ color: delta > 0 ? '#5a7a3a' : delta < 0 ? 'var(--sienna-600)' : 'var(--stone-500)' }}>
                      {delta > 0 ? `+${delta}` : delta} from last month
                    </div>
                  )}
                </div>

                {/* Rumelt three-part */}
                <div className="flex-1 border-l pl-8" style={{ borderColor: 'var(--earth-200)' }}>
                  <div className="space-y-4">
                    <div>
                      <div className="label-upper mb-1.5" style={{ color: 'var(--sienna-600)' }}>What the data shows</div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--stone-700)' }}>
                        {report.diagnosis}
                      </p>
                    </div>
                    <div>
                      <div className="label-upper mb-1.5" style={{ color: 'var(--earth-600)' }}>What this means for AI use</div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--stone-700)' }}>
                        {report.guidingPolicy}
                      </p>
                    </div>
                    <div>
                      <div className="label-upper mb-1.5" style={{ color: '#5a7a3a' }}>What needs to happen next</div>
                      <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--stone-700)' }}>
                        {report.coherentActions}
                      </div>
                    </div>
                  </div>

                  {/* Permitted use box */}
                  <div className="mt-5 rounded-md px-4 py-3" style={{ background: 'var(--earth-100)', border: '1px solid var(--earth-200)' }}>
                    <div className="label-upper mb-1">Permitted use this month</div>
                    <p className="text-sm" style={{ color: 'var(--earth-800)' }}>{report.permittedUse}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Two-col: checks + trend */}
            <div className="grid grid-cols-2 gap-5 mb-5">
              {/* Score by area */}
              <div className="card card-inner">
                <div className="label-upper mb-4">Score by area</div>
                <div className="space-y-3">
                  {report.scoreRun.checkResults.map(c => (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="text-sm w-32 flex-shrink-0" style={{ color: 'var(--stone-700)' }}>
                        {c.checkName}
                      </span>
                      <div className="flex-1 fw-bar-bg">
                        <div
                          className="fw-bar-fill"
                          style={{ width: `${c.score}%`, background: scoreColor(c.score) }}
                        />
                      </div>
                      <span className="text-xs font-medium w-7 text-right" style={{ color: scoreColor(c.score) }}>
                        {c.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend */}
              <div className="card card-inner">
                <div className="label-upper mb-4">Score trend</div>
                {trend.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--stone-400)' }}>No historical data yet.</p>
                ) : (
                  <>
                    <div className="flex items-end gap-2 h-20 mb-3">
                      {trend.map((t, i) => {
                        const h = Math.round((t.score / maxTrendScore) * 68)
                        const isLast = i === trend.length - 1
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 justify-end h-full">
                            <span className="text-xs font-medium" style={{ color: isLast ? 'var(--earth-700)' : 'var(--stone-400)' }}>
                              {t.score}
                            </span>
                            <div
                              className="w-full rounded-t"
                              style={{
                                height: `${h}px`,
                                background: isLast ? 'var(--earth-500)' : 'var(--earth-200)',
                                minHeight: '4px',
                              }}
                            />
                            <span className="text-xs" style={{ color: 'var(--stone-400)' }}>
                              {t.period.split(' ')[0].slice(0, 3)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {delta !== null && (
                      <p className="text-xs" style={{ color: 'var(--stone-500)' }}>
                        {delta > 0
                          ? `Score improved by ${delta} points from last month — governance actions are working.`
                          : delta < 0
                          ? `Score dropped ${Math.abs(delta)} points from last month — investigate what changed.`
                          : 'Score held steady from last month.'}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Governance improvement log */}
            <div className="card card-inner">
              <div className="label-upper mb-2">Governance improvement log</div>
              <p className="text-sm mb-5" style={{ color: 'var(--stone-500)' }}>
                Concrete actions taken to close data quality and framework gaps.{' '}
                {govActions.length} action{govActions.length !== 1 ? 's' : ''} recorded to date.
              </p>
              {govActions.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--stone-400)' }}>No governance actions logged yet.</p>
              ) : (
                <div className="space-y-0 divide-y" style={{ borderColor: 'var(--earth-100)' }}>
                  {govActions.map(g => (
                    <div key={g.id} className="flex gap-3 py-3.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: 'var(--earth-500)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--stone-800)' }}>
                          {g.action}
                        </div>
                        <div className="text-xs mb-1" style={{ color: 'var(--stone-500)' }}>
                          {g.framework} · {format(new Date(g.loggedAt), 'MMM d, yyyy')}
                          {g.logger.name ? ` · ${g.logger.name}` : ''}
                        </div>
                        <p className="text-sm" style={{ color: 'var(--stone-600)' }}>{g.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
