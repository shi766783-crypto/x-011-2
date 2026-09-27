// 打卡日历相关的纯函数工具：月份网格、月份切换、时长色阶
import { addDays, monthOf, parseDateKey, today } from '@/utils/date'

/** 日历格子（视图模型） */
export interface CalendarCell {
  /** YYYY-MM-DD */
  date: string
  /** 日（1-31） */
  day: number
  /** 是否属于当前展示月份（false 为相邻月补齐的格子） */
  inMonth: boolean
  isToday: boolean
}

/** 月份键 YYYY-MM 加减 n 个月（正确处理跨年，如 2026-12 +1 → 2027-01） */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 月份展示标签，如 "2026年9月" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}年${m}月`
}

/**
 * 生成某月的日历格子：周一开头，固定 6 行 × 7 列 = 42 格。
 * 月初月末不足的部分用相邻月份的日期补齐，保证切换月份时首尾衔接、
 * 跨月相邻的两天在网格中仍然相邻。
 */
export function buildMonthCells(month: string): CalendarCell[] {
  const firstKey = `${month}-01`
  // getDay() 0=周日..6=周六 → 转换为周一开头的列偏移
  const offset = (parseDateKey(firstKey).getDay() + 6) % 7
  const start = addDays(firstKey, -offset)
  const todayKey = today()
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i)
    return {
      date,
      day: Number(date.slice(8)),
      inMonth: monthOf(date) === month,
      isToday: date === todayKey,
    }
  })
}

/** 时长（小时）→ 颜色深浅档位：0 无记录，1-4 由浅到深 */
export function durationLevel(duration: number): 0 | 1 | 2 | 3 | 4 {
  if (duration <= 0) return 0
  if (duration < 1) return 1
  if (duration < 2) return 2
  if (duration < 4) return 3
  return 4
}

/** 时长展示文本：整数不带小数，如 "2" / "2.5" */
export function formatDuration(duration: number): string {
  const rounded = Math.round(duration * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
