import { listRows, readCollection, saveRows, writeCollection } from '@/data/local-store'
import type { ActionResult, EntryRow, LeakReviewItem, ValveInspection } from '@/data/types'
import {
  buildBookletHtml,
  buildGroups,
  groupPageNumber,
  LEAK_REVIEWS_KEY,
  locateWellGroup,
  paginateGroups,
  PENDING_MEASURE,
  SEED_LEAK_REVIEWS,
  SEED_VALVE_INSPECTIONS,
  sortInspections,
  VALVE_INSPECTIONS_KEY,
} from '@/data/valvewell'

// 检查单的录入结构；检查日期是受理的硬性条件。
export type InspectionInput = {
  wellCode: string
  section: string
  coverStatus: string
  valveModel: string
  inspector: string
  inspectDate: string
  measure: string
  wellState: string
  remark: string
}

export type SubmitResult = ActionResult & { inspection?: ValveInspection }

export function listInspections(): ValveInspection[] {
  return sortInspections(readCollection(VALVE_INSPECTIONS_KEY, SEED_VALVE_INSPECTIONS))
}

// 每口井最近一次检查：台账页直接用，保证台账与检查单读同一份数据。
export function latestInspectionByWell(): Map<string, ValveInspection> {
  const map = new Map<string, ValveInspection>()
  for (const item of listInspections()) {
    const current = map.get(item.wellCode)
    if (!current || item.inspectDate > current.inspectDate) {
      map.set(item.wellCode, item)
    }
  }
  return map
}

export function listLeakReviews(): LeakReviewItem[] {
  const rows = readCollection(LEAK_REVIEWS_KEY, SEED_LEAK_REVIEWS)
  return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1
}

function nowStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 报送检查：检查日期缺失一律不予受理；同一井同一天重复报送按第一次为准。
export function submitInspection(input: InspectionInput): SubmitResult {
  const wellCode = input.wellCode.trim()
  const inspectDate = input.inspectDate.trim()
  if (!wellCode) {
    return { ok: false, message: '井编号不能为空，检查报送不予受理' }
  }
  if (!inspectDate) {
    return { ok: false, message: '检查日期缺失，该检查报送不予受理' }
  }
  const rows = readCollection(VALVE_INSPECTIONS_KEY, SEED_VALVE_INSPECTIONS)
  const duplicate = rows.find((row) => row.wellCode === wellCode && row.inspectDate === inspectDate)
  if (duplicate) {
    return { ok: false, message: `井 ${wellCode} 在 ${inspectDate} 已有检查报送，重复报送按第一次为准` }
  }

  const stamp = new Date().toISOString()
  const inspection: ValveInspection = {
    id: nextId(rows),
    wellCode,
    section: input.section.trim(),
    coverStatus: input.coverStatus,
    valveModel: input.valveModel.trim(),
    inspector: input.inspector.trim() || '未填写',
    inspectDate,
    measure: input.measure,
    wellState: input.wellState.trim() || '正常',
    remark: input.remark.trim(),
    createdAt: stamp,
  }
  writeCollection(VALVE_INSPECTIONS_KEY, [...rows, inspection])

  syncLedger(inspection)
  appendLeakReview(inspection)

  return { ok: true, message: `井 ${wellCode} 的检查报送已受理`, inspection }
}

// 回写阀门井台账：沿用既有「提交检查 → 检查中、确认养护 → 已养护」的状态流转。
function syncLedger(inspection: ValveInspection): void {
  const ledger = listRows('valvewell')
  const index = ledger.findIndex((row) => String(row['井编号']) === inspection.wellCode)
  if (index < 0) {
    return
  }
  const target = inspection.measure === PENDING_MEASURE ? '检查中' : '已养护'
  const updated: EntryRow = {
    ...ledger[index],
    status: target,
    pending: target === '检查中',
    所属管段: inspection.section || ledger[index]['所属管段'],
    井盖状况: inspection.coverStatus,
    阀门型号: inspection.valveModel || ledger[index]['阀门型号'],
    检查人: inspection.inspector,
    检查日期: inspection.inspectDate,
    养护措施: inspection.measure,
    井体状态: inspection.wellState,
  }
  const next = [...ledger]
  next[index] = updated
  saveRows('valvewell', next)
}

// 检查结果回写到探漏那边的待复核清单。
function appendLeakReview(inspection: ValveInspection): void {
  const reviews = readCollection(LEAK_REVIEWS_KEY, SEED_LEAK_REVIEWS)
  const item: LeakReviewItem = {
    id: nextId(reviews),
    sourceId: inspection.id,
    wellCode: inspection.wellCode,
    section: inspection.section,
    inspectDate: inspection.inspectDate,
    measure: inspection.measure,
    result: `井体状态：${inspection.wellState}；${inspection.remark || '无补充说明'}`,
    status: '待复核',
    createdAt: inspection.createdAt,
  }
  writeCollection(LEAK_REVIEWS_KEY, [...reviews, item])
}

export function confirmLeakReview(id: number): ActionResult {
  const reviews = readCollection(LEAK_REVIEWS_KEY, SEED_LEAK_REVIEWS)
  const index = reviews.findIndex((row) => row.id === id)
  if (index < 0) {
    return { ok: false, message: '没有找到这条待复核记录' }
  }
  if (reviews[index].status === '已复核') {
    return { ok: false, message: '该条检查结果已经复核过了' }
  }
  const next = [...reviews]
  next[index] = { ...reviews[index], status: '已复核' }
  writeCollection(LEAK_REVIEWS_KEY, next)
  return { ok: true, message: '检查结果已复核确认' }
}

export type InspectionFilter = {
  wellCode?: string
  coverStatus?: string
  onlyPending?: boolean
}

function applyFilters(rows: ValveInspection[], filter: InspectionFilter): ValveInspection[] {
  const code = filter.wellCode?.trim() ?? ''
  let matched = rows.filter((row) => {
    if (code && !row.wellCode.includes(code)) {
      return false
    }
    if (filter.coverStatus && row.coverStatus !== filter.coverStatus) {
      return false
    }
    return true
  })
  if (filter.onlyPending) {
    // 「还没养护的井」= 从来没有养护记录的井；只看这些井的全部检查记录，便于挑井。
    const maintainedWells = new Set(
      rows.filter((row) => row.measure !== PENDING_MEASURE).map((row) => row.wellCode),
    )
    matched = matched.filter((row) => !maintainedWells.has(row.wellCode))  }
  return matched
}

// 从未做过养护的井编号：台账上用来挑出还没养护的井。
export function wellsWithoutMaintenance(): string[] {
  const rows = listInspections()
  const maintained = new Set(rows.filter((row) => row.measure !== PENDING_MEASURE).map((row) => row.wellCode))
  const pending = Array.from(new Set(rows.filter((row) => row.measure === PENDING_MEASURE).map((row) => row.wellCode)))
  return pending.filter((code) => !maintained.has(code))
}

// 分好组、整组翻页后的一页册子数据。
export function groupedInspectionPage(filter: InspectionFilter, page: number) {
  const groups = buildGroups(applyFilters(listInspections(), filter))
  return paginateGroups(groups, page)
}

export function allGroupedInspections(filter: InspectionFilter = {}) {
  return buildGroups(applyFilters(listInspections(), filter))
}

export function pageNumberOfWell(wellCode: string, filter: InspectionFilter = {}): { page: number; groupKey: string } | null {
  const groups = buildGroups(applyFilters(listInspections(), filter))
  // 取该井最近一次检查所在的组，跳过去就是它在册子里的位置。
  const group = locateWellGroup(groups, wellCode)
  if (!group) {
    return null
  }
  return { page: groupPageNumber(group), groupKey: group.key }
}

// 把当前筛选下分好组的记录打包成 HTML 册子并触发下载。
export function downloadInspectionBooklet(filter: InspectionFilter = {}): void {
  const groups = buildGroups(applyFilters(listInspections(), filter))
  const html = buildBookletHtml(groups, nowStamp())
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '阀门井检查记录册.html'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
