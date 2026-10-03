<template>
  <section class="page" data-module="valvewell">
    <header class="page-head">
      <div>
        <h2>阀门井维护管理</h2>
        <p class="page-desc">
          阀门井台账与检查单取同一份检查数据；检查记录按井盖状况分栏、栏内按养护措施分组，组内检查日期倒序，可整组翻页并打包成册子下发。
        </p>
      </div>
      <div class="page-actions">
        <button class="btn" :class="{ primary: activeTab === 'ledger' }" type="button" @click="switchTab('ledger')">阀门井台账</button>
        <button class="btn" :class="{ primary: activeTab === 'report' }" type="button" @click="switchTab('report')">检查报送单</button>
        <button class="btn" :class="{ primary: activeTab === 'booklet' }" type="button" @click="switchTab('booklet')">检查记录册</button>
      </div>
    </header>

    <!-- 阀门井台账：沿用既有登记、筛选与状态流转做法 -->
    <div v-if="activeTab === 'ledger'" class="tab-panel">
      <div class="stat-row">
        <article v-for="item in ledgerStats" :key="item.label" class="stat-card">
          <span class="stat-label">{{ item.label }}</span>
          <strong class="stat-value">{{ item.value }}</strong>
        </article>
      </div>

      <p class="status-legend">
        <span v-for="item in statusSummary" :key="item.status" class="legend-item">
          {{ item.status }}：{{ item.count }}
        </span>
      </p>

      <form class="filter-bar" @submit.prevent="reloadLedger">
        <label v-for="field in filterFields" :key="field" class="filter-item">
          <span>{{ field }}</span>
          <input v-model="filters[field]" :placeholder="`按${field}检索`" />
        </label>
        <button class="btn" type="submit">查询</button>
        <button class="btn ghost" type="button" @click="resetFilters">重置条件</button>
        <button class="btn ghost" type="button" @click="exportLedger">导出台账清单</button>
      </form>

      <table class="data-table">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column">{{ column }}</th>
            <th>当前状态</th>
            <th>可执行动作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="String(row.id)">
            <td v-for="column in columns" :key="column">{{ row[column] ?? '—' }}</td>
            <td>{{ row.status }}</td>
            <td class="row-actions">
              <button class="link" type="button" @click="goReport(row)">填检查单</button>
              <button
                v-for="action in actions"
                :key="action"
                class="link"
                type="button"
                @click="runAction(action, row)"
              >
                {{ action }}
              </button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td :colspan="columns.length + 2" class="empty-state">暂无阀门井台账数据</td>
          </tr>
        </tbody>
      </table>

      <footer class="page-foot">
        <span>共 {{ total }} 口阀门井</span>
        <span class="page-hint">台账中的检查信息与检查报送单、检查记录册同源于一份检查记录</span>
        <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
      </footer>
    </div>

    <!-- 检查报送单：检查日期缺失不予受理；重复报送按第一次为准；结果回写探漏待复核 -->
    <div v-else-if="activeTab === 'report'" class="tab-panel">
      <div class="report-layout">
        <form class="report-form" @submit.prevent="submitReport">
          <h3 class="form-title">填报阀门井检查记录</h3>
          <label class="form-item">
            <span>井编号 <em>*</em></span>
            <input v-model="form.wellCode" list="ledger-well-codes" placeholder="如 VALV-0001，可从台账井中选择" @change="prefillWell" />
            <datalist id="ledger-well-codes">
              <option v-for="well in ledgerWells" :key="String(well.id)" :value="String(well['井编号'])"></option>
            </datalist>
          </label>
          <label class="form-item">
            <span>所属管段</span>
            <input v-model="form.section" placeholder="如 DN300 一次网东段" />
          </label>
          <label class="form-item">
            <span>井盖状况 <em>*</em></span>
            <select v-model="form.coverStatus">
              <option v-for="option in coverOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="form-item">
            <span>阀门型号</span>
            <input v-model="form.valveModel" placeholder="如 Z41H-16C DN200" />
          </label>
          <label class="form-item">
            <span>检查人</span>
            <input v-model="form.inspector" placeholder="检查负责人姓名" />
          </label>
          <label class="form-item">
            <span>检查日期 <em>*</em></span>
            <input v-model="form.inspectDate" type="date" />
          </label>
          <label class="form-item">
            <span>养护措施</span>
            <select v-model="form.measure">
              <option v-for="option in measureOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="form-item">
            <span>井体状态</span>
            <select v-model="form.wellState">
              <option value="正常">正常</option>
              <option value="需观察">需观察</option>
              <option value="异常">异常</option>
            </select>
          </label>
          <label class="form-item form-item-wide">
            <span>检查情况</span>
            <textarea v-model="form.remark" rows="3" placeholder="井内积水、启闭、锈蚀等现场情况"></textarea>
          </label>
          <div class="form-actions">
            <button class="btn primary" type="submit">受理检查报送</button>
            <button class="btn ghost" type="button" @click="resetForm">清空重填</button>
          </div>
          <p v-if="reportMessage" :class="reportOk ? 'ok-text' : 'error-text'" class="form-message">{{ reportMessage }}</p>
          <p class="form-rules">
            受理规则：检查日期缺失的不予受理；同一口井同一天重复报送按第一次为准；受理后检查结果自动回写到管网探漏的待复核清单。
          </p>
        </form>

        <aside class="report-side">
          <h3 class="form-title">该井近期检查记录</h3>
          <p v-if="!form.wellCode.trim()" class="page-hint">输入或选择井编号后，这里显示同井历史报送，避免重复提交。</p>
          <table v-else class="data-table compact">
            <thead>
              <tr><th>检查日期</th><th>井盖状况</th><th>养护措施</th><th>检查人</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in wellHistory" :key="item.id">
                <td>{{ item.inspectDate }}</td>
                <td>{{ item.coverStatus }}</td>
                <td>{{ item.measure }}</td>
                <td>{{ item.inspector }}</td>
              </tr>
              <tr v-if="!wellHistory.length">
                <td colspan="4" class="empty-state">该井还没有检查记录</td>
              </tr>
            </tbody>
          </table>
        </aside>
      </div>
    </div>

    <!-- 检查记录册：井盖状况分栏、养护措施分组、日期倒序、整组翻页、目录与井编号跳转 -->
    <div v-else class="tab-panel">
      <div class="stat-row">
        <article v-for="item in bookletStats" :key="item.label" class="stat-card">
          <span class="stat-label">{{ item.label }}</span>
          <strong class="stat-value">{{ item.value }}</strong>
        </article>
      </div>

      <div class="booklet-toolbar">
        <form class="jump-box" @submit.prevent="jumpByWell">
          <label class="filter-item">
            <span>井编号直跳</span>
            <input v-model="jumpWellCode" list="ledger-well-codes" placeholder="输入井编号，跳到它所在组" />
          </label>
          <button class="btn primary" type="submit">跳到该组</button>
        </form>
        <label class="filter-item">
          <span>只看井盖状况</span>
          <select v-model="coverFilter" @change="reloadBooklet(1)">
            <option value="">全部栏</option>
            <option v-for="option in coverOptions" :key="option" :value="option">{{ option }}栏</option>
          </select>
        </label>
        <label class="check-item">
          <input v-model="onlyPending" type="checkbox" @change="reloadBooklet(1)" />
          只看未养护的组（{{ pendingWellCount }} 口井未养护）
        </label>
        <button class="btn" type="button" @click="exportBooklet">打包导出检查记录册</button>
      </div>

      <nav class="group-toc" aria-label="分组目录">
        <span class="toc-label">分组目录：</span>
        <button
          v-for="group in tocGroups"
          :key="group.key"
          class="toc-chip"
          :class="{ pending: !group.maintained, active: highlightKey === group.key }"
          type="button"
          @click="jumpToGroup(group.globalIndex)"
        >
          {{ group.coverStatus }} · {{ group.measure }}（{{ group.items.length }}）
        </button>
        <span v-if="!tocGroups.length" class="page-hint">当前筛选下没有分组</span>
      </nav>

      <div class="booklet-board">
        <div v-for="cover in coversOnPage" :key="cover" class="cover-column">
          <h3 class="cover-head">{{ cover }}栏</h3>
          <article
            v-for="group in groupsByCover(cover)"
            :id="`group-${group.key}`"
            :key="group.key"
            class="group-card"
            :class="{ pending: !group.maintained, highlighted: highlightKey === group.key }"
          >
            <header class="group-head">
              <strong>{{ group.measure }}</strong>
              <span>{{ group.items.length }} 条 · 检查日期倒序{{ group.maintained ? '' : ' · 未养护' }}</span>
            </header>
            <table class="data-table compact">
              <thead>
                <tr><th>井编号</th><th>所属管段</th><th>检查日期</th><th>检查人</th><th>井体状态</th><th>检查情况</th></tr>
              </thead>
              <tbody>
                <tr v-for="item in group.items" :key="item.id">
                  <td><button class="link" type="button" @click="jumpByWellCode(item.wellCode)">{{ item.wellCode }}</button></td>
                  <td>{{ item.section || '—' }}</td>
                  <td>{{ item.inspectDate }}</td>
                  <td>{{ item.inspector }}</td>
                  <td>{{ item.wellState }}</td>
                  <td>{{ item.remark || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>
        <p v-if="!pageData.groups.length" class="empty-state booklet-empty">当前筛选下没有检查记录</p>
      </div>

      <footer class="pager">
        <button class="btn" type="button" :disabled="pageData.page <= 1" @click="reloadBooklet(pageData.page - 1)">上一页</button>
        <span>第 {{ pageData.page }} / {{ pageData.totalPages }} 页 · 本页 {{ pageData.groups.length }} 组，全册 {{ pageData.totalGroups }} 组 {{ pageData.totalItems }} 条</span>
        <button class="btn" type="button" :disabled="pageData.page >= pageData.totalPages" @click="reloadBooklet(pageData.page + 1)">下一页</button>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import {
  downloadEntries,
  listEntries,
  moduleMeta,
  runAction as applyAction,
} from '@/api/local-service'
import {
  allGroupedInspections,
  downloadInspectionBooklet,
  groupedInspectionPage,
  listInspections,
  pageNumberOfWell,
  submitInspection,
  wellsWithoutMaintenance,
} from '@/api/valvewell-service'
import { COVER_OPTIONS, GROUPS_PER_PAGE, MEASURE_OPTIONS, PENDING_MEASURE } from '@/data/valvewell'
import type { EntryRow, GroupPage, InspectionGroup, ValveInspection } from '@/data/types'

const meta = moduleMeta('valvewell')
const columns = ['井编号', '所属管段', '井盖状况', '阀门型号', '检查人', '检查日期', '养护措施', '井体状态']
const actions = ['提交检查', '确认养护', '提出维修']
const statuses = ['待检查', '检查中', '已养护', '需维修']
const coverOptions = COVER_OPTIONS
const measureOptions = MEASURE_OPTIONS

const activeTab = ref<'ledger' | 'report' | 'booklet'>('booklet')

// ---------------- 台账 ----------------
const rows = ref<EntryRow[]>([])
const total = ref(0)
const errorMessage = ref('')
const filters = ref<Record<string, string>>({})
const filterFields = columns.slice(0, 3)
const ledgerWells = ref<EntryRow[]>([])

const statusSummary = computed(() =>
  statuses.map((status: string) => ({
    status,
    count: rows.value.filter((row) => String(row.status) === status).length,
  })),
)

const ledgerStats = computed(() => [
  { label: '待检查阀门井', value: rows.value.filter((row) => row.status === '待检查' || row.status === '检查中').length },
  { label: '已养护阀门井', value: rows.value.filter((row) => row.status === '已养护').length },
  { label: '需维修阀门井', value: rows.value.filter((row) => row.status === '需维修').length },
])

function resetFilters() {
  filters.value = {}
  reloadLedger()
}

function exportLedger() {
  downloadEntries(meta.key)
}

function runAction(action: string, row: EntryRow) {
  errorMessage.value = ''
  const result = applyAction(meta.key, Number(row.id), action)
  if (!result.ok) {
    errorMessage.value = result.message
    return
  }
  reloadAll()
}

function reloadLedger() {
  errorMessage.value = ''
  try {
    const payload = listEntries(meta.key, filters.value)
    rows.value = payload.items
    total.value = payload.total
    ledgerWells.value = listEntries(meta.key).items
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '阀门井台账读取失败'
  }
}

// ---------------- 检查报送 ----------------
function emptyForm() {
  return {
    wellCode: '',
    section: '',
    coverStatus: '完好',
    valveModel: '',
    inspector: '',
    inspectDate: '',
    measure: PENDING_MEASURE,
    wellState: '正常',
    remark: '',
  }
}
const form = reactive(emptyForm())
const reportMessage = ref('')
const reportOk = ref(false)
const inspections = ref<ValveInspection[]>([])

const wellHistory = computed(() =>
  inspections.value
    .filter((item) => item.wellCode === form.wellCode.trim())
    .slice(0, 6),
)

function resetForm() {
  Object.assign(form, emptyForm())
  reportMessage.value = ''
}

// 从台账选了井，就把管段、井盖、型号带过来，兼容既有台账登记做法。
function prefillWell() {
  const well = ledgerWells.value.find((row) => String(row['井编号']) === form.wellCode.trim())
  if (!well) {
    return
  }
  form.section = String(well['所属管段'] ?? '')
  form.coverStatus = String(well['井盖状况'] ?? '完好')
  form.valveModel = String(well['阀门型号'] ?? '')
}

function goReport(row: EntryRow) {
  activeTab.value = 'report'
  form.wellCode = String(row['井编号'])
  prefillWell()
  reportMessage.value = ''
}

function submitReport() {
  reportMessage.value = ''
  const result = submitInspection({ ...form })
  reportOk.value = result.ok
  reportMessage.value = result.message
  if (!result.ok) {
    return
  }
  const code = form.wellCode.trim()
  resetForm()
  reloadAll()
  // 受理成功直接翻到新记录所在的组，班组能立刻看到入册结果。
  activeTab.value = 'booklet'
  resetBookletFilters()
  reloadBooklet()
  focusWell(code)
}

// ---------------- 检查记录册 ----------------
const pageData = ref<GroupPage>({ page: 1, totalPages: 1, totalGroups: 0, totalItems: 0, groups: [] })
const tocGroups = ref<InspectionGroup[]>([])
const coverFilter = ref('')
const onlyPending = ref(false)
const jumpWellCode = ref('')
const highlightKey = ref('')
const pendingWellCount = ref(0)

const coversOnPage = computed(() =>
  [...new Set(pageData.value.groups.map((group) => group.coverStatus))],
)

const bookletStats = computed(() => [
  { label: '在册检查记录', value: inspections.value.length },
  { label: '井盖状况栏数', value: new Set(inspections.value.map((item) => item.coverStatus)).size },
  { label: '分组数', value: tocGroups.value.length || new Set(inspections.value.map((item) => `${item.coverStatus}／${item.measure}`)).size },
  { label: '尚未养护的井', value: pendingWellCount.value },
])

function groupsByCover(cover: string): InspectionGroup[] {
  return pageData.value.groups.filter((group) => group.coverStatus === cover)
}

function currentFilter() {
  return { coverStatus: coverFilter.value || undefined, onlyPending: onlyPending.value }
}

function resetBookletFilters() {
  coverFilter.value = ''
  onlyPending.value = false
}

function reloadBooklet(page = 1) {
  const data = groupedInspectionPage(currentFilter(), page)
  pageData.value = data
  tocGroups.value = allGroupedInspections(currentFilter())
  pendingWellCount.value = wellsWithoutMaintenance().length
}

function flashGroup(key: string) {
  highlightKey.value = key
  setTimeout(() => {
    if (highlightKey.value === key) {
      highlightKey.value = ''
    }
  }, 2400)
}

function scrollToGroup(key: string) {
  const el = document.getElementById(`group-${key}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// 目录跳转：目录与翻页用同一套分组序号，落页后高亮目标组。
function jumpToGroup(globalIndex: number) {
  const targetPage = Math.floor(globalIndex / GROUPS_PER_PAGE) + 1
  const target = tocGroups.value.find((group) => group.globalIndex === globalIndex)
  reloadBooklet(targetPage)
  if (target) {
    flashGroup(target.key)
    setTimeout(() => scrollToGroup(target.key), 60)
  }
}

function focusWell(code: string) {
  // 井编号按全册定位，避免当前筛选把目标组过滤掉。
  const located = pageNumberOfWell(code, {})
  if (!located) {
    return
  }
  reloadBooklet(located.page)
  flashGroup(located.groupKey)
  setTimeout(() => scrollToGroup(located.groupKey), 60)
}

function jumpByWell() {
  const code = jumpWellCode.value.trim()
  if (!code) {
    return
  }
  resetBookletFilters()
  focusWell(code)
}

function jumpByWellCode(code: string) {
  jumpWellCode.value = code
  resetBookletFilters()
  focusWell(code)
}

function exportBooklet() {
  downloadInspectionBooklet(currentFilter())
}

// ---------------- 公共 ----------------
function switchTab(tab: 'ledger' | 'report' | 'booklet') {
  activeTab.value = tab
  if (tab === 'ledger') {
    reloadLedger()
  } else if (tab === 'booklet') {
    reloadBooklet(pageData.value.page)
  }
}

function reloadAll() {
  inspections.value = listInspections()
  reloadLedger()
  reloadBooklet(pageData.value.page)
}

onMounted(reloadAll)
</script>
