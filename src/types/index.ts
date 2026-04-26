export type Band = 'ready' | 'usable' | 'limited' | 'notready'

export interface BandInfo {
  label: string
  color: string
  bgClass: string
  textClass: string
  meaning: string
  permitted: string
}

export interface CheckResult {
  id: string
  checkName: string
  weight: number
  score: number
  status: 'pass' | 'warn' | 'fail'
  finding: string
  notes?: string | null
}

export interface ScoreRunWithChecks {
  id: string
  overallScore: number
  band: string
  status: string
  analystNotes?: string | null
  aiSummary?: string | null
  runAt: Date
  checkResults: CheckResult[]
  dataset: { period: string; sourceSystem: string; reviewerName?: string | null }
  useCase: { name: string; businessUnit: string }
}

export interface PublicReportFull {
  id: string
  period: string
  publishedAt: Date
  isActive: boolean
  diagnosis: string
  guidingPolicy: string
  coherentActions: string
  permittedUse: string
  aiSummary?: string | null
  scoreRun: ScoreRunWithChecks
}

export interface GovActionItem {
  id: string
  action: string
  framework: string
  notes: string
  nistPoints: number
  isoPoints: number
  loggedAt: Date
  logger: { name?: string | null }
}

export interface FrameworkProgress {
  framework: string
  metCount: number
  totalCount: number
  pct: number
}

export const BAND_INFO: Record<string, BandInfo> = {
  ready: {
    label: 'Ready',
    color: '#5a7a3a',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800',
    meaning: 'The data meets quality thresholds across all five areas. AI-generated insights can support business review with standard controls in place.',
    permitted: 'AI insights may support business decisions with standard controls. Human review is recommended but not required for internal reporting.',
  },
  usable: {
    label: 'Usable with controls',
    color: '#9e623a',
    bgClass: 'bg-earth-100',
    textClass: 'text-earth-800',
    meaning: 'The data is usable but carries material quality issues that affect AI output confidence. A named human reviewer must be present before any insight is acted on.',
    permitted: 'Internal use only with mandatory human review before acting on any output. Not for financial reporting, external communication, or automated decisions.',
  },
  limited: {
    label: 'Limited use',
    color: '#b84a34',
    bgClass: 'bg-sienna-100',
    textClass: 'text-sienna-800',
    meaning: 'Data quality issues are significant enough to make AI outputs unreliable for operational decisions. Exploratory or directional use only.',
    permitted: 'Exploratory and directional use only. Must not inform operational, financial, or customer-facing decisions.',
  },
  notready: {
    label: 'Not ready',
    color: '#742c1f',
    bgClass: 'bg-sienna-200',
    textClass: 'text-sienna-900',
    meaning: 'The data does not meet minimum thresholds for AI-generated insights to be trusted in any business context.',
    permitted: 'Do not use AI outputs from this dataset for any business purpose until data quality issues are resolved.',
  },
}

export function getBand(score: number): string {
  if (score >= 85) return 'ready'
  if (score >= 70) return 'usable'
  if (score >= 50) return 'limited'
  return 'notready'
}

export function scoreColor(score: number): string {
  if (score >= 85) return '#5a7a3a'
  if (score >= 70) return '#9e623a'
  if (score >= 50) return '#b84a34'
  return '#742c1f'
}
