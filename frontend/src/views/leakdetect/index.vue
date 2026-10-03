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

    <!-- 阀门井检查结果回写过来的待复核清单：确认后登记一条「需复探」，排除则只标记不建单。 -->
    <section class="review-panel">
      <header class="review-head">
        <h3>阀门井检查回写 · 待复核清单</h3>
        <div class="review-filters">
          <button
            v-for="option in reviewStateOptions"
            :key="option"
            class="btn"
            type="button"
            :class="{ primary: reviewState === option }"
            @click="setReviewState(option)"
          >
            {{ option }}
          </button>
          <span class="review-count">共 {{ reviews.length }} 条</span>
        </div>
      </header>
      <table class="data-table">
        <thead>
          <tr>
            <th>复核单号</th>
            <th>井编号</th>
            <th>所属管段</th>
            <th>井盖状况</th>
            <th>养护措施</th>
            <th>检查日期</th>
            <th>检查人</th>
            <th>复核内容</th>
            <th>状态</th>
            <th>回写时间</th>
            <th>复核操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in reviews" :key="item.id">
            <td>{{ item.id }}</td>
            <td>{{ item.井编号 }}</td>
            <td>{{ item.所属管段 || '—' }}</td>
            <td>{{ item.井盖状况 || '—' }}</td>
            <td>{{ item.养护措施 || '—' }}</td>
            <td>{{ item.检查日期 || '—' }}</td>
            <td>{{ item.检查人 || '—' }}</td>
            <td class="review-note">{{ item.备注 }}</td>
            <td>
              <span class="review-state" :class="`state-${item.state}`">{{ item.state }}</span>
            </td>
            <td>{{ item.createdAt }}</td>
            <td class="row-actions">
              <button
                v-if="item.state === '待复核'"
                class="link"
                type="button"
                @click="resolveReview(item.id, '确认')"
              >
                确认并登记复探
              </button>
              <button
                v-if="item.state === '待复核'"
                class="link link-danger"
                type="button"
                @click="resolveReview(item.id, '排除')"
              >
                排除
              </button>
              <span v-else class="muted-text">已处理</span>
            </td>
          </tr>
          <tr v-if="!reviews.length">
            <td :colspan="11" class="empty-state">当前没有{{ reviewState === '全部' ? '' : reviewState }}的复核单</td>
          </tr>
        </tbody>
      </table>
    </section>

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

    <footer class="page-foot">
      <span>共 {{ total }} 条管网探漏记录</span>
      <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  downloadEntries,
  listEntries,
  listLeakReviews,
  moduleMeta,
  resolveLeakReview,
  runAction as applyAction,
} from '@/api/local-service'
import type { EntryRow, LeakReviewItem } from '@/data/types'

const meta = moduleMeta('leakdetect')
const columns = ["探漏编号", "探测管段", "探测方法", "漏点数量", "漏点位置", "处理建议", "探测日期", "探漏状态"]
const actions = ["提交探测", "确认处理", "要求复探"]
const statuses = ["待探测", "探测中", "已处理", "需复探"]
const reviewStateOptions = ['待复核', '已确认', '已排除', '全部'] as const

const rows = ref<EntryRow[]>([])
const total = ref(0)
const errorMessage = ref('')
const filters = ref<Record<string, string>>({})
const filterFields = columns.slice(0, 3)

const reviews = ref<LeakReviewItem[]>([])
const reviewState = ref<(typeof reviewStateOptions)[number]>('待复核')

const stats = computed(() => {
  const pending = listLeakReviews('待复核').length
  const recheck = rows.value.filter((row) => String(row.status) === '需复探').length
  return [
    { label: '阀门井回写待复核', value: pending },
    { label: '需复探管段', value: recheck },
    { label: '探漏台账总量', value: total.value },
  ]
})

const statusSummary = computed(() =>
  statuses.map((status: string) => ({
    status,
    count: rows.value.filter((row) => String(row.status) === status).length,
  })),
)

function setReviewState(state: (typeof reviewStateOptions)[number]) {
  reviewState.value = state
  loadReviews()
}

function loadReviews() {
  reviews.value = listLeakReviews(reviewState.value)
}

function resolveReview(reviewId: string, resolution: '确认' | '排除') {
  errorMessage.value = ''
  const result = resolveLeakReview(reviewId, resolution)
  if (!result.ok) {
    errorMessage.value = result.message
  }
  loadReviews()
  reload()
}

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

onMounted(() => {
  reload()
  loadReviews()
})
</script>
