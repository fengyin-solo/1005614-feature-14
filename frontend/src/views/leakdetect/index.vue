<template>
  <section class="page" data-module="leakdetect">
    <header class="page-head">
      <div>
        <h2>管网探漏管理</h2>
        <p class="page-desc">维护探漏记录，围绕探漏编号、探测管段、探测方法、漏点数量做登记、筛选与状态流转。</p>
      </div>
      <div class="page-actions">
        <button class="btn primary" type="button" @click="openCreate">登记探漏记录</button>
        <button class="btn" type="button" @click="exportRows">导出管网探漏清单</button>
      </div>
    </header>

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
          <td v-for="column in columns" :key="column">{{ row[column] ?? '—' }}</td>
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
          <td :colspan="columns.length + 2" class="empty-state">暂无管网探漏数据，可先登记探漏记录</td>
        </tr>
      </tbody>
    </table>

    <section class="review-block">
      <header class="review-head">
        <div>
          <h3>阀门井检查结果待复核清单</h3>
          <p class="page-desc">阀门井检查报送受理后，检查结果自动回写到这里，待复核 {{ pendingReviews.length }} 条。</p>
        </div>
        <button class="btn" type="button" @click="reloadReviews">刷新清单</button>
      </header>
      <table class="data-table">
        <thead>
          <tr>
            <th>井编号</th>
            <th>所属管段</th>
            <th>检查日期</th>
            <th>养护措施</th>
            <th>检查结果</th>
            <th>复核状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in reviewRows" :key="item.id">
            <td>{{ item.wellCode }}</td>
            <td>{{ item.section || '—' }}</td>
            <td>{{ item.inspectDate }}</td>
            <td>{{ item.measure }}</td>
            <td>{{ item.result }}</td>
            <td>{{ item.status }}</td>
            <td class="row-actions">
              <button
                v-if="item.status === '待复核'"
                class="link"
                type="button"
                @click="resolveReview(item.id)"
              >
                确认复核
              </button>
              <span v-else class="page-hint">已闭环</span>
            </td>
          </tr>
          <tr v-if="!reviewRows.length">
            <td colspan="7" class="empty-state">暂无回写过来的阀门井检查结果</td>
          </tr>
        </tbody>
      </table>
    </section>

    <footer class="page-foot">
      <span>共 {{ total }} 条管网探漏记录</span>
      <span v-if="reviewMessage" class="ok-text">{{ reviewMessage }}</span>
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
import { confirmLeakReview, listLeakReviews } from '@/api/valvewell-service'
import type { EntryRow, LeakReviewItem } from '@/data/types'

const meta = moduleMeta('leakdetect')
const columns = ["探漏编号", "探测管段", "探测方法", "漏点数量", "漏点位置", "处理建议", "探测日期", "探漏状态"]
const actions = ["提交探测", "确认处理", "要求复探"]
const statuses = ["待探测", "探测中", "已处理", "需复探"]
const stats = [{"label": "待探测管段", "value": 0}, {"label": "探测中管段", "value": 0}, {"label": "本月漏点数", "value": 0}]

const rows = ref<EntryRow[]>([])
const total = ref(0)
const errorMessage = ref('')
const filters = ref<Record<string, string>>({})
const filterFields = columns.slice(0, 3)
const statusSummary = computed(() =>
  statuses.map((status: string) => ({
    status,
    count: rows.value.filter((row) => String(row.status) === status).length,
  })),
)

function resetFilters() {
  filters.value = {}
  reload()
}

function exportRows() {
  downloadEntries(meta.key)
}

function openCreate() {
  errorMessage.value = '探漏记录登记入口尚未接入审批流'
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
    const payload = listEntries(meta.key, filters.value)
    rows.value = payload.items
    total.value = payload.total
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '管网探漏列表读取失败'
  }
}

const reviewRows = ref<LeakReviewItem[]>([])
const reviewMessage = ref('')
const pendingReviews = computed(() => reviewRows.value.filter((item) => item.status === '待复核'))

function reloadReviews() {
  reviewRows.value = listLeakReviews()
}

function resolveReview(id: number) {
  const result = confirmLeakReview(id)
  reviewMessage.value = result.message
  if (result.ok) {
    reloadReviews()
  }
}

onMounted(() => {
  reload()
  reloadReviews()
})
</script>
