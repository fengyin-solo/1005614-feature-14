/** 纯前端数据层的公共类型：与全栈版后端返回的结构保持一致，换回后端时页面不用改。 */

export type EntryRow = {
  id: number
  status: string
  pending: boolean
  abnormal: boolean
  [field: string]: string | number | boolean
}

export type ModuleMeta = {
  key: string
  name: string
  entity: string
  desc: string
  fields: string[]
  statuses: string[]
  actions: string[]
  actionTargets: Record<string, string>
  metrics: string[]
}

export type PageResult = {
  items: EntryRow[]
  total: number
  page: number
  size: number
}

export type ActionResult = {
  ok: boolean
  message: string
}

export type OverviewResult = {
  cards: { label: string; value: number }[]
  modules: { name: string; created: number; pending: number; abnormal: number }[]
}

// 阀门井检查记录：阀门井台账与检查单（报送/册子）共用的唯一数据源。
export type ValveInspection = {
  id: number
  wellCode: string
  section: string
  coverStatus: string
  valveModel: string
  inspector: string
  inspectDate: string
  measure: string
  wellState: string
  remark: string
  createdAt: string
}

// 检查结果回写到探漏侧的待复核清单。
export type LeakReviewItem = {
  id: number
  sourceId: number
  wellCode: string
  section: string
  inspectDate: string
  measure: string
  result: string
  status: string
  createdAt: string
}

// 一条检查记录按（井盖状况 → 养护措施）落到一个组里。
export type InspectionGroup = {
  key: string
  globalIndex: number
  coverStatus: string
  measure: string
  maintained: boolean
  items: ValveInspection[]
}

export type GroupPage = {
  page: number
  totalPages: number
  totalGroups: number
  totalItems: number
  groups: InspectionGroup[]
}
