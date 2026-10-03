import type { GroupPage, InspectionGroup, LeakReviewItem, ValveInspection } from './types'

// 检查单与阀门井台账共用的检查记录集合，以及探漏待复核清单集合。
export const VALVE_INSPECTIONS_KEY = 'district-heating:valve-inspections'
export const LEAK_REVIEWS_KEY = 'district-heating:leak-reviews'

// 井盖状况的固定栏次顺序，册子与页面都按这个顺序分栏。
export const COVER_ORDER = ['完好', '轻微锈蚀', '沉降', '破损', '缺失']
// 各栏内养护措施的排列顺序；「未养护」代表还没做养护的井，固定排在该栏最前。
export const MEASURE_ORDER = ['未养护', '防腐涂漆', '调整找平', '更换井盖', '加装防盗锁', '清淤排水']
export const PENDING_MEASURE = '未养护'
// 每页整组放入，分组不会被翻页拆散。
export const GROUPS_PER_PAGE = 4

export const COVER_OPTIONS = COVER_ORDER
export const MEASURE_OPTIONS = MEASURE_ORDER

// 首次打开时播种的检查记录：同一口井跨月多次检查，能看出「越攒越多、按日期倒序」。
export const SEED_VALVE_INSPECTIONS: ValveInspection[] = [
  { id: 1, wellCode: 'VALV-0001', section: 'DN300 一次网东段', coverStatus: '完好', valveModel: 'Z41H-16C DN200', inspector: '王建国', inspectDate: '2026-08-12', measure: '未养护', wellState: '正常', remark: '井内干燥，阀门启闭灵活', createdAt: '2026-08-12T09:20:00' },
  { id: 2, wellCode: 'VALV-0001', section: 'DN300 一次网东段', coverStatus: '完好', valveModel: 'Z41H-16C DN200', inspector: '王建国', inspectDate: '2026-09-05', measure: '防腐涂漆', wellState: '正常', remark: '阀杆轻微锈迹，已补漆', createdAt: '2026-09-05T09:40:00' },
  { id: 3, wellCode: 'VALV-0002', section: 'DN250 二次网阳光片区', coverStatus: '轻微锈蚀', valveModel: 'Z45X-16Q DN150', inspector: '李淑芬', inspectDate: '2026-08-18', measure: '未养护', wellState: '正常', remark: '井盖边缘锈蚀，暂不影响使用', createdAt: '2026-08-18T10:05:00' },
  { id: 4, wellCode: 'VALV-0002', section: 'DN250 二次网阳光片区', coverStatus: '轻微锈蚀', valveModel: 'Z45X-16Q DN150', inspector: '李淑芬', inspectDate: '2026-09-10', measure: '防腐涂漆', wellState: '正常', remark: '锈面打磨后涂刷防锈漆两道', createdAt: '2026-09-10T10:30:00' },
  { id: 5, wellCode: 'VALV-0003', section: 'DN400 一次网北环', coverStatus: '沉降', valveModel: 'D343H-16C DN300', inspector: '张志强', inspectDate: '2026-08-21', measure: '未养护', wellState: '需观察', remark: '井盖较路面低约 5cm，雨季易积水', createdAt: '2026-08-21T14:10:00' },
  { id: 6, wellCode: 'VALV-0003', section: 'DN400 一次网北环', coverStatus: '沉降', valveModel: 'D343H-16C DN300', inspector: '张志强', inspectDate: '2026-09-15', measure: '调整找平', wellState: '正常', remark: '重新支垫并找平至路面标高', createdAt: '2026-09-15T14:45:00' },
  { id: 7, wellCode: 'VALV-0004', section: 'DN200 二次网建设路', coverStatus: '破损', valveModel: 'Z45X-16Q DN100', inspector: '刘永刚', inspectDate: '2026-08-25', measure: '未养护', wellState: '需观察', remark: '井盖边框开裂一角', createdAt: '2026-08-25T11:00:00' },
  { id: 8, wellCode: 'VALV-0004', section: 'DN200 二次网建设路', coverStatus: '破损', valveModel: 'D343H-16C DN300', inspector: '刘永刚', inspectDate: '2026-09-18', measure: '更换井盖', wellState: '正常', remark: '整副井盖井圈一并换新', createdAt: '2026-09-18T11:30:00' },
  { id: 9, wellCode: 'VALV-0005', section: 'DN150 二次网滨河支线', coverStatus: '缺失', valveModel: 'Z15W-16T DN80', inspector: '陈伟', inspectDate: '2026-08-28', measure: '未养护', wellState: '需观察', remark: '井盖被盗，已临时围挡', createdAt: '2026-08-28T16:00:00' },
  { id: 10, wellCode: 'VALV-0005', section: 'DN150 二次网滨河支线', coverStatus: '缺失', valveModel: 'Z15W-16T DN80', inspector: '陈伟', inspectDate: '2026-09-20', measure: '加装防盗锁', wellState: '正常', remark: '新井盖加装防盗合页锁', createdAt: '2026-09-20T16:20:00' },
  { id: 11, wellCode: 'VALV-0006', section: 'DN350 一次网南环', coverStatus: '完好', valveModel: 'Z41H-16C DN250', inspector: '赵敏', inspectDate: '2026-09-02', measure: '清淤排水', wellState: '正常', remark: '井底少量积水淤积，已抽排清掏', createdAt: '2026-09-02T09:00:00' },
  { id: 12, wellCode: 'VALV-0007', section: 'DN250 二次网新华片区', coverStatus: '轻微锈蚀', valveModel: 'Z45X-16Q DN150', inspector: '孙浩', inspectDate: '2026-09-08', measure: '未养护', wellState: '需观察', remark: '锈蚀面积约三成，列入下月养护', createdAt: '2026-09-08T10:50:00' },
  { id: 13, wellCode: 'VALV-0008', section: 'DN300 一次网西延', coverStatus: '沉降', valveModel: 'D343H-16C DN250', inspector: '周丽华', inspectDate: '2026-09-12', measure: '未养护', wellState: '需观察', remark: '井周路面下沉，待管线所统一处理', createdAt: '2026-09-12T15:10:00' },
  { id: 14, wellCode: 'VALV-0003', section: 'DN400 一次网北环', coverStatus: '轻微锈蚀', valveModel: 'D343H-16C DN300', inspector: '张志强', inspectDate: '2026-09-22', measure: '防腐涂漆', wellState: '正常', remark: '井圈内侧除锈补漆', createdAt: '2026-09-22T15:30:00' },
  { id: 15, wellCode: 'VALV-0001', section: 'DN300 一次网东段', coverStatus: '完好', valveModel: 'Z41H-16C DN200', inspector: '王建国', inspectDate: '2026-09-25', measure: '清淤排水', wellState: '正常', remark: '汛后例行清淤', createdAt: '2026-09-25T09:15:00' },
  { id: 16, wellCode: 'VALV-0006', section: 'DN350 一次网南环', coverStatus: '完好', valveModel: 'Z41H-16C DN250', inspector: '赵敏', inspectDate: '2026-09-26', measure: '防腐涂漆', wellState: '正常', remark: '阀杆补漆保养', createdAt: '2026-09-26T09:35:00' },
  { id: 17, wellCode: 'VALV-0004', section: 'DN200 二次网建设路', coverStatus: '破损', valveModel: 'Z45X-16Q DN100', inspector: '刘永刚', inspectDate: '2026-09-27', measure: '未养护', wellState: '需观察', remark: '相邻井圈又发现新裂纹', createdAt: '2026-09-27T11:10:00' },
  { id: 18, wellCode: 'VALV-0008', section: 'DN300 一次网西延', coverStatus: '沉降', valveModel: 'D343H-16C DN250', inspector: '周丽华', inspectDate: '2026-09-28', measure: '清淤排水', wellState: '正常', remark: '积水抽排后再观察沉降', createdAt: '2026-09-28T15:00:00' },
]

// 探漏侧待复核清单的初始数据：与上面最近的检查结果对应。
export const SEED_LEAK_REVIEWS: LeakReviewItem[] = [
  { id: 1, sourceId: 13, wellCode: 'VALV-0008', section: 'DN300 一次网西延', inspectDate: '2026-09-12', measure: '未养护', result: '井体状态：需观察；井周路面下沉，待管线所统一处理', status: '待复核', createdAt: '2026-09-12T15:10:00' },
  { id: 2, sourceId: 17, wellCode: 'VALV-0004', section: 'DN200 二次网建设路', inspectDate: '2026-09-27', measure: '未养护', result: '井体状态：需观察；相邻井圈又发现新裂纹', status: '待复核', createdAt: '2026-09-27T11:10:00' },
  { id: 3, sourceId: 5, wellCode: 'VALV-0003', section: 'DN400 一次网北环', inspectDate: '2026-08-21', measure: '未养护', result: '井体状态：需观察；井盖较路面低约 5cm，雨季易积水', status: '已复核', createdAt: '2026-08-21T14:10:00' },
]

function orderIndex(list: string[], value: string): number {
  const index = list.indexOf(value)
  return index < 0 ? list.length : index
}

// 组内按检查日期倒序，日期相同按报送时间倒序、再按编号兜底。
export function sortInspections(rows: ValveInspection[]): ValveInspection[] {
  return [...rows].sort((a, b) => {
    if (a.inspectDate !== b.inspectDate) {
      return a.inspectDate < b.inspectDate ? 1 : -1
    }
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? 1 : -1
    }
    return b.id - a.id
  })
}

// 全部记录按「井盖状况 → 养护措施」聚成有序的组序列；空栏、空组不出现。
export function buildGroups(rows: ValveInspection[]): InspectionGroup[] {
  const buckets = new Map<string, ValveInspection[]>()
  for (const row of rows) {
    const key = `${row.coverStatus}／${row.measure}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(row)
    } else {
      buckets.set(key, [row])
    }
  }
  return [...buckets.entries()]
    .map(([key, items]) => {
      const first = items[0]
      return {
        key,
        globalIndex: -1,
        coverStatus: first.coverStatus,
        measure: first.measure,
        maintained: first.measure !== PENDING_MEASURE,
        items: sortInspections(items),
      }
    })
    .sort((a, b) => {
      const coverDiff = orderIndex(COVER_ORDER, a.coverStatus) - orderIndex(COVER_ORDER, b.coverStatus)
      if (coverDiff !== 0) {
        return coverDiff
      }
      return orderIndex(MEASURE_ORDER, a.measure) - orderIndex(MEASURE_ORDER, b.measure)
    })
    .map((group, index) => ({ ...group, globalIndex: index }))
}

// 以组为最小翻页单位分页：任何一组都完整落在同一页，跨组翻页不散组。
export function paginateGroups(groups: InspectionGroup[], page: number): GroupPage {
  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * GROUPS_PER_PAGE
  return {
    page: safePage,
    totalPages,
    totalGroups: groups.length,
    totalItems: groups.reduce((sum, group) => sum + group.items.length, 0),
    groups: groups.slice(start, start + GROUPS_PER_PAGE),
  }
}

// 井编号落在哪个组：取该井最近一次检查记录所在组；找不到返回 null。
export function locateWellGroup(groups: InspectionGroup[], wellCode: string): InspectionGroup | null {
  const code = wellCode.trim()
  if (!code) {
    return null
  }
  const own = groups
    .filter((group) => group.items.some((item) => item.wellCode === code))
    .sort((a, b) => {
      const latestA = a.items.find((item) => item.wellCode === code)
      const latestB = b.items.find((item) => item.wellCode === code)
      if (!latestA || !latestB) {
        return 0
      }
      return latestA.inspectDate < latestB.inspectDate ? 1 : -1
    })
  return own[0] ?? null
}

export function groupPageNumber(group: InspectionGroup): number {
  return Math.floor(group.globalIndex / GROUPS_PER_PAGE) + 1
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 把分好组的记录打包成可直接打印下发的 HTML 册子（自带封面、目录、页码、分页）。
export function buildBookletHtml(groups: InspectionGroup[], exportedAt: string): string {
  const covers = COVER_ORDER.filter((cover) => groups.some((group) => group.coverStatus === cover))
  const toc = groups.map(
    (group) =>
      `<li><span class="toc-title">${escapeHtml(group.coverStatus)}栏 · ${escapeHtml(group.measure)}</span>` +
      `<span class="toc-dots"></span><span class="toc-page">第 ${groupPageNumber(group)} 页</span></li>`,
  )
  const sections = covers.map((cover) => {
    const sectionGroups = groups.filter((group) => group.coverStatus === cover)
    const blocks = sectionGroups
      .map((group) => {
        const rowsHtml = group.items
          .map(
            (item) =>
              `<tr><td>${escapeHtml(item.wellCode)}</td><td>${escapeHtml(item.section)}</td>` +
              `<td>${escapeHtml(item.valveModel)}</td><td>${escapeHtml(item.inspectDate)}</td>` +
              `<td>${escapeHtml(item.inspector)}</td><td>${escapeHtml(item.measure)}</td>` +
              `<td>${escapeHtml(item.wellState)}</td><td>${escapeHtml(item.remark)}</td></tr>`,
          )
          .join('')
        return `<section class="group">
          <h3>${escapeHtml(group.measure)}<small>本组 ${group.items.length} 条 · 按检查日期倒序</small></h3>
          <table><thead><tr><th>井编号</th><th>所属管段</th><th>阀门型号</th><th>检查日期</th><th>检查人</th><th>养护措施</th><th>井体状态</th><th>检查情况</th></tr></thead>
          <tbody>${rowsHtml}</tbody></table>
        </section>`
      })
      .join('')
    return `<section class="cover-column page-break">
      <h2>井盖状况：${escapeHtml(cover)}<small>本栏 ${sectionGroups.length} 组 · ${sectionGroups.reduce((sum, group) => sum + group.items.length, 0)} 条</small></h2>
      ${blocks}
    </section>`
  })

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>阀门井检查记录册</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #1f2937; margin: 0; }
  .cover { text-align: center; padding: 140px 40px; page-break-after: always; }
  .cover h1 { font-size: 30px; margin: 0 0 16px; }
  .cover p { color: #64748b; font-size: 14px; line-height: 2; }
  .toc-page { padding: 24px 28px; page-break-after: always; }
  .toc-page h2 { font-size: 20px; border-bottom: 2px solid #1f6feb; padding-bottom: 8px; }
  .toc-page ol { list-style: none; padding: 0; margin: 16px 0; }
  .toc-page li { display: flex; align-items: baseline; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #d8dee6; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #94a3b8; margin: 0 8px; transform: translateY(-4px); }
  .toc-page { counter-reset: none; }
  .cover-column { padding: 20px 24px; }
  .cover-column h2 { font-size: 18px; background: #1f6feb; color: #fff; padding: 10px 14px; border-radius: 6px; margin: 0 0 14px; }
  .cover-column h2 small { float: right; font-size: 12px; font-weight: normal; opacity: .85; }
  .group { margin-bottom: 18px; page-break-inside: avoid; }
  .group h3 { font-size: 15px; margin: 0 0 6px; padding-left: 10px; border-left: 4px solid #1f6feb; }
  .group h3 small { margin-left: 10px; color: #64748b; font-size: 12px; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #9fb0c3; padding: 5px 7px; text-align: left; }
  th { background: #eef4ff; }
  .page-break { page-break-before: always; }
  @media print { .no-print { display: none; } body { color: #000; } }
</style>
</head>
<body>
  <div class="cover">
    <h1>阀门井检查记录册</h1>
    <p>按井盖状况分栏 · 栏内按养护措施分组 · 组内按检查日期倒序</p>
    <p>共 ${covers.length} 栏 · ${groups.length} 组 · ${groups.reduce((sum, group) => sum + group.items.length, 0)} 条检查记录</p>
    <p>导出时间：${escapeHtml(exportedAt)}</p>
    <p class="no-print">浏览器中按 Ctrl/⌘ + P 可直接打印或另存为 PDF 下发给班组。</p>
  </div>
  <div class="toc-page">
    <h2>分组目录</h2>
    <ol>${toc.join('')}</ol>
  </div>
  ${sections.join('\n')}
</body>
</html>`
}
