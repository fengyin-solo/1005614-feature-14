import { SEED_LEAK_REVIEWS, SEED_ROWS } from './seed'
import type { EntryRow, LeakReviewItem } from './types'

// 本地持久化：数据放在 localStorage 里，刷新、关掉再打开都还在。
const STORAGE_KEY = 'district-heating:entries'
// 阀门井检查结果回写到探漏待复核清单，单独存一桶，避免混进各模块台账。
const REVIEW_STORAGE_KEY = 'district-heating:leak-reviews'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function readStorage(): Record<string, EntryRow[]> {
  const fallback = clone(SEED_ROWS)
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback))
    return fallback
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, EntryRow[]>
    return { ...fallback, ...parsed }
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback))
    return fallback
  }
}

let cache: Record<string, EntryRow[]> | null = null

export function allRows(): Record<string, EntryRow[]> {
  if (cache === null) {
    cache = readStorage()
  }
  return cache
}

export function listRows(key: string): EntryRow[] {
  return allRows()[key] ?? []
}

export function saveRows(key: string, rows: EntryRow[]): void {
  const next = { ...allRows(), [key]: rows }
  cache = next
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
}

export function resetRows(key: string): EntryRow[] {
  const rows = clone(SEED_ROWS[key] ?? [])
  saveRows(key, rows)
  return rows
}

export function storageKey(): string {
  return STORAGE_KEY
}

function readReviewStorage(): LeakReviewItem[] {
  const fallback = clone(SEED_LEAK_REVIEWS)
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback
  }
  const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY)
  if (!raw) {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(fallback))
    return fallback
  }
  try {
    return JSON.parse(raw) as LeakReviewItem[]
  } catch {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(fallback))
    return fallback
  }
}

let reviewCache: LeakReviewItem[] | null = null

export function listReviews(): LeakReviewItem[] {
  if (reviewCache === null) {
    reviewCache = readReviewStorage()
  }
  return reviewCache
}

export function saveReviews(items: LeakReviewItem[]): void {
  reviewCache = items
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(items))
  }
}
