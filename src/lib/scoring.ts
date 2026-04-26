export interface DatasetMeta {
  period: string
  sourceSystem: string
  extractedAt: Date | null
  lineageStatus: 'full' | 'partial' | 'none'
  reviewerName: string | null
  rowCount: number | null
}

export interface CsvStats {
  totalRows: number
  nullCustomerIdPct: number
  nullTransactionValuePct: number
  uniqueReturnCodes: number
  productCategoryCount: number
  hasInconsistentCodes: boolean
  daysSinceExtraction: number | null
}

export interface CheckInput {
  meta: DatasetMeta
  csv: CsvStats
}

export interface CheckOutput {
  checkName: string
  weight: number
  score: number
  status: 'pass' | 'warn' | 'fail'
  finding: string
}

export function runReadinessChecks(input: CheckInput): CheckOutput[] {
  return [
    checkFreshness(input),
    checkCompleteness(input),
    checkBusinessRules(input),
    checkLineage(input),
    checkResponsibleUse(input),
  ]
}

export function calculateScore(checks: CheckOutput[]): number {
  return Math.round(
    checks.reduce((acc, c) => acc + c.score * c.weight, 0)
  )
}

function checkFreshness({ meta, csv }: CheckInput): CheckOutput {
  const days = csv.daysSinceExtraction
  let score: number
  let status: 'pass' | 'warn' | 'fail'
  let finding: string

  if (days === null) {
    score = 55
    status = 'warn'
    finding = 'Extraction date not provided — freshness cannot be verified.'
  } else if (days <= 3) {
    score = 95
    status = 'pass'
    finding = `Data extracted ${days} day${days !== 1 ? 's' : ''} before assessment. Well within the 7-day acceptable window.`
  } else if (days <= 7) {
    score = 80
    status = 'pass'
    finding = `Data extracted ${days} days before assessment. Within the 7-day acceptable window.`
  } else if (days <= 14) {
    score = 60
    status = 'warn'
    finding = `Data extracted ${days} days ago. Approaching stale threshold — AI outputs may not reflect current conditions.`
  } else {
    score = 30
    status = 'fail'
    finding = `Data extracted ${days} days ago. Exceeds the 14-day stale threshold. AI insights from this data should not be used for current decisions.`
  }

  return { checkName: 'Freshness', weight: 0.20, score, status, finding }
}

function checkCompleteness({ csv }: CheckInput): CheckOutput {
  const nullId = csv.nullCustomerIdPct
  const nullVal = csv.nullTransactionValuePct
  const combined = (nullId + nullVal) / 2
  let score: number
  let status: 'pass' | 'warn' | 'fail'

  if (combined < 2) {
    score = 95; status = 'pass'
  } else if (combined < 5) {
    score = 85; status = 'pass'
  } else if (combined < 10) {
    score = 72; status = 'warn'
  } else if (combined < 20) {
    score = 58; status = 'warn'
  } else {
    score = 35; status = 'fail'
  }

  const parts: string[] = []
  if (nullId > 0) parts.push(`${nullId.toFixed(1)}% of customer_id fields are null`)
  if (nullVal > 0) parts.push(`${nullVal.toFixed(1)}% of transaction_value fields are missing`)
  const finding = parts.length
    ? parts.join('. ') + '. ' + (status === 'pass' ? 'Within acceptable threshold.' : 'Exceeds threshold — AI segment analysis will be incomplete.')
    : 'All required fields fully populated. No completeness issues detected.'

  return { checkName: 'Completeness', weight: 0.25, score, status, finding }
}

function checkBusinessRules({ csv }: CheckInput): CheckOutput {
  let score: number
  let status: 'pass' | 'warn' | 'fail'
  let finding: string

  if (!csv.hasInconsistentCodes && csv.uniqueReturnCodes <= 2) {
    score = 92; status = 'pass'
    finding = 'Return and cancellation codes are consistent across all product categories. Business rules appear well-defined.'
  } else if (csv.uniqueReturnCodes <= 4) {
    score = 72; status = 'warn'
    finding = `${csv.uniqueReturnCodes} distinct return/cancellation code variants detected across ${csv.productCategoryCount} product categories. Inconsistency may cause revenue figures to be overstated in AI outputs.`
  } else {
    score = 40; status = 'fail'
    finding = `${csv.uniqueReturnCodes} distinct return code variants detected — significant inconsistency. AI revenue and margin analysis from this data will be unreliable.`
  }

  return { checkName: 'Business Rules', weight: 0.20, score, status, finding }
}

function checkLineage({ meta }: CheckInput): CheckOutput {
  const map: Record<string, { score: number; status: 'pass' | 'warn' | 'fail'; finding: string }> = {
    full: {
      score: 92, status: 'pass',
      finding: `Full source-to-output lineage documented for ${meta.sourceSystem}. ETL transformation steps, business rules applied, and output fields all mapped.`,
    },
    partial: {
      score: 68, status: 'warn',
      finding: `Source system (${meta.sourceSystem}) documented. ETL transformation steps partially described — remaining transforms are undocumented. Outputs cannot be fully traced to source.`,
    },
    none: {
      score: 20, status: 'fail',
      finding: 'No lineage documentation exists. The path from source data to AI input cannot be traced. This is a critical gap for any regulated or auditable use.',
    },
  }
  return { checkName: 'Lineage', weight: 0.20, ...map[meta.lineageStatus] }
}

function checkResponsibleUse({ meta }: CheckInput): CheckOutput {
  const hasReviewer = !!meta.reviewerName
  let score: number
  let status: 'pass' | 'warn' | 'fail'
  let finding: string

  if (hasReviewer) {
    score = 82; status = 'pass'
    finding = `Human reviewer assigned (${meta.reviewerName}). Permitted use is scoped and documented. AI output limitations are acknowledged in the use case record.`
  } else {
    score = 35; status = 'fail'
    finding = 'No human reviewer assigned. Permitted use boundaries are undefined. AI outputs from this dataset must not be used until oversight controls are in place.'
  }

  return { checkName: 'Responsible Use', weight: 0.15, score, status, finding }
}

// Parse uploaded CSV and extract quality stats
export function parseCSVStats(csvText: string): CsvStats {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    return {
      totalRows: 0, nullCustomerIdPct: 0, nullTransactionValuePct: 0,
      uniqueReturnCodes: 0, productCategoryCount: 0, hasInconsistentCodes: false,
      daysSinceExtraction: null,
    }
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const customerIdIdx = headers.findIndex(h => h.includes('customer') && h.includes('id'))
  const transValueIdx = headers.findIndex(h => h.includes('value') || h.includes('amount') || h.includes('total'))
  const returnCodeIdx = headers.findIndex(h => h.includes('return') || h.includes('cancel') || h.includes('status'))
  const categoryIdx = headers.findIndex(h => h.includes('category') || h.includes('product'))

  let nullCustomerId = 0, nullTransValue = 0
  const returnCodes = new Set<string>()
  const categories = new Set<string>()
  const totalRows = lines.length - 1

  for (let i = 1; i <= totalRows; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
    if (customerIdIdx >= 0 && (!cols[customerIdIdx] || cols[customerIdIdx] === '' || cols[customerIdIdx] === 'null')) nullCustomerId++
    if (transValueIdx >= 0 && (!cols[transValueIdx] || cols[transValueIdx] === '' || cols[transValueIdx] === 'null')) nullTransValue++
    if (returnCodeIdx >= 0 && cols[returnCodeIdx]) returnCodes.add(cols[returnCodeIdx])
    if (categoryIdx >= 0 && cols[categoryIdx]) categories.add(cols[categoryIdx])
  }

  return {
    totalRows,
    nullCustomerIdPct: totalRows > 0 ? Math.round((nullCustomerId / totalRows) * 1000) / 10 : 0,
    nullTransactionValuePct: totalRows > 0 ? Math.round((nullTransValue / totalRows) * 1000) / 10 : 0,
    uniqueReturnCodes: returnCodes.size,
    productCategoryCount: categories.size,
    hasInconsistentCodes: returnCodes.size > 3,
    daysSinceExtraction: null,
  }
}

// Generate demo CSV stats (used when no CSV is uploaded)
export function getDemoCSVStats(): CsvStats {
  return {
    totalRows: 4218,
    nullCustomerIdPct: 14.0,
    nullTransactionValuePct: 8.0,
    uniqueReturnCodes: 5,
    productCategoryCount: 12,
    hasInconsistentCodes: true,
    daysSinceExtraction: 3,
  }
}
