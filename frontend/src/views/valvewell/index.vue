<template>
  <section class="page" data-module="valvewell">
    <header class="page-head">
      <div>
        <h2>阀门井维护管理</h2>
        <p class="page-desc">阀门井台账：围绕井编号、所属管段、井盖状况、阀门型号做登记、筛选与状态流转，与检查单共用同一份记录。</p>
      </div>
      <div class="page-actions">
        <RouterLink class="btn ghost" to="/valvewell/inspection">去检查单分组报送</RouterLink>
        <button class="btn primary" type="button" @click="openCreate">登记阀门井</button>
        <button class="btn" type="button" @click="exportRows">导出阀门井维护清单</button>
      </div>
    </header>

    <nav class="sub-tabs">
      <RouterLink class="sub-tab" to="/valvewell" exact-active-class="is-active">阀门井台账</RouterLink>
      <RouterLink class="sub-tab" to="/valvewell/inspection" active-class="is-active">阀门井检查单（分栏分组）</RouterLink>
    </nav>

    <div class="stat-row">
      <article v-for="item in stats" :key="item.label" class="stat-card">
        <span class="stat-label">{{ item.label }}</span>
        <strong class="stat-value">{{ item.value }}</strong>
      </article>
    </div>

    <p class="status-legend">
      <span v-for="item in statusSummary" :key="item.status" class="legend-item">
        {{ item.status }}：{{ item.count }}
      </span>
      <span class="legend-item legend-toggle">
        <label>
          <input v-model="onlyUnmaintained" type="checkbox" @change="reload" />
          只看尚未养护的井
        </label>
      </span>
    </p>

    <form class="filter-bar" @submit.prevent="reload">
      <label v-for="field in filterFields" :key="field" class="filter-item">
        <span>{{ field }}</span>
        <input v-model="filters[field]" :placeholder="`按${field}检索`" />
      </label>
      <button class="btn" type="submit">查询</button>
      <button class="btn ghost" type="button" @click="resetFilters">重置条件</button>
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
          <td v-for="column in columns" :key="column">{{ row[column] === '' || row[column] == null ? '—' : row[column] }}</td>
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
        <tr v-if="!rows.length">
          <td :colspan="columns.length + 2" class="empty-state">
            {{ onlyUnmaintained ? '没有尚未养护的阀门井，都已经养护到位' : '暂无阀门井维护数据，可先登记阀门井' }}
          </td>
        </tr>
      </tbody>
    </table>

    <footer class="page-foot">
      <span>共 {{ total }} 条阀门井记录</span>
      <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  downloadEntries,
  listEntries,
  moduleMeta,
  runAction as applyAction,
} from '@/api/local-service'
import { latestRowByWell, unmaintainedWellCodes } from '@/api/valve-grouping'
import type { EntryRow } from '@/data/types'

const meta = moduleMeta('valvewell')
const columns = ["井编号", "所属管段", "井盖状况", "阀门型号", "检查人", "检查日期", "养护措施", "井体状态"]
const actions = ["提交检查", "确认养护", "提出维修"]
const statuses = ["待检查", "检查中", "已养护", "需维修"]

const rows = ref<EntryRow[]>([])
const total = ref(0)
const errorMessage = ref('')
const filters = ref<Record<string, string>>({})
const filterFields = columns.slice(0, 3)
const onlyUnmaintained = ref(false)

const stats = computed(() => {
  const all = listEntries(meta.key).items
  return [
    { label: '在册阀门井（按井号）', value: latestRowByWell(all).size },
    { label: '尚未养护的井', value: unmaintainedWellCodes(all).size },
    { label: '检查记录累计条数', value: all.length },
  ]
})

const statusSummary = computed(() =>
  statuses.map((status: string) => ({
    status,
    count: rows.value.filter((row) => String(row.status) === status).length,
  })),
)

function resetFilters() {
  filters.value = {}
  onlyUnmaintained.value = false
  reload()
}

function exportRows() {
  downloadEntries(meta.key)
}

function openCreate() {
  errorMessage.value = '阀门井登记入口尚未接入审批流'
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

function reload() {
  errorMessage.value = ''
  try {
    let payloadRows = listEntries(meta.key, filters.value).items
    if (onlyUnmaintained.value) {
      // 直接挑出还没养护的井：展示这些井的全部检查记录，不用一页页翻。
      const unmaintained = unmaintainedWellCodes(payloadRows)
      payloadRows = payloadRows.filter((row) => unmaintained.has(String(row.井编号)))
    }
    rows.value = payloadRows
    total.value = payloadRows.length
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '阀门井维护列表读取失败'
  }
}

onMounted(reload)
</script>
