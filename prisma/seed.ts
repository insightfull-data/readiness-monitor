import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Admin user
  const passwordHash = await bcrypt.hash('I=i}gfqQs*4^}*77', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@readiness.local' },
    update: {},
    create: {
      email: 'admin@readiness.local',
      name: 'Admin User',
      passwordHash,
      role: 'admin',
    },
  })

  // Framework state
  await prisma.frameworkState.upsert({
    where: { framework: 'NIST' },
    update: {},
    create: { framework: 'NIST', metCount: 6, totalCount: 15 },
  })
  await prisma.frameworkState.upsert({
    where: { framework: 'ISO' },
    update: {},
    create: { framework: 'ISO', metCount: 5, totalCount: 16 },
  })

  // Use case
  const uc = await prisma.useCase.create({
    data: {
      name: 'Monthly Sales AI Insights — April 2025',
      businessUnit: 'Commercial Analytics',
      outputType: 'Sales trend summary',
      intendedUse: 'Weekly leadership briefing, internal review only',
      status: 'published',
    },
  })

  // Dataset
  const dataset = await prisma.dataset.create({
    data: {
      useCaseId: uc.id,
      filename: 'transactions_apr2025.csv',
      period: 'April 2025',
      sourceSystem: 'Shopify + Salesforce',
      rowCount: 4218,
      extractedAt: new Date('2025-04-19'),
      lineageStatus: 'partial',
      reviewerName: 'Jane Smith, Analytics Lead',
    },
  })

  // Score run
  const run = await prisma.scoreRun.create({
    data: {
      useCaseId: uc.id,
      datasetId: dataset.id,
      runBy: admin.id,
      overallScore: 74,
      band: 'usable',
      status: 'published',
      analystNotes: 'Two material issues identified. Customer ID nulls and return code inconsistency must be resolved before next cycle.',
      aiSummary: 'This dataset scores 74 out of 100, placing it in the Usable with Controls band. The data is current and a human reviewer is in place, which is a solid foundation. However, 14% of customer IDs are missing — meaning AI segment analysis will systematically undercount roughly 1 in 7 customers — and return codes differ across three product categories, which can overstate revenue figures. AI-generated insights from this dataset are acceptable for internal briefings where a human reviewer is present, but must not be used for financial reporting or automated decisions.',
    },
  })

  // Check results
  const checks = [
    { checkName: 'Freshness', weight: 0.20, score: 85, status: 'pass', finding: 'Data extracted 3 days before period end. Within the acceptable 7-day window.' },
    { checkName: 'Completeness', weight: 0.25, score: 68, status: 'warn', finding: '14% of customer_id fields are null. 8% of transaction_value fields are missing. Concentrated in the online channel.' },
    { checkName: 'Business Rules', weight: 0.20, score: 72, status: 'warn', finding: 'Return flag inconsistency: 3 product categories use different cancellation codes. Discount logic undocumented for 2 promotional SKUs.' },
    { checkName: 'Lineage', weight: 0.20, score: 70, status: 'warn', finding: 'Shopify source system documented. ETL transformation steps 60% described — remaining transforms are undocumented.' },
    { checkName: 'Responsible Use', weight: 0.15, score: 80, status: 'pass', finding: 'Human reviewer assigned (Jane Smith). Permitted use scoped to internal briefing. Limitations documented.' },
  ]
  for (const c of checks) {
    await prisma.checkResult.create({ data: { scoreRunId: run.id, ...c } })
  }

  // Public report
  await prisma.publicReport.create({
    data: {
      scoreRunId: run.id,
      period: 'April 2025',
      publishedBy: admin.id,
      isActive: true,
      diagnosis: 'Commercial transaction data for April 2025 carries two material quality issues that limit AI output confidence. First, 14% of customer IDs are null — meaning any AI-generated segment analysis will systematically miss roughly 1 in 7 customers. Second, return and cancellation codes are inconsistent across three product categories, which can overstate revenue figures in AI summaries. These are not edge cases; they affect the structural reliability of any insight the AI produces from this dataset.',
      guidingPolicy: 'AI-generated insights from this dataset are permitted for internal use only, with a named human reviewer present before any output is acted on. The score band determines what AI outputs are allowed — and that boundary is enforced, not advisory. Outputs must not be used for financial reporting, external communication, or automated decision-making until the two material data issues are resolved.',
      coherentActions: '1. Resolve customer ID nulls by mapping to CRM fallback IDs — target: before May cycle. 2. Standardise return and cancellation codes across all product categories in the source system. 3. Complete ETL transformation documentation for remaining undocumented steps. 4. Flag channel-mix caveats in any AI output referencing online vs in-store split.',
      permittedUse: 'Internal use only with mandatory human review before acting on any output. Not for financial reporting, external communication, or automated decision-making.',
      aiSummary: 'This dataset scores 74 out of 100, placing it in the Usable with Controls band. The data is current and a human reviewer is in place. However, 14% of customer IDs are missing and return codes differ across three product categories — both of which affect AI output reliability. Insights from this data are acceptable for internal briefings with human review, but must not be used for financial reporting or automated decisions.',
    },
  })

  // Governance actions
  const govActions = [
    {
      action: 'Human reviewer assigned',
      framework: 'NIST — Govern',
      notes: 'Jane Smith assigned as Analytics Lead reviewer for all monthly commercial reports. Responsibility documented in use case record.',
      nistPoints: 1, isoPoints: 1,
      loggedAt: new Date('2025-03-15'),
    },
    {
      action: 'Permitted use boundaries defined',
      framework: 'Both frameworks',
      notes: 'Permitted use scoped to internal briefing only. External reporting explicitly excluded. Documented in use case record and communicated to team.',
      nistPoints: 1, isoPoints: 1,
      loggedAt: new Date('2025-03-28'),
    },
    {
      action: 'Lineage documentation completed',
      framework: 'NIST — Measure',
      notes: 'Shopify source system fully documented. ETL transformation steps 60% complete — remaining steps in progress with data engineering.',
      nistPoints: 1, isoPoints: 0,
      loggedAt: new Date('2025-04-05'),
    },
  ]
  for (const g of govActions) {
    await prisma.govAction.create({
      data: { loggedBy: admin.id, isPublic: true, ...g },
    })
    await prisma.frameworkState.update({
      where: { framework: 'NIST' },
      data: { metCount: { increment: g.nistPoints } },
    })
    await prisma.frameworkState.update({
      where: { framework: 'ISO' },
      data: { metCount: { increment: g.isoPoints } },
    })
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'PUBLISH_REPORT',
      entity: 'PublicReport',
      entityId: run.id,
      detail: 'Published April 2025 report with score 74 (Usable with controls)',
    },
  })

  console.log('Seed complete.')
  console.log('Admin login: admin@readiness.local / demo1234')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
