import { prisma } from '@/lib/prisma'
import { scoreColor } from '@/types'
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
  return runs.map(r => ({ period: r.dataset.period, score: r.overallScore }))
}

function bandLabel(band: string) {
  if (band === 'ready') return 'Ready'
  if (band === 'usable') return 'Usable with controls'
  if (band === 'limited') return 'Limited use'
  return 'Not ready'
}

function bandStyle(band: string): { bg: string; color: string; border: string } {
  if (band === 'ready')    return { bg: '#e8f0df', color: '#3a5a1f', border: '#c2d9a8' }
  if (band === 'usable')   return { bg: 'var(--earth-100)', color: 'var(--earth-800)', border: 'var(--earth-300)' }
  if (band === 'limited')  return { bg: '#fcf0ec', color: '#742c1f', border: '#f0b8a8' }
  return { bg: '#f8e8e5', color: '#552015', border: '#e5b0a5' }
}

export default async function DashboardPage() {
  const [report, govActions, trend] = await Promise.all([
    getActiveReport(), getGovActions(), getTrend(),
  ])

  const maxTrendScore = trend.length ? Math.max(...trend.map(t => t.score)) : 100
  const prevScore = trend.length >= 2 ? trend[trend.length - 2].score : null
  const currScore = report?.scoreRun.overallScore ?? null
  const delta = currScore !== null && prevScore !== null ? currScore - prevScore : null
  const bs = report ? bandStyle(report.scoreRun.band) : null

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>

      {/* Topbar */}
      <header className="topbar sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--earth-600)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--stone-800)' }}>
              AI Readiness Monitor
            </span>
          </div>
          <Link
            href="/login"
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ color: 'var(--stone-500)', background: 'var(--earth-100)', border: '1px solid var(--earth-200)' }}
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">

        {/* Page header */}
        <div>
          <h1 className="text-lg sm:text-xl font-medium mb-0.5" style={{ color: 'var(--stone-900)' }}>
            AI Insight Readiness
          </h1>
          <p className="text-sm" style={{ color: 'var(--stone-500)' }}>
            {report
              ? `${report.period} · Updated ${formatDistanceToNow(new Date(report.publishedAt), { addSuffix: true })}`
              : 'Monthly commercial data assessment'}
          </p>
        </div>

        {!report ? (
          <div className="card card-inner text-center py-16">
            <p className="text-sm mb-4" style={{ color: 'var(--stone-500)' }}>
              No published report yet. Sign in to run the first assessment.
            </p>
            <Link href="/login" className="btn-primary inline-block">Go to admin</Link>
          </div>
        ) : (
          <>
            {/* ── Score hero ── */}
            <div className="card card-inner">
              {/* Score row */}
              <div className="flex items-start gap-5 mb-5">
                <div className="flex-shrink-0">
                  <div
                    className="text-5xl sm:text-6xl font-medium leading-none mb-1"
                    style={{ color: scoreColor(report.scoreRun.overallScore) }}
                  >
                    {report.scoreRun.overallScore}
                  </div>
                  <div className="label-upper mb-2" style={{ fontSize: '10px' }}>out of 100</div>
                  <span
                    className="inline-block px-2.5 py-1 rounded text-xs font-medium"
                    style={{ background: bs?.bg, color: bs?.color, border: `1px solid ${bs?.border}` }}
                  >
                    {bandLabel(report.scoreRun.band)}
                  </span>
                  {delta !== null && (
                    <div
                      className="mt-2 text-xs font-medium"
                      style={{ color: delta > 0 ? '#5a7a3a' : delta < 0 ? 'var(--sienna-600)' : 'var(--stone-400)' }}
                    >
                      {delta > 0 ? `↑ +${delta}` : delta < 0 ? `↓ ${delta}` : '→ No change'} from last month
                    </div>
                  )}
                </div>

                {/* Permitted use — prominent on mobile */}
                <div
                  className="flex-1 rounded-lg px-4 py-3"
                  style={{ background: 'var(--earth-100)', border: '1px solid var(--earth-200)' }}
                >
                  <div className="label-upper mb-1.5" style={{ fontSize: '10px' }}>Permitted use this month</div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--earth-900)' }}>
                    {report.permittedUse}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t mb-5" style={{ borderColor: 'var(--earth-100)' }} />

              {/* Three narrative sections — stacked on mobile */}
              <div className="space-y-4">
                <div>
                  <div className="label-upper mb-1.5" style={{ color: 'var(--sienna-600)', fontSize: '10px' }}>
                    What the data shows
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--stone-700)' }}>
                    {report.diagnosis}
                  </p>
                </div>
                <div>
                  <div className="label-upper mb-1.5" style={{ color: 'var(--earth-700)', fontSize: '10px' }}>
                    What this means for AI use
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--stone-700)' }}>
                    {report.guidingPolicy}
                  </p>
                </div>
                <div>
                  <div className="label-upper mb-1.5" style={{ color: '#5a7a3a', fontSize: '10px' }}>
                    What needs to happen next
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--stone-700)' }}>
                    {report.coherentActions}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Score by area + trend — stack on mobile, side-by-side on sm+ ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Score by area */}
              <div className="card card-inner">
                <div className="label-upper mb-4" style={{ fontSize: '10px' }}>Score by area</div>
                <div className="space-y-3">
                  {report.scoreRun.checkResults.map(c => (
                    <div key={c.id}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs" style={{ color: 'var(--stone-600)' }}>{c.checkName}</span>
                        <span className="text-xs font-medium" style={{ color: scoreColor(c.score) }}>{c.score}</span>
                      </div>
                      <div className="fw-bar-bg">
                        <div className="fw-bar-fill" style={{ width: `${c.score}%`, background: scoreColor(c.score) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score trend — only shown with 2+ assessments */}
              <div className="card card-inner">
                <div className="label-upper mb-4" style={{ fontSize: '10px' }}>Score trend</div>
                {trend.length < 2 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm mb-1" style={{ color: 'var(--stone-500)' }}>
                      Trend appears after two assessments
                    </p>
                    <p className="text-xs" style={{ color: 'var(--stone-400)' }}>
                      Run a second assessment next month to start tracking improvement over time.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-end gap-1.5 h-20 mb-3">
                      {trend.map((t, i) => {
                        const h = Math.round((t.score / maxTrendScore) * 64)
                        const isLast = i === trend.length - 1
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 justify-end h-full">
                            <span
                              className="text-xs font-medium"
                              style={{ color: isLast ? 'var(--earth-700)' : 'var(--stone-400)', fontSize: '10px' }}
                            >
                              {t.score}
                            </span>
                            <div
                              className="w-full rounded-t"
                              style={{
                                height: `${h}px`,
                                minHeight: '4px',
                                background: isLast ? 'var(--earth-500)' : 'var(--earth-200)',
                              }}
                            />
                            <span className="text-xs" style={{ color: 'var(--stone-400)', fontSize: '10px' }}>
                              {t.period.split(' ')[0].slice(0, 3)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {delta !== null && (
                      <p className="text-xs" style={{ color: 'var(--stone-500)' }}>
                        {delta > 0
                          ? `Up ${delta} points from last month.`
                          : delta < 0
                          ? `Down ${Math.abs(delta)} points — investigate what changed.`
                          : 'Held steady from last month.'}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Governance improvement log ── */}
            <div className="card card-inner">
              <div className="flex items-baseline justify-between mb-1">
                <div className="label-upper" style={{ fontSize: '10px' }}>Improvement log</div>
                <span className="text-xs" style={{ color: 'var(--stone-400)' }}>
                  {govActions.length} action{govActions.length !== 1 ? 's' : ''} recorded
                </span>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--stone-500)' }}>
                Concrete steps taken to improve data quality and AI oversight.
              </p>
              {govActions.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--stone-400)' }}>No actions logged yet.</p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--earth-100)' }}>
                  {govActions.map(g => (
                    <div key={g.id} className="flex gap-3 py-3">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2"
                        style={{ background: 'var(--earth-500)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium mb-0.5 leading-snug" style={{ color: 'var(--stone-800)' }}>
                          {g.action}
                        </div>
                        <div className="text-xs mb-1" style={{ color: 'var(--stone-400)' }}>
                          {format(new Date(g.loggedAt), 'MMM d, yyyy')}
                          {g.logger.name ? ` · ${g.logger.name}` : ''}
                        </div>
                        <p className="text-sm" style={{ color: 'var(--stone-600)', lineHeight: '1.5' }}>{g.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </>
        )}

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-xs" style={{ color: 'var(--stone-400)' }}>
            AI Readiness Monitor · Commercial data assessment
          </p>
        </div>

      </main>
    </div>
  )
}
