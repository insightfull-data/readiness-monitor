export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { scoreColor } from '@/types'
import ReportActions from '@/components/admin/ReportActions'

async function getReports() {
  return prisma.publicReport.findMany({
    orderBy: { publishedAt: 'desc' },
    include: {
      scoreRun: {
        include: { dataset: true, useCase: true },
      },
    },
  })
}

async function getAuditLogs() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { name: true, email: true } } },
  })
}

export default async function ReportsPage() {
  const [reports, auditLogs] = await Promise.all([getReports(), getAuditLogs()])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium mb-1" style={{ color: 'var(--stone-900)' }}>Reports</h2>
        <p className="text-sm" style={{ color: 'var(--stone-500)' }}>
          Manage published reports. Only one report is active on the public dashboard at a time.
        </p>
      </div>

      <div className="card card-inner">
        <div className="label-upper mb-4">All reports</div>
        {reports.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--stone-400)' }}>No reports yet. Run an assessment to create the first one.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--earth-100)' }}>
            {reports.map(r => (
              <div key={r.id} className="flex items-start gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--stone-800)' }}>
                      {r.scoreRun.useCase.name}
                    </span>
                    {r.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: '#e8f0df', color: '#3a5a1f', border: '1px solid #c2d9a8' }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs mb-1" style={{ color: 'var(--stone-400)' }}>
                    {r.period} · Published {format(new Date(r.publishedAt), 'MMM d, yyyy')} · {r.scoreRun.useCase.businessUnit}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium" style={{ color: scoreColor(r.scoreRun.overallScore) }}>
                      Score: {r.scoreRun.overallScore}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--stone-400)' }}>·</span>
                    <span className="text-xs" style={{ color: 'var(--stone-500)' }}>
                      {r.scoreRun.dataset.sourceSystem}
                    </span>
                  </div>
                </div>
                <ReportActions reportId={r.id} isActive={r.isActive} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Immutable audit log */}
      <div className="card card-inner">
        <div className="label-upper mb-4">Audit log</div>
        <p className="text-xs mb-4" style={{ color: 'var(--stone-400)' }}>
          Immutable record of all publish, unpublish, and governance actions. Cannot be edited or deleted.
        </p>
        {auditLogs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--stone-400)' }}>No audit entries yet.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--earth-100)' }}>
            {auditLogs.map(log => (
              <div key={log.id} className="flex gap-3 py-3">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2" style={{ background: 'var(--stone-400)' }} />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--stone-700)' }}>{log.action}</span>
                    <span className="text-xs" style={{ color: 'var(--stone-400)' }}>
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}
                    </span>
                    {log.user.name && (
                      <span className="text-xs" style={{ color: 'var(--stone-400)' }}>· {log.user.name}</span>
                    )}
                  </div>
                  {log.detail && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--stone-500)' }}>{log.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
