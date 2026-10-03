import { MODULE_BY_KEY } from '@/data/modules'
import { allRows, listReviews, listRows, resetRows, saveReviews, saveRows } from '@/data/local-store'
import type {
  ActionResult,
  EntryRow,
  LeakReviewItem,
  ModuleMeta,
  OverviewResult,
  PageResult,
  SubmitValveInspectionResult,
  ValveInspectionInput,
} from '@/data/types'

// 会写进数据的「往回走」动作：命中就把这条记录标成异常态，看板上能一眼看出来。
const NEGATIVE_ACTIONS = ['撤销', '作废', '拒绝', '驳回', '停用', '忽略', '下线', '回滚']

// 阀门井检查报送后进入的状态：兼容既有「提交检查 → 检查中」做法。
const VALVE_MODULE_KEY = 'valvewell'
const LEAK_MODULE_KEY = 'leakdetect'
const VALVE_SUBMIT_STATUS = '检查中'
// 探漏待复核确认后落到探漏台账的状态：需要再探一次。
const LEAK_RECHECK_STATUS = '需复探'

export function moduleMeta(key: string): ModuleMeta {
  const meta = MODULE_BY_KEY.get(key)
  if (!meta) {
    throw new Error(`没有登记名为 ${key} 的业务模块`)
  }
  return meta
}

export function filterRows(rows: EntryRow[], filters: Record<string, string>): EntryRow[] {
  const pairs = Object.entries(filters).filter(([, value]) => value.trim() !== '')
  if (pairs.length === 0) {
    return rows
  }
  return rows.filter((row) =>
    pairs.every(([field, value]) => String(row[field] ?? '').includes(value.trim())),
  )
}

export function listEntries(key: string, filters: Record<string, string> = {}): PageResult {
  const matched = filterRows(listRows(key), filters)
  return { items: matched, total: matched.length, page: 1, size: matched.length }
}

export function runAction(key: string, id: number, action: string): ActionResult {
  const meta = moduleMeta(key)
  const target = meta.actionTargets[action]
  if (!target) {
    return { ok: false, message: `${meta.entity}没有登记「${action}」这个动作` }
  }
  const rows = listRows(key)
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) {
    return { ok: false, message: `没有找到编号为 ${id} 的${meta.entity}` }
  }
  const current = String(rows[index].status)
  if (current === target) {
    return { ok: false, message: `${meta.entity}已经是「${target}」，不用重复操作` }
  }
  const lastStatus = meta.statuses[meta.statuses.length - 1]
  const updated: EntryRow = {
    ...rows[index],
    status: target,
    pending: target !== lastStatus,
    abnormal: NEGATIVE_ACTIONS.some((verb) => action.startsWith(verb)),
  }
  const next = [...rows]
  next[index] = updated
  saveRows(key, next)
  return { ok: true, message: `${meta.entity}已${action}，当前状态「${target}」` }
}

export function resetModule(key: string): PageResult {
  resetRows(key)
  return listEntries(key)
}

export function exportEntries(key: string): { filename: string; content: string } {
  const meta = moduleMeta(key)
  const header = ['编号', ...meta.fields, '当前状态']
  const lines = [header.join(',')]
  for (const row of listRows(key)) {
    lines.push([row.id, ...meta.fields.map((field) => row[field] ?? ''), row.status].join(','))
  }
  return { filename: `${meta.name}-清单.csv`, content: `\uFEFF${lines.join('\n')}` }
}

export function downloadEntries(key: string): void {
  const { filename, content } = exportEntries(key)
  downloadFile(filename, content, 'text/csv;charset=utf-8')
}

// 通用下载：册子 HTML 与清单 CSV 都走这里，导出后浏览器直接弹出下载，拿回去即可下发。
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function nowStamp(): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function nextId(rows: EntryRow[]): number {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
}

function nextReviewNumber(items: LeakReviewItem[]): number {
  return items.reduce((max, item) => {
    const matched = /^REVW-(\d+)$/.exec(item.id)
    return matched ? Math.max(max, Number(matched[1])) : max
  }, 0) + 1
}

function buildReviewNote(input: ValveInspectionInput): string {
  const cover = input.井盖状况.trim() || '状况未填写'
  const measure = input.养护措施.trim() || '养护措施未填写'
  return `阀门井检查回写：井盖${cover}，现场养护措施「${measure}」，井体状态「${input.井体状态.trim() || '未描述'}」，请探漏班组现场复核是否存在暗漏。`
}

function pushLeakReview(row: EntryRow, reviewId: string): void {
  const items = listReviews()
  const item: LeakReviewItem = {
    id: reviewId,
    sourceKey: VALVE_MODULE_KEY,
    sourceId: Number(row.id),
    井编号: String(row.井编号 ?? ''),
    所属管段: String(row.所属管段 ?? ''),
    井盖状况: String(row.井盖状况 ?? ''),
    养护措施: String(row.养护措施 ?? ''),
    检查日期: String(row.检查日期 ?? ''),
    检查人: String(row.检查人 ?? ''),
    井体状态: String(row.井体状态 ?? ''),
    备注: buildReviewNote({
      井编号: String(row.井编号 ?? ''),
      所属管段: String(row.所属管段 ?? ''),
      井盖状况: String(row.井盖状况 ?? ''),
      阀门型号: String(row.阀门型号 ?? ''),
      检查人: String(row.检查人 ?? ''),
      检查日期: String(row.检查日期 ?? ''),
      养护措施: String(row.养护措施 ?? ''),
      井体状态: String(row.井体状态 ?? ''),
    }),
    state: '待复核',
    createdAt: nowStamp(),
  }
  saveReviews([item, ...items])
}

// 阀门井检查报送：台账与检查单取同一份数据；检查日期缺失不予受理；同井同日重复报送按第一次认。
export function submitValveInspection(input: ValveInspectionInput): SubmitValveInspectionResult {
  const 井编号 = input.井编号.trim()
  const 检查日期 = input.检查日期.trim()
  const 井盖状况 = input.井盖状况.trim()
  if (!井编号) {
    return { ok: false, message: '井编号不能为空，无法受理本次检查报送。' }
  }
  if (!检查日期) {
    return { ok: false, message: '检查日期缺失的检查报送不予受理，请补填检查日期后再报送。' }
  }
  if (!井盖状况) {
    return { ok: false, message: '井盖状况未判定，无法分组归档，请补填后再报送。' }
  }
  const rows = listRows(VALVE_MODULE_KEY)
  // 同一口井、同一天只认第一次报送：后续重复提交直接退回，并指明第一次报送的记录号。
  const duplicated = rows.find(
    (row) => String(row.井编号 ?? '').trim() === 井编号 && String(row.检查日期 ?? '').trim() === 检查日期,
  )
  if (duplicated) {
    return {
      ok: false,
      message: `井 ${井编号} 在 ${检查日期} 的检查已报送过（记录 #${duplicated.id}），重复报送按第一次报送认定，不再重复登记。`,
      id: Number(duplicated.id),
    }
  }
  const id = nextId(rows)
  const created: EntryRow = {
    id,
    status: VALVE_SUBMIT_STATUS,
    pending: true,
    abnormal: false,
    井编号,
    所属管段: input.所属管段.trim(),
    井盖状况,
    阀门型号: input.阀门型号.trim(),
    检查人: input.检查人.trim(),
    检查日期,
    养护措施: input.养护措施.trim(),
    井体状态: input.井体状态.trim(),
  }
  saveRows(VALVE_MODULE_KEY, [...rows, created])

  // 检查结果回写到探漏那边的待复核清单。
  const reviewId = `REVW-${String(nextReviewNumber(listReviews())).padStart(4, '0')}`
  pushLeakReview(created, reviewId)
  return {
    ok: true,
    message: `井 ${井编号} 的检查报送已受理（记录 #${id}），结果已回写到探漏待复核清单（${reviewId}）。`,
    id,
    reviewId,
  }
}

export function listLeakReviews(state: '全部' | '待复核' | '已确认' | '已排除' = '全部'): LeakReviewItem[] {
  const items = listReviews()
  return state === '全部' ? items : items.filter((item) => item.state === state)
}

// 探漏班组完成复核：确认的会在探漏台账里登记一条「需复探」记录，待复核清单同步标记。
export function resolveLeakReview(reviewId: string, resolution: '确认' | '排除'): ActionResult {
  const items = listReviews()
  const index = items.findIndex((item) => item.id === reviewId)
  if (index < 0) {
    return { ok: false, message: `没有找到待复核单 ${reviewId}` }
  }
  const item = items[index]
  if (item.state !== '待复核') {
    return { ok: false, message: `${reviewId} 已${item.state}，不能重复复核。` }
  }

  if (resolution === '确认') {
    const leakRows = listRows(LEAK_MODULE_KEY)
    const leadId = nextId(leakRows)
    const leakRow: EntryRow = {
      id: leadId,
      status: LEAK_RECHECK_STATUS,
      pending: true,
      abnormal: true,
      探漏编号: `LEAK-R${String(leadId).padStart(4, '0')}`,
      探测管段: item.所属管段 || '待补充管段',
      探测方法: '阀井复核',
      漏点数量: 0,
      漏点位置: item.井编号,
      处理建议: item.备注,
      探测日期: item.检查日期,
      探漏状态: LEAK_RECHECK_STATUS,
    }
    saveRows(LEAK_MODULE_KEY, [...leakRows, leakRow])
  }

  const next = [...items]
  next[index] = { ...item, state: resolution === '确认' ? '已确认' : '已排除' }
  saveReviews(next)
  return {
    ok: true,
    message:
      resolution === '确认'
        ? `${reviewId} 已确认，已登记一条探漏「需复探」记录（井 ${item.井编号}）。`
        : `${reviewId} 已排除，不再列入探漏复核。`,
  }
}

export function loadOverview(): OverviewResult {
  const rows = allRows()
  const modules = [...MODULE_BY_KEY.values()].map((meta) => {
    const entries = rows[meta.key] ?? []
    return {
      name: meta.name,
      created: entries.length,
      pending: entries.filter((row) => row.pending).length,
      abnormal: entries.filter((row) => row.abnormal).length,
    }
  })
  const cards = [
    { label: '业务模块', value: modules.length },
    { label: '登记总量', value: modules.reduce((sum, item) => sum + item.created, 0) },
    { label: '待处理', value: modules.reduce((sum, item) => sum + item.pending, 0) },
    { label: '异常量', value: modules.reduce((sum, item) => sum + item.abnormal, 0) },
  ]
  return { cards, modules }
}
