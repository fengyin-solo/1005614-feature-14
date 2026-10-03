<template>
  <section class="page" data-module="valvewell-inspection">
    <header class="page-head">
      <div>
        <h2>阀门井检查单</h2>
        <p class="page-desc">
          检查记录按井盖状况分栏，栏内按养护措施聚成一组，组内检查日期倒序；跨页翻页整组不拆散。
          台账与检查单取同一份数据。
        </p>
      </div>
      <div class="page-actions">
        <button class="btn primary" type="button" @click="showForm = !showForm">
          {{ showForm ? '收起检查报送' : '填报检查报送' }}
        </button>
        <button class="btn" type="button" @click="exportBooklet">打包检查记录册并下载</button>
      </div>
    </header>

    <nav class="sub-tabs">
      <RouterLink class="sub-tab" to="/valvewell" active-class="is-active">阀门井台账</RouterLink>
      <RouterLink class="sub-tab" to="/valvewell/inspection" exact-active-class="is-active">阀门井检查单（分栏分组）</RouterLink>
    </nav>

    <div class="stat-row">
      <article v-for="item in stats" :key="item.label" class="stat-card">
        <span class="stat-label">{{ item.label }}</span>
        <strong class="stat-value">{{ item.value }}</strong>
      </article>
    </div>

    <!-- 检查报送：检查日期缺失不予受理；同井同日重复报送按第一次认；受理后回写探漏待复核清单。 -->
    <form v-if="showForm" class="entry-form" @submit.prevent="submitForm">
      <h3 class="form-title">阀门井检查报送</h3>
      <div class="form-grid">
        <label class="form-item">
          <span>井编号 *</span>
          <input v-model="form.井编号" list="well-code-options" placeholder="如 VALV-1001" />
          <datalist id="well-code-options">
            <option v-for="code in wellCodeOptions" :key="code" :value="code" />
          </datalist>
        </label>
        <label class="form-item">
          <span>所属管段</span>
          <input v-model="form.所属管段" placeholder="如 SECO-0102" />
        </label>
        <label class="form-item">
          <span>井盖状况 *</span>
          <select v-model="form.井盖状况">
            <option value="" disabled>请选择</option>
            <option v-for="cover in coverChoices" :key="cover" :value="cover">{{ cover }}</option>
          </select>
        </label>
        <label class="form-item">
          <span>阀门型号</span>
          <input v-model="form.阀门型号" placeholder="如 DN100闸阀" />
        </label>
        <label class="form-item">
          <span>检查人</span>
          <input v-model="form.检查人" placeholder="检查人姓名" />
        </label>
        <label class="form-item">
          <span>检查日期 *</span>
          <input v-model="form.检查日期" type="date" />
        </label>
        <label class="form-item">
          <span>养护措施</span>
          <select v-model="form.养护措施">
            <option value="">请选择（可留空）</option>
            <option v-for="measure in measureChoices" :key="measure" :value="measure">{{ measure }}</option>
          </select>
        </label>
        <label class="form-item form-item-wide">
          <span>井体状态</span>
          <input v-model="form.井体状态" placeholder="如 井内干燥无积水" />
        </label>
      </div>
      <div class="form-actions">
        <button class="btn primary" type="submit">提交检查报送</button>
        <button class="btn ghost" type="button" @click="resetForm">清空表单</button>
        <span v-if="submitMessage" :class="submitOk ? 'ok-text' : 'error-text'">{{ submitMessage }}</span>
      </div>
    </form>

    <form class="filter-bar" @submit.prevent="applyKeyword">
      <label class="filter-item">
        <span>井编号检索</span>
        <input v-model="keyword" placeholder="输入井编号筛选分组" />
      </label>
      <label class="filter-item">
        <span>井盖状况</span>
        <input v-model="coverKeyword" placeholder="按井盖状况检索" />
      </label>
      <label class="filter-item">
        <span>养护措施</span>
        <input v-model="measureKeyword" placeholder="按养护措施检索" />
      </label>
      <button class="btn" type="submit">查询</button>
      <button class="btn ghost" type="button" @click="resetKeyword">重置条件</button>
      <span class="legend-item legend-toggle">
        <label>
          <input v-model="onlyUnmaintained" type="checkbox" @change="rebuild" />
          只看尚未养护的井
        </label>
      </span>
    </form>

    <!-- 组导航：列表里可直接跳到某一组（先翻到所在页，再定位高亮）。 -->
    <div class="group-nav">
      <span class="group-nav-label">跳到分组：</span>
      <button
        v-for="group in allGroups"
        :key="group.key"
        class="chip"
        type="button"
        :class="{ 'is-current': currentGroupKey === group.key }"
        @click="jumpToGroup(group.key)"
      >
        {{ group.cover }} · {{ group.measure }} · {{ group.rows.length }}
      </button>
    </div>

    <!-- 井编号直接跳到对应那组。 -->
    <div class="jump-bar">
      <label class="filter-item">
        <span>井编号跳组</span>
        <select v-model="jumpWell" @change="jumpByWell">
          <option value="">选择井编号…</option>
          <option v-for="code in visibleWellCodes" :key="code" :value="code">{{ code }}</option>
        </select>
      </label>
      <span v-if="jumpMessage" class="jump-message">{{ jumpMessage }}</span>
    </div>

    <div ref="boardRef" class="board-grid">
      <article v-for="column in currentPage.columns" :key="column.cover" class="board-column">
        <header class="column-head">
          <h3>{{ column.cover }}</h3>
          <span>{{ columnTotal(column) }} 条 / {{ column.groups.length }} 组</span>
        </header>
        <div
          v-for="group in column.groups"
          :id="groupDomId(group.key)"
          :key="group.key"
          class="group-card"
          :class="{ 'is-flash': flashGroupKey === group.key }"
        >
          <header class="group-head">
            <strong>{{ group.measure }}</strong>
            <span>{{ group.rows.length }} 条 · 井号 {{ group.wellCodes.join('、') }}</span>
          </header>
          <table class="group-table">
            <thead>
              <tr>
                <th v-for="columnName in tableColumns" :key="columnName">{{ columnName }}</th>
                <th>状态</th>
                <th>检查动作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in group.rows" :key="String(row.id)">
                <td v-for="columnName in tableColumns" :key="columnName">
                  {{ row[columnName] === '' || row[columnName] == null ? '—' : row[columnName] }}
                </td>
                <td>{{ row.status }}</td>
                <td class="row-actions">
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
            </tbody>
          </table>
        </div>
      </article>

      <p v-if="!currentPage || currentPage.columns.length === 0" class="empty-state board-empty">
        当前条件下没有可分组的阀门井检查记录
      </p>
    </div>

    <footer class="pager">
      <div class="pager-info">
        <span>共 {{ allRows.length }} 条记录 · {{ allGroups.length }} 个分组</span>
        <span>第 {{ pages.length === 0 ? 0 : pageIndex + 1 }} / {{ pages.length }} 页（整组翻页，分组不跨页）</span>
      </div>
      <div class="pager-actions">
        <button class="btn" type="button" :disabled="pageIndex === 0" @click="goPage(pageIndex - 1)">上一页</button>
        <button
          v-for="pageNo in pages.length"
          :key="pageNo"
          class="btn"
          type="button"
          :class="{ primary: pageNo - 1 === pageIndex }"
          @click="goPage(pageNo - 1)"
        >
          {{ pageNo }}
        </button>
        <button class="btn" type="button" :disabled="pageIndex >= pages.length - 1" @click="goPage(pageIndex + 1)">下一页</button>
      </div>
      <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import {
  downloadFile,
  listEntries,
  moduleMeta,
  runAction as applyAction,
  submitValveInspection,
} from '@/api/local-service'
import {
  allWellCodes,
  buildInspectionBooklet,
  buildInspectionColumns,
  COVER_ORDER,
  flattenGroups,
  groupDomId,
  isInspected,
  latestRowByWell,
  locateWell,
  MEASURE_ORDER,
  paginateGroups,
  unmaintainedWellCodes,
  type ValveColumn,
  type ValveGroup,
} from '@/api/valve-grouping'
import type { EntryRow, ValveInspectionInput } from '@/data/types'

const meta = moduleMeta('valvewell')
const PAGE_SIZE = 8
const tableColumns = ['井编号', '所属管段', '阀门型号', '检查人', '检查日期', '养护措施', '井体状态']
const actions = ['提交检查', '确认养护', '提出维修']
const coverChoices = COVER_ORDER
const measureChoices = MEASURE_ORDER

const allRows = ref<EntryRow[]>([])
const pageIndex = ref(0)
const pages = ref<ReturnType<typeof paginateGroups>>([])
const allGroups = ref<ValveGroup[]>([])
const visibleWellCodes = ref<string[]>([])
const wellCodeOptions = ref<string[]>([])

const keyword = ref('')
const coverKeyword = ref('')
const measureKeyword = ref('')
const onlyUnmaintained = ref(false)
const jumpWell = ref('')
const jumpMessage = ref('')
const currentGroupKey = ref('')
const flashGroupKey = ref('')
const errorMessage = ref('')

const showForm = ref(false)
const submitMessage = ref('')
const submitOk = ref(false)
const emptyForm: ValveInspectionInput = {
  井编号: '',
  所属管段: '',
  井盖状况: '',
  阀门型号: '',
  检查人: '',
  检查日期: '',
  养护措施: '',
  井体状态: '',
}
const form = ref<ValveInspectionInput>({ ...emptyForm })

const EMPTY_PAGE: NonNullable<ReturnType<typeof paginateGroups>[number]> = {
  index: 0,
  totalRows: 0,
  columns: [],
  groupKeys: [],
}
const currentPage = computed(() => pages.value[pageIndex.value] ?? EMPTY_PAGE)

const stats = computed(() => {
  const rows = allRows.value
  return [
    { label: '在册阀门井（按井号）', value: latestRowByWell(rows).size },
    { label: '已受理检查记录', value: rows.filter(isInspected).length },
    { label: '尚未养护的井', value: unmaintainedWellCodes(rows).size },
  ]
})

function columnTotal(column: ValveColumn): number {
  return column.groups.reduce((sum, group) => sum + group.rows.length, 0)
}

function rebuild() {
  errorMessage.value = ''
  jumpMessage.value = ''
  let rows = listEntries(meta.key).items

  if (onlyUnmaintained.value) {
    const unmaintained = unmaintainedWellCodes(rows)
    rows = rows.filter((row) => unmaintained.has(String(row.井编号)))
  }

  const code = keyword.value.trim()
  const cover = coverKeyword.value.trim()
  const measure = measureKeyword.value.trim()
  if (code) {
    rows = rows.filter((row) => String(row.井编号 ?? '').includes(code))
  }
  if (cover) {
    rows = rows.filter((row) => String(row.井盖状况 ?? '').includes(cover))
  }
  if (measure) {
    rows = rows.filter((row) => String(row.养护措施 ?? '').includes(measure))
  }

  allRows.value = rows
  const columns = buildInspectionColumns(rows)
  allGroups.value = flattenGroups(columns)
  pages.value = paginateGroups(columns, PAGE_SIZE)
  visibleWellCodes.value = allWellCodes(rows)
  if (pageIndex.value > pages.value.length - 1) {
    pageIndex.value = 0
  }
}

function applyKeyword() {
  pageIndex.value = 0
  rebuild()
}

function resetKeyword() {
  keyword.value = ''
  coverKeyword.value = ''
  measureKeyword.value = ''
  onlyUnmaintained.value = false
  pageIndex.value = 0
  rebuild()
}

function goPage(index: number) {
  if (index < 0 || index >= pages.value.length) {
    return
  }
  pageIndex.value = index
}

function flashGroup(key: string) {
  currentGroupKey.value = key
  flashGroupKey.value = key
  window.setTimeout(() => {
    if (flashGroupKey.value === key) {
      flashGroupKey.value = ''
    }
  }, 1600)
}

function scrollToGroup(key: string) {
  nextTick(() => {
    const el = document.getElementById(groupDomId(key))
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

function jumpToGroup(key: string) {
  const located = pages.value.findIndex((page) => page.groupKeys.includes(key))
  if (located < 0) {
    return
  }
  pageIndex.value = located
  flashGroup(key)
  scrollToGroup(key)
}

function jumpByWell() {
  const code = jumpWell.value
  if (!code) {
    return
  }
  const located = locateWell(allGroups.value, pages.value, code)
  if (!located) {
    jumpMessage.value = `当前分组里没有井编号含「${code}」的记录`
    return
  }
  pageIndex.value = located.page
  jumpMessage.value = `井 ${code} 已定位到对应分组`
  flashGroup(located.groupKey)
  scrollToGroup(located.groupKey)
}

function runAction(action: string, row: EntryRow) {
  errorMessage.value = ''
  const result = applyAction(meta.key, Number(row.id), action)
  if (!result.ok) {
    errorMessage.value = result.message
    return
  }
  reload()
}

function resetForm() {
  form.value = { ...emptyForm }
  submitMessage.value = ''
}

function submitForm() {
  submitMessage.value = ''
  const result = submitValveInspection(form.value)
  submitOk.value = result.ok
  submitMessage.value = result.message
  if (!result.ok) {
    return
  }
  const acceptedCode = form.value.井编号.trim()
  resetForm()
  // 受理后回到完整分组，让新报送的记录（含回写提示）直接出现在对应栏、组里。
  resetKeyword()
  wellCodeOptions.value = allWellCodes(listEntries(meta.key).items)
  showForm.value = false
  if (acceptedCode) {
    const located = locateWell(allGroups.value, pages.value, acceptedCode)
    if (located) {
      pageIndex.value = located.page
      flashGroup(located.groupKey)
      scrollToGroup(located.groupKey)
    }
  }
}

function exportBooklet() {
  const stamp = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const generatedAt = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`
  // 册子按当前筛选结果打包：导出后直接下载，班组打印即可带走下发。
  const html = buildInspectionBooklet(allRows.value, generatedAt)
  downloadFile(`阀门井检查记录分组册-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}.html`, html, 'text/html;charset=utf-8')
}

function reload() {
  rebuild()
}

onMounted(() => {
  wellCodeOptions.value = allWellCodes(listEntries(meta.key).items)
  rebuild()
})
</script>
