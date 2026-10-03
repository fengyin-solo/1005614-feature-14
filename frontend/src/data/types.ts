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

// 阀门井检查报送的录入内容：台账与检查单都围绕这同一份记录读写。
export type ValveInspectionInput = {
  井编号: string
  所属管段: string
  井盖状况: string
  阀门型号: string
  检查人: string
  检查日期: string
  养护措施: string
  井体状态: string
}

export type SubmitValveInspectionResult = {
  ok: boolean
  message: string
  id?: number
  reviewId?: string
}

// 阀门井检查结果回写到探漏那边的待复核清单。
export type LeakReviewItem = {
  id: string
  sourceKey: string
  sourceId: number
  井编号: string
  所属管段: string
  井盖状况: string
  养护措施: string
  检查日期: string
  检查人: string
  井体状态: string
  备注: string
  state: '待复核' | '已确认' | '已排除'
  createdAt: string
}
