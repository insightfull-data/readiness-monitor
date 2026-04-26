// ─────────────────────────────────────────────
// Dataset type detection + flexible scoring engine
// Supports: Transaction, Marketing/Media, Financial, Time-series, Generic
// ─────────────────────────────────────────────

export type DatasetType = 'transaction' | 'marketing' | 'financial' | 'timeseries' | 'generic'

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
  datasetType: DatasetType
  headers: string[]
  daysSinceExtraction: number | null
  dateRangeDays: number | null
  lastDateDaysAgo: number | null

  // Completeness — generic
  nullPctByColumn: Record<string, number>
  avgNullPct: number
  highNullColumns: string[]  // columns with >10% nulls

  // Transaction-specific
  nullCustomerIdPct: number
  nullTransactionValuePct: number
  uniqueReturnCodes: number
  productCategoryCount: number
  hasInconsistentCodes: boolean

  // Marketing/media-specific
  spendColumns: string[]
  revenueColumns: string[]
  daysAllChannelsZero: number
  daysAllChannelsZeroPct: number
  activeChannelCount: number
  totalChannelCount: number
  spendNullPct: number
  revenueNullPct: number

  // Financial-specific
  numericColumns: string[]
  negativeValuePct: number
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

// ─── Dataset type detection ───────────────────

export function detectDatasetType(headers: string[]): DatasetType {
  const h = headers.map(x => x.toLowerCase())

  // Marketing / media spend signals
  const spendSignals = h.filter(x =>
    x.includes('spend') || x.includes('impression') || x.includes('click') ||
    x.includes('cpm') || x.includes('cpc') || x.includes('roas') ||
    x.includes('meta') || x.includes('linkedin') || x.includes('google') ||
    x.includes('tiktok') || x.includes('youtube') || x.includes('sem') ||
    x.includes('broadcast') || x.includes('media') || x.includes('campaign')
  )
  if (spendSignals.length >= 2) return 'marketing'

  // Transaction signals
  const txnSignals = h.filter(x =>
    x.includes('customer') || x.includes('transaction') || x.includes('order') ||
    x.includes('invoice') || x.includes('return') || x.includes('cancel') ||
    x.includes('product') || x.includes('sku') || x.includes('quantity')
  )
  if (txnSignals.length >= 2) return 'transaction'

  // Financial signals
  const finSignals = h.filter(x =>
    x.includes('revenue') || x.includes('cost') || x.includes('profit') ||
    x.includes('margin') || x.includes('budget') || x.includes('forecast') ||
    x.includes('actual') || x.includes('variance') || x.includes('account')
  )
  if (finSignals.length >= 2) return 'financial'

  // Time-series signals
  const tsSignals = h.filter(x =>
    x === 'date' || x === 'datetime' || x === 'timestamp' || x === 'period' ||
    x === 'week' || x === 'month' || x === 'day'
  )
  if (tsSignals.length >= 1 && h.length > 2) return 'timeseries'

  return 'generic'
}

// ─── CSV parser + stats extractor ─────────────

export function parseCSVStats(csvText: string): CsvStats {
  const lines = csvText.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return emptyStats()

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const dataRows = lines.slice(1)
  const totalRows = dataRows.length
  const datasetType = detectDatasetType(headers)

  // Parse all rows into columns
  const columns: Record<string, string[]> = {}
  headers.forEach(h => { columns[h] = [] })
  for (const line of dataRows) {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
    headers.forEach((h, i) => { columns[h].push(vals[i] ?? '') })
  }

  // Null pct per column (empty string or literal "null")
  const nullPctByColumn: Record<string, number> = {}
  for (const h of headers) {
    const nullCount = columns[h].filter(v => !v || v.toLowerCase() === 'null').length
    nullPctByColumn[h] = totalRows > 0 ? Math.round((nullCount / totalRows) * 1000) / 10 : 0
  }
  const highNullColumns = Object.entries(nullPctByColumn)
    .filter(([, pct]) => pct > 10)
    .map(([col]) => col)
  const avgNullPct = Object.values(nullPctByColumn).reduce((a, b) => a + b, 0) / headers.length

  // Date range analysis
  const dateCol = headers.find(h => {
    const l = h.toLowerCase()
    return l === 'date' || l === 'datetime' || l === 'timestamp' || l === 'period'
  })
  let dateRangeDays: number | null = null
  let lastDateDaysAgo: number | null = null
  if (dateCol && columns[dateCol]) {
    const dates = columns[dateCol]
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())
    if (dates.length >= 2) {
      dateRangeDays = Math.round((dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24))
      lastDateDaysAgo = Math.round((Date.now() - dates[dates.length - 1].getTime()) / (1000 * 60 * 60 * 24))
    }
  }

  // ── Transaction-specific ──
  let nullCustomerIdPct = 0, nullTransactionValuePct = 0
  let uniqueReturnCodes = 0, productCategoryCount = 0, hasInconsistentCodes = false

  if (datasetType === 'transaction') {
    const custCol = headers.find(h => h.toLowerCase().includes('customer') && h.toLowerCase().includes('id'))
    const valCol = headers.find(h => h.toLowerCase().includes('value') || h.toLowerCase().includes('amount') || h.toLowerCase().includes('total'))
    const retCol = headers.find(h => h.toLowerCase().includes('return') || h.toLowerCase().includes('cancel') || h.toLowerCase().includes('status'))
    const catCol = headers.find(h => h.toLowerCase().includes('category') || h.toLowerCase().includes('product'))
    if (custCol) nullCustomerIdPct = nullPctByColumn[custCol] ?? 0
    if (valCol) nullTransactionValuePct = nullPctByColumn[valCol] ?? 0
    if (retCol) { const codes = new Set(columns[retCol].filter(v => v)); uniqueReturnCodes = codes.size; hasInconsistentCodes = codes.size > 4 }
    if (catCol) { const cats = new Set(columns[catCol].filter(v => v)); productCategoryCount = cats.size }
  }

  // ── Marketing/media-specific ──
  const spendColumns = headers.filter(h => h.toLowerCase().includes('spend'))
  const revenueColumns = headers.filter(h => h.toLowerCase().includes('revenue') || h.toLowerCase().includes('rev'))
  let daysAllChannelsZero = 0, activeChannelCount = 0, spendNullPct = 0, revenueNullPct = 0

  if (datasetType === 'marketing' && spendColumns.length > 0) {
    // Days where ALL spend channels are zero (zeros are valid — so we check if every single channel is 0)
    daysAllChannelsZero = dataRows.filter(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
      return spendColumns.every(col => {
        const idx = headers.indexOf(col)
        return !vals[idx] || vals[idx] === '0' || vals[idx] === '0.0'
      })
    }).length

    // Active channels = channels that have at least one non-zero spend value
    activeChannelCount = spendColumns.filter(col => {
      return columns[col].some(v => v && parseFloat(v) > 0)
    }).length

    // Null pct across all spend columns (not zeros — nulls/empty only)
    const spendNulls = spendColumns.reduce((acc, col) => {
      return acc + columns[col].filter(v => !v || v.toLowerCase() === 'null').length
    }, 0)
    spendNullPct = totalRows > 0 && spendColumns.length > 0
      ? Math.round((spendNulls / (totalRows * spendColumns.length)) * 1000) / 10
      : 0

    // Revenue null pct
    if (revenueColumns.length > 0) {
      const revNulls = revenueColumns.reduce((acc, col) => {
        return acc + columns[col].filter(v => !v || v.toLowerCase() === 'null').length
      }, 0)
      revenueNullPct = totalRows > 0
        ? Math.round((revNulls / (totalRows * revenueColumns.length)) * 1000) / 10
        : 0
    }
  }

  // Financial — negative value detection
  const numericColumns = headers.filter(h => {
    const vals = columns[h].filter(v => v).slice(0, 20)
    return vals.length > 0 && vals.every(v => !isNaN(parseFloat(v)))
  })
  let negativeValuePct = 0
  if (datasetType === 'financial' && numericColumns.length > 0) {
    const negCount = numericColumns.reduce((acc, col) => {
      return acc + columns[col].filter(v => v && parseFloat(v) < 0).length
    }, 0)
    negativeValuePct = Math.round((negCount / (totalRows * numericColumns.length)) * 1000) / 10
  }

  return {
    totalRows, datasetType, headers,
    daysSinceExtraction: null,
    dateRangeDays, lastDateDaysAgo,
    nullPctByColumn, avgNullPct, highNullColumns,
    nullCustomerIdPct, nullTransactionValuePct,
    uniqueReturnCodes, productCategoryCount, hasInconsistentCodes,
    spendColumns, revenueColumns,
    daysAllChannelsZero,
    daysAllChannelsZeroPct: totalRows > 0 ? Math.round((daysAllChannelsZero / totalRows) * 1000) / 10 : 0,
    activeChannelCount, totalChannelCount: spendColumns.length,
    spendNullPct, revenueNullPct,
    numericColumns, negativeValuePct,
  }
}

function emptyStats(): CsvStats {
  return {
    totalRows: 0, datasetType: 'generic', headers: [],
    daysSinceExtraction: null, dateRangeDays: null, lastDateDaysAgo: null,
    nullPctByColumn: {}, avgNullPct: 0, highNullColumns: [],
    nullCustomerIdPct: 0, nullTransactionValuePct: 0,
    uniqueReturnCodes: 0, productCategoryCount: 0, hasInconsistentCodes: false,
    spendColumns: [], revenueColumns: [],
    daysAllChannelsZero: 0, daysAllChannelsZeroPct: 0,
    activeChannelCount: 0, totalChannelCount: 0,
    spendNullPct: 0, revenueNullPct: 0,
    numericColumns: [], negativeValuePct: 0,
  }
}

// ─── Main check runner ─────────────────────────

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
  return Math.round(checks.reduce((acc, c) => acc + c.score * c.weight, 0))
}

// ─── Check 1: Freshness ────────────────────────

function checkFreshness({ meta, csv }: CheckInput): CheckOutput {
  const type = csv.datasetType

  // For time-series and marketing data — use last date in dataset
  if ((type === 'marketing' || type === 'timeseries') && csv.lastDateDaysAgo !== null) {
    const daysAgo = csv.lastDateDaysAgo
    const rangeDays = csv.dateRangeDays ?? 0
    let score: number, status: 'pass' | 'warn' | 'fail', finding: string

    if (daysAgo <= 14) {
      score = 90; status = 'pass'
      finding = `Dataset runs through ${daysAgo} days ago covering ${rangeDays} days total. Data is current for AI analysis.`
    } else if (daysAgo <= 45) {
      score = 72; status = 'warn'
      finding = `Most recent data is ${daysAgo} days old covering ${rangeDays} days. Acceptable for trend analysis but not current-state decisions.`
    } else if (daysAgo <= 90) {
      score = 50; status = 'warn'
      finding = `Most recent data is ${daysAgo} days old. AI insights will reflect conditions from ${Math.round(daysAgo / 30)} months ago — flag this clearly in any output.`
    } else {
      score = 25; status = 'fail'
      finding = `Most recent data is ${daysAgo} days old (${Math.round(daysAgo / 30)} months). Dataset is stale — AI outputs should not be used for current decisions.`
    }
    return { checkName: 'Freshness', weight: 0.20, score, status, finding }
  }

  // For extraction-date-based freshness (transaction / financial)
  const days = csv.daysSinceExtraction ?? (meta.extractedAt
    ? Math.floor((Date.now() - meta.extractedAt.getTime()) / (1000 * 60 * 60 * 24))
    : null)

  if (days === null) {
    return { checkName: 'Freshness', weight: 0.20, score: 55, status: 'warn', finding: 'Extraction date not provided — freshness cannot be verified.' }
  }
  if (days <= 3) return { checkName: 'Freshness', weight: 0.20, score: 95, status: 'pass', finding: `Data extracted ${days} day${days !== 1 ? 's' : ''} ago. Well within the acceptable 7-day window.` }
  if (days <= 7) return { checkName: 'Freshness', weight: 0.20, score: 80, status: 'pass', finding: `Data extracted ${days} days ago. Within the acceptable 7-day window.` }
  if (days <= 14) return { checkName: 'Freshness', weight: 0.20, score: 60, status: 'warn', finding: `Data extracted ${days} days ago. Approaching stale threshold.` }
  return { checkName: 'Freshness', weight: 0.20, score: 30, status: 'fail', finding: `Data extracted ${days} days ago. Exceeds the 14-day stale threshold.` }
}

// ─── Check 2: Completeness ─────────────────────

function checkCompleteness({ csv }: CheckInput): CheckOutput {
  const type = csv.datasetType

  if (type === 'marketing') {
    // Zeros are valid — check only for true nulls in spend and revenue
    const spendNull = csv.spendNullPct
    const revNull = csv.revenueNullPct
    const combined = (spendNull + revNull) / 2
    let score: number, status: 'pass' | 'warn' | 'fail', finding: string

    if (combined < 1 && csv.highNullColumns.length === 0) {
      score = 95; status = 'pass'
      finding = `All ${csv.totalChannelCount} spend channels and revenue fields are fully populated. Zero values are treated as valid inactive channel days.`
    } else if (combined < 5) {
      score = 80; status = 'pass'
      finding = `${spendNull.toFixed(1)}% spend null rate, ${revNull.toFixed(1)}% revenue null rate. Zeros treated as valid. Minor gaps present.`
    } else if (combined < 15) {
      score = 65; status = 'warn'
      finding = `${spendNull.toFixed(1)}% of spend fields and ${revNull.toFixed(1)}% of revenue fields have missing values (not zeros). AI attribution analysis will be incomplete.`
    } else {
      score = 35; status = 'fail'
      finding = `High null rate across spend or revenue columns — ${combined.toFixed(1)}% average. AI channel mix analysis will be unreliable.`
    }
    return { checkName: 'Completeness', weight: 0.25, score, status, finding }
  }

  if (type === 'transaction') {
    const combined = (csv.nullCustomerIdPct + csv.nullTransactionValuePct) / 2
    let score: number, status: 'pass' | 'warn' | 'fail'
    if (combined < 2) { score = 95; status = 'pass' }
    else if (combined < 5) { score = 85; status = 'pass' }
    else if (combined < 10) { score = 72; status = 'warn' }
    else if (combined < 20) { score = 58; status = 'warn' }
    else { score = 35; status = 'fail' }
    const parts = []
    if (csv.nullCustomerIdPct > 0) parts.push(`${csv.nullCustomerIdPct.toFixed(1)}% of customer IDs are null`)
    if (csv.nullTransactionValuePct > 0) parts.push(`${csv.nullTransactionValuePct.toFixed(1)}% of transaction values are missing`)
    const finding = parts.length ? parts.join('. ') + '.' : 'All required fields fully populated.'
    return { checkName: 'Completeness', weight: 0.25, score, status, finding }
  }

  // Generic / financial / timeseries — use column null rates
  const highNulls = csv.highNullColumns
  const avg = csv.avgNullPct
  let score: number, status: 'pass' | 'warn' | 'fail', finding: string
  if (avg < 2 && highNulls.length === 0) {
    score = 95; status = 'pass'; finding = 'All fields are fully populated across the dataset.'
  } else if (avg < 5 && highNulls.length <= 1) {
    score = 82; status = 'pass'; finding = `Minor nulls detected (avg ${avg.toFixed(1)}%). No critical columns affected.`
  } else if (highNulls.length <= 3) {
    score = 65; status = 'warn'; finding = `${highNulls.length} column${highNulls.length > 1 ? 's' : ''} with >10% nulls: ${highNulls.slice(0, 3).join(', ')}. AI outputs using these fields will be incomplete.`
  } else {
    score = 40; status = 'fail'; finding = `${highNulls.length} columns have >10% null rates. Dataset completeness is insufficient for reliable AI analysis.`
  }
  return { checkName: 'Completeness', weight: 0.25, score, status, finding }
}

// ─── Check 3: Business Rules ───────────────────

function checkBusinessRules({ csv }: CheckInput): CheckOutput {
  const type = csv.datasetType

  if (type === 'marketing') {
    const active = csv.activeChannelCount
    const total = csv.totalChannelCount
    const allZeroPct = csv.daysAllChannelsZeroPct

    let score: number, status: 'pass' | 'warn' | 'fail', finding: string

    if (allZeroPct > 20) {
      score = 45; status = 'fail'
      finding = `${csv.daysAllChannelsZero} days (${allZeroPct.toFixed(1)}%) have zero spend across all channels. This volume of zero-activity days may distort AI attribution models — verify these are genuine dark periods.`
    } else if (allZeroPct > 5) {
      score = 68; status = 'warn'
      finding = `${csv.daysAllChannelsZero} days have zero spend across all channels (${allZeroPct.toFixed(1)}%). Zeros are treated as valid inactive days. ${active} of ${total} channels have recorded spend at some point.`
    } else {
      score = 85; status = 'pass'
      finding = `${active} of ${total} channels are active across the dataset period. Channel spend patterns are consistent. Zero-spend days are within normal range (${allZeroPct.toFixed(1)}% of days).`
    }
    return { checkName: 'Business Rules', weight: 0.20, score, status, finding }
  }

  if (type === 'transaction') {
    if (!csv.hasInconsistentCodes && csv.uniqueReturnCodes <= 2) {
      return { checkName: 'Business Rules', weight: 0.20, score: 92, status: 'pass', finding: 'Return and cancellation codes are consistent across all product categories.' }
    } else if (csv.uniqueReturnCodes <= 4) {
      return { checkName: 'Business Rules', weight: 0.20, score: 72, status: 'warn', finding: `${csv.uniqueReturnCodes} distinct return code variants across ${csv.productCategoryCount} product categories. May overstate revenue in AI outputs.` }
    } else {
      return { checkName: 'Business Rules', weight: 0.20, score: 40, status: 'fail', finding: `${csv.uniqueReturnCodes} distinct return code variants — significant inconsistency. AI revenue analysis will be unreliable.` }
    }
  }

  // Financial / generic
  if (csv.negativeValuePct > 30) {
    return { checkName: 'Business Rules', weight: 0.20, score: 55, status: 'warn', finding: `${csv.negativeValuePct.toFixed(1)}% of numeric values are negative. Verify these are valid entries (credits, adjustments) and not data errors.` }
  }
  return { checkName: 'Business Rules', weight: 0.20, score: 82, status: 'pass', finding: 'No structural business rule violations detected in the dataset.' }
}

// ─── Check 4: Lineage ──────────────────────────

function checkLineage({ meta, csv }: CheckInput): CheckOutput {
  const typeLabel: Record<DatasetType, string> = {
    marketing: 'marketing data pipeline and attribution model',
    transaction: 'transaction data pipeline and ETL transforms',
    financial: 'financial data pipeline and calculation methodology',
    timeseries: 'time-series data pipeline and aggregation logic',
    generic: 'data pipeline and transformation steps',
  }
  const label = typeLabel[csv.datasetType]
  const map: Record<string, { score: number; status: 'pass' | 'warn' | 'fail'; finding: string }> = {
    full: { score: 92, status: 'pass', finding: `Full source-to-output lineage documented for ${meta.sourceSystem}. The ${label} is fully traced.` },
    partial: { score: 68, status: 'warn', finding: `Source system (${meta.sourceSystem}) documented. The ${label} is only partially described — remaining steps are undocumented.` },
    none: { score: 20, status: 'fail', finding: `No lineage documentation exists for this dataset. The ${label} cannot be traced from source to AI input.` },
  }
  return { checkName: 'Lineage', weight: 0.20, ...map[meta.lineageStatus] }
}

// ─── Check 5: Responsible Use ──────────────────

function checkResponsibleUse({ meta }: CheckInput): CheckOutput {
  if (meta.reviewerName) {
    return { checkName: 'Responsible Use', weight: 0.15, score: 82, status: 'pass', finding: `Human reviewer assigned (${meta.reviewerName}). Permitted use is scoped and documented.` }
  }
  return { checkName: 'Responsible Use', weight: 0.15, score: 35, status: 'fail', finding: 'No human reviewer assigned. Permitted use boundaries are undefined. AI outputs must not be used until oversight controls are in place.' }
}

// ─── Demo stats for testing ────────────────────

export function getDemoCSVStats(): CsvStats {
  return {
    totalRows: 4218, datasetType: 'transaction', headers: ['transaction_id', 'customer_id', 'product_category', 'transaction_value', 'return_status', 'transaction_date'],
    daysSinceExtraction: 3, dateRangeDays: 30, lastDateDaysAgo: 3,
    nullPctByColumn: { customer_id: 14, transaction_value: 8 }, avgNullPct: 4, highNullColumns: ['customer_id'],
    nullCustomerIdPct: 14, nullTransactionValuePct: 8,
    uniqueReturnCodes: 5, productCategoryCount: 12, hasInconsistentCodes: true,
    spendColumns: [], revenueColumns: [],
    daysAllChannelsZero: 0, daysAllChannelsZeroPct: 0,
    activeChannelCount: 0, totalChannelCount: 0,
    spendNullPct: 0, revenueNullPct: 0,
    numericColumns: [], negativeValuePct: 0,
  }
}
