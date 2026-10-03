import { SEED_ROWS } from './seed'
import type { EntryRow } from './types'

// 本地持久化：数据放在 localStorage 里，刷新、关掉再打开都还在。
const STORAGE_KEY = 'district-heating:entries'

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

// 阀门井检查记录、探漏待复核等独立集合各自占一个 localStorage 键，
// 与既有「按模块分桶」的 entries 数据互不影响，刷新后仍在。
const collectionCache = new Map<string, unknown[]>()

export function readCollection<T>(key: string, seed: T[]): T[] {
  const cached = collectionCache.get(key) as T[] | undefined
  if (cached) {
    return cached
  }
  let next: T[] = clone(seed)
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(key)
    if (raw) {
      try {
        next = JSON.parse(raw) as T[]
      } catch {
        next = clone(seed)
      }
    } else {
      window.localStorage.setItem(key, JSON.stringify(next))
    }
  }
  collectionCache.set(key, next)
  return next
}

export function writeCollection<T>(key: string, rows: T[]): void {
  collectionCache.set(key, rows)
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, JSON.stringify(rows))
  }
}
