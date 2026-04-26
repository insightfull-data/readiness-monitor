import type { CheckOutput } from './scoring'
import { getBand } from '@/types'

export interface RumeltStrategy {
  diagnosis: string
  guidingPolicy: string
  coherentActions: string
  permittedUse: string
}

export function generateRumeltStrategy(
  score: number,
  checks: CheckOutput[],
  period: string,
  sourceSystem: string
): RumeltStrategy {
  const band = getBand(score)
  const failedChecks = checks.filter(c => c.status === 'fail')
  const warnedChecks = checks.filter(c => c.status === 'warn')
  const problemChecks = [...failedChecks, ...warnedChecks]

  // Diagnosis — name the core obstacle plainly
  const problemNames = problemChecks.map(c => c.checkName.toLowerCase())
  const diagnosis = buildDiagnosis(score, band, period, sourceSystem, problemChecks)

  // Guiding policy — the approach rule
  const guidingPolicy = buildGuidingPolicy(band)

  // Coherent actions — specific, sequenced
  const coherentActions = buildActions(checks, band)

  // Permitted use
  const permittedUse = buildPermittedUse(band)

  return { diagnosis, guidingPolicy, coherentActions, permittedUse }
}

function buildDiagnosis(
  score: number,
  band: string,
  period: string,
  sourceSystem: string,
  problems: CheckOutput[]
): string {
  if (problems.length === 0) {
    return `Commercial transaction data from ${sourceSystem} for ${period} meets all five readiness thresholds with a score of ${score}. No material data quality issues were identified that would limit AI output confidence.`
  }

  const issues = problems.map(p => {
    const short = p.finding.split('.')[0]
    return `${p.checkName.toLowerCase()} — ${short}`
  })

  const issueText = issues.length === 1
    ? `one material issue: ${issues[0]}`
    : `${issues.length} material issues: ${issues.slice(0, -1).join('; ')}; and ${issues[issues.length - 1]}`

  return `Commercial transaction data from ${sourceSystem} for ${period} carries ${issueText}. These are not edge cases — they affect the structural reliability of AI-generated insights produced from this dataset. AI systems do not distinguish weak input from strong input; they produce confident-sounding outputs regardless. Without a scored readiness gate, these issues would pass undetected into business decisions.`
}

function buildGuidingPolicy(band: string): string {
  const policies: Record<string, string> = {
    ready: 'Data quality meets the threshold for AI-generated insights to support business review. Standard controls apply. Human review is recommended but not blocking. The focus now shifts to maintaining this standard in subsequent cycles and advancing framework alignment.',
    usable: 'AI-generated insights from this dataset are permitted for internal use only, with a named human reviewer present before any output is acted on. The score band is the enforcement mechanism — not advisory, but binding. Outputs must not cross into financial reporting, external communication, or automated decisions until the identified data quality issues are resolved.',
    limited: 'Data quality falls below the threshold for operational use of AI insights. Exploratory and directional use is permitted — patterns and hypotheses may be formed, but no business decisions may be based on these outputs. The priority is resolving the identified issues before the next cycle, not working around them.',
    notready: 'This dataset does not meet minimum readiness thresholds. No AI-generated insights from this data may be used for any business purpose. The assessment findings define what must be fixed. Publishing insights from this data would expose the organisation to decisions made on an unreliable foundation.',
  }
  return policies[band] || policies.notready
}

function buildActions(checks: CheckOutput[], band: string): string {
  const actions: string[] = []
  let n = 1

  const completeness = checks.find(c => c.checkName === 'Completeness')
  if (completeness && completeness.status !== 'pass') {
    actions.push(`${n++}. Resolve customer ID and field nulls — map missing customer_id values to CRM fallback IDs where available. Target: before next monthly cycle.`)
  }

  const bizRules = checks.find(c => c.checkName === 'Business Rules')
  if (bizRules && bizRules.status !== 'pass') {
    actions.push(`${n++}. Standardise return and cancellation codes across all product categories in the source system. Assign a data owner to maintain code consistency going forward.`)
  }

  const lineage = checks.find(c => c.checkName === 'Lineage')
  if (lineage && lineage.status !== 'pass') {
    actions.push(`${n++}. Complete ETL transformation documentation for all undocumented pipeline steps. Assign to data engineering with a named completion date.`)
  }

  const resp = checks.find(c => c.checkName === 'Responsible Use')
  if (resp && resp.status !== 'pass') {
    actions.push(`${n++}. Assign a named human reviewer and define permitted use boundaries before any AI outputs are distributed.`)
  }

  const fresh = checks.find(c => c.checkName === 'Freshness')
  if (fresh && fresh.status !== 'pass') {
    actions.push(`${n++}. Establish a data extraction SLA — ensure data is extracted no more than 7 days before the readiness assessment runs each cycle.`)
  }

  // Always-on actions
  actions.push(`${n++}. Log all governance actions taken this cycle as dated, attributed entries — not as claimed status.`)

  if (band !== 'ready') {
    actions.push(`${n++}. Re-run the readiness assessment after data issues are resolved. Do not advance the permitted use level until the score improves.`)
  }

  return actions.join('\n')
}

function buildPermittedUse(band: string): string {
  const uses: Record<string, string> = {
    ready: 'AI insights may support business decisions with standard controls. Human review is recommended but not required for internal reporting.',
    usable: 'Internal use only with mandatory human review before acting on any output. Not for financial reporting, external communication, or automated decision-making.',
    limited: 'Exploratory and directional use only. Must not inform operational, financial, or customer-facing decisions.',
    notready: 'Do not use AI outputs from this dataset for any business purpose until data quality issues are resolved and a re-assessment passes.',
  }
  return uses[band] || uses.notready
}
