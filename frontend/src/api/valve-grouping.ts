import type { EntryRow } from '@/data/types'

// 阀门井检查记录的分组规则集中在这里，台账、检查单、导出册子都用同一份，页面只负责渲染。
// 分栏：井盖状况；栏内成组：养护措施；组内：检查日期倒序。跨页按整组切分，分组不被拆到两页。

export const WELL_CODE_FIELD = '井编号'
export const COVER_FIELD = '井盖状况'
export const MEASURE_FIELD = '养护措施'
export const DATE_FIELD = '检查日期'

// 检查单、册子里展示的列：取台账字段的固定顺序，避免两处各写一遍对不上。
export const BOOKLET_COLUMNS = [
  '井编号',
  '所属管段',
  '阀门型号',
  '检查人',
  '检查日期',
  '井体状态',
  '当前状态',
] as const

// 井盖状况固定分栏顺序，未登记的状况排在后面，待检查的井单独成一栏沉底。
export const COVER_ORDER = ['完好', '轻微锈蚀', '沉降', '破损', '缺失']
export const UNCHECKED_COVER = '待检查（未填报）'
// 养护措施固定成组顺序，没覆盖到的措施按首次出现顺序补在后面。
export const MEASURE_ORDER = [
  '无需养护',
  '除锈刷漆',
  '紧固螺栓',
  '阀门注油保养',
  '清理井内杂物',
  '井圈找平',
  '更换井盖',
  '设置警示并补装',
]
export const UNCHECKED_MEASURE = '待检查（尚无养护措施）'

export type ValveGroup = {
  key: string
  cover: string
  measure: string
  rows: EntryRow[]
  wellCodes: string[]
}

export type ValveColumn = {
  cover: string
  groups: ValveGroup[]
}

export type ValvePage = {
  index: number
  totalRows: number
  columns: ValveColumn[]
  groupKeys: string[]
}

export function groupKey(cover: string, measure: string): string {
  return `${cover}||${measure}`
}

export function groupDomId(key: string): string {
  return `valve-group-${key.replace(/[^\w一-龥]+/g, '-')}`
}

// 检查日期缺失的记录视为尚未检查：不参与既有检查分组，单独归到「待检查」栏。
export function isInspected(row: EntryRow): boolean {
  return String(row[DATE_FIELD] ?? '').trim() !== ''
}

export function coverOf(row: EntryRow): string {
  const value = String(row[COVER_FIELD] ?? '').trim()
  return value || '状况未填报'
}

export function measureOf(row: EntryRow): string {
  const value = String(row[MEASURE_FIELD] ?? '').trim()
  return value || MEASURE_ORDER[0]
}

function dateValue(row: EntryRow): number {
  const raw = String(row[DATE_FIELD] ?? '').trim()
  if (!raw) {
    return Number.NEGATIVE_INFINITY
  }
  const parsed = new Date(raw.replace(/\./g, '-')).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

// 组内按检查日期倒序；同一天用记录号倒序兜底，保证每次渲染顺序稳定。
export function sortRowsByDateDesc(rows: EntryRow[]): EntryRow[] {
  return [...rows].sort((a, b) => {
    const gap = dateValue(b) - dateValue(a)
    if (gap !== 0) {
      return gap
    }
    return Number(b.id) - Number(a.id)
  })
}

function orderedBy<T>(present: T[], canonical: T[]): T[] {
  const known = canonical.filter((item) => present.includes(item))
  const extra = present.filter((item) => !canonical.includes(item))
  return [...known, ...extra]
}

function bucketize(rows: EntryRow[], coverResolver: (row: EntryRow) => string, measureResolver: (row: EntryRow) => string): Map<string, Map<string, EntryRow[]>> {
  const buckets = new Map<string, Map<string, EntryRow[]>>()
  for (const row of rows) {
    const cover = coverResolver(row)
    const measure = measureResolver(row)
    if (!buckets.has(cover)) {
      buckets.set(cover, new Map<string, EntryRow[]>())
    }
    const measureMap = buckets.get(cover) as Map<string, EntryRow[]>
    measureMap.set(measure, [...(measureMap.get(measure) ?? []), row])
  }
  return buckets
}

function toColumns(buckets: Map<string, Map<string, EntryRow[]>>, coverSequence: string[]): ValveColumn[] {
  return coverSequence.map((cover) => {
    const measureMap = buckets.get(cover) as Map<string, EntryRow[]>
    const measures = orderedBy([...measureMap.keys()], MEASURE_ORDER)
    const groups: ValveGroup[] = measures.map((measure) => {
      const rows = sortRowsByDateDesc(measureMap.get(measure) ?? [])
      return {
        key: groupKey(cover, measure),
        cover,
        measure,
        rows,
        wellCodes: [...new Set(rows.map((row) => String(row[WELL_CODE_FIELD] ?? '').trim()).filter(Boolean))].sort(),
      }
    })
    return { cover, groups }
  })
}

// 分好组的完整结构：按井盖状况分栏，每栏内按养护措施聚成一组。
export function buildInspectionColumns(rows: EntryRow[]): ValveColumn[] {
  const inspected = rows.filter(isInspected)
  const pending = rows.filter((row) => !isInspected(row))

  const buckets = bucketize(
    inspected,
    coverOf,
    measureOf,
  )
  const coverSequence = orderedBy([...buckets.keys()], COVER_ORDER)
  const columns = toColumns(buckets, coverSequence)

  // 检查日期缺失的井不予受理为检查记录，但台账里还要看得见：单独沉底一栏，方便安排补查。
  if (pending.length) {
    const pendingBuckets = bucketize(
      pending,
      () => UNCHECKED_COVER,
      () => UNCHECKED_MEASURE,
    )
    columns.push(...toColumns(pendingBuckets, [UNCHECKED_COVER]))
  }
  return columns
}

export function flattenGroups(columns: ValveColumn[]): ValveGroup[] {
  return columns.flatMap((column) => column.groups)
}

// 跨组翻页时分组不散：以整组为最小翻页单位贪心装页，任何一组都不会被切到两页。
export function paginateGroups(columns: ValveColumn[], pageSize: number): ValvePage[] {
  const groups = flattenGroups(columns)
  const pagesOfKeys: string[][] = []
  let current: string[] = []
  let currentSize = 0

  for (const group of groups) {
    const size = group.rows.length
    if (current.length > 0 && currentSize + size > pageSize) {
      pagesOfKeys.push(current)
      current = []
      currentSize = 0
    }
    current.push(group.key)
    currentSize += size
    // 一组本身超过单页容量时让它独占一页，宁可留白也不拆散。
    if (size >= pageSize) {
      pagesOfKeys.push(current)
      current = []
      currentSize = 0
    }
  }
  if (current.length > 0) {
    pagesOfKeys.push(current)
  }

  const groupByKey = new Map(groups.map((group) => [group.key, group]))
  return pagesOfKeys.map((keys, index) => {
    const pageGroups = keys.map((key) => groupByKey.get(key) as ValveGroup)
    const coverSequence: string[] = []
    for (const group of pageGroups) {
      if (!coverSequence.includes(group.cover)) {
        coverSequence.push(group.cover)
      }
    }
    const pageColumns: ValveColumn[] = coverSequence.map((cover) => ({
      cover,
      groups: pageGroups.filter((group) => group.cover === cover),
    }))
    return {
      index,
      totalRows: pageGroups.reduce((sum, group) => sum + group.rows.length, 0),
      columns: pageColumns,
      groupKeys: keys,
    }
  })
}

// 井编号直接跳到对应那组：返回落在哪一页、哪个分组，页面再滚动定位并高亮。
export function locateWell(
  groups: ValveGroup[],
  pages: ValvePage[],
  keyword: string,
): { page: number; groupKey: string } | null {
  const query = keyword.trim()
  if (!query) {
    return null
  }
  const pageOf = new Map<string, number>()
  pages.forEach((page) => {
    page.groupKeys.forEach((key) => pageOf.set(key, page.index))
  })
  const exact = groups.find((group) => group.wellCodes.includes(query))
  const target = exact ?? groups.find((group) => group.wellCodes.some((code) => code.includes(query)))
  if (!target) {
    return null
  }
  return { page: pageOf.get(target.key) ?? 0, groupKey: target.key }
}

export function allWellCodes(rows: EntryRow[]): string[] {
  return [...new Set(rows.map((row) => String(row[WELL_CODE_FIELD] ?? '').trim()).filter(Boolean))].sort()
}

// 同一口井可能报送多次：台账与检查单判断「是否已养护」都以这口井最新一条检查记录为准。
export function latestRowByWell(rows: EntryRow[]): Map<string, EntryRow> {
  const latest = new Map<string, EntryRow>()
  for (const row of rows) {
    const code = String(row[WELL_CODE_FIELD] ?? '').trim()
    if (!code) {
      continue
    }
    const prev = latest.get(code)
    const newer =
      !prev ||
      String(row[DATE_FIELD] ?? '') > String(prev[DATE_FIELD] ?? '') ||
      (String(row[DATE_FIELD] ?? '') === String(prev[DATE_FIELD] ?? '') && Number(row.id) > Number(prev.id))
    if (newer) {
      latest.set(code, row)
    }
  }
  return latest
}

// 尚未养护的井编号集合：最新一条记录不是「已养护」的井都算还没养护。
export function unmaintainedWellCodes(rows: EntryRow[]): Set<string> {
  return new Set(
    [...latestRowByWell(rows).values()]
      .filter((row) => String(row.status) !== '已养护')
      .map((row) => String(row[WELL_CODE_FIELD] ?? '').trim())
      .filter(Boolean),
  )
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 打包成册子：一份可直接下载、打印下发的自包含 HTML，按井盖状况分章、养护措施分节、日期倒序。
export function buildInspectionBooklet(rows: EntryRow[], generatedAt: string): string {
  // 册子里只收录已受理的检查记录（有检查日期），待检查的井不属于带走的检查记录册。
  const columns = buildInspectionColumns(rows.filter(isInspected))
  const groups = flattenGroups(columns)
  const recordCount = groups.reduce((sum, group) => sum + group.rows.length, 0)

  const sections = columns
    .map((column) => {
      const blocks = column.groups
        .map((group) => {
          const body = group.rows
            .map((row) => {
              const cells = BOOKLET_COLUMNS.map((field) => {
                const value = field === '当前状态' ? row.status : row[field]
                return `<td>${escapeHtml(value === '' || value == null ? '—' : value)}</td>`
              }).join('')
              return `<tr>${cells}</tr>`
            })
            .join('\n')
          const head = BOOKLET_COLUMNS.map((label) => `<th>${escapeHtml(label)}</th>`).join('')
          return `
          <section class="measure-block">
            <h4 class="measure-title">养护措施：${escapeHtml(group.measure)}<span class="count">（${group.rows.length} 条 · 井号：${escapeHtml(group.wellCodes.join('、')) || '—'}）</span></h4>
            <table>
              <thead><tr>${head}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </section>`
        })
        .join('\n')
      return `
        <section class="cover-chapter">
          <h3 class="cover-title">井盖状况：${escapeHtml(column.cover)}</h3>
          ${blocks}
        </section>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>阀门井检查记录分组册</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #1f2937; margin: 0; }
  .book-cover { text-align: center; padding: 140px 40px 60px; page-break-after: always; }
  .book-cover h1 { font-size: 30px; margin: 0 0 18px; }
  .book-cover .sub { color: #475569; font-size: 15px; line-height: 2; }
  .cover-chapter { page-break-before: always; }
  .cover-title { font-size: 20px; border-left: 6px solid #1f6feb; padding-left: 10px; margin: 8px 0 14px; }
  .measure-block { margin-bottom: 18px; page-break-inside: avoid; }
  .measure-title { font-size: 15px; margin: 12px 0 6px; }
  .count { color: #64748b; font-weight: normal; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #94a3b8; padding: 5px 7px; text-align: left; }
  th { background: #eef2f7; }
  .book-footer { margin-top: 24px; color: #64748b; font-size: 12px; text-align: right; }
  @media print { .no-print { display: none; } body { color: #000; } }
</style>
</head>
<body>
  <div class="book-cover">
    <h1>阀门井检查记录分组册</h1>
    <div class="sub">
      按井盖状况分栏 · 栏内按养护措施分组 · 组内检查日期倒序<br />
      收录检查记录 ${recordCount} 条，覆盖井盖状况 ${columns.length} 栏、检查组别 ${groups.length} 组<br />
      成册时间：${escapeHtml(generatedAt)}<br />
      供班组现场带走核对，签收后归档
    </div>
  </div>
  ${sections}
  <p class="book-footer">本册由阀门井检查单自动打包导出 · ${escapeHtml(generatedAt)}</p>
</body>
</html>`
}
