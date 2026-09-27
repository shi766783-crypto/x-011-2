// 日期相关的纯函数工具：统一以 YYYY-MM-DD 字符串为日期载体

const DAY_MS = 24 * 60 * 60 * 1000

/** Date → YYYY-MM-DD（本地时区） */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 今日 YYYY-MM-DD */
export function today(): string {
  return toDateKey(new Date())
}

/** YYYY-MM-DD → Date（本地时区零点） */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 两个日期之间相差的天数（b - a，按自然日） */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / DAY_MS)
}

/** 在日期基础上加减 n 天 */
export function addDays(key: string, n: number): string {
  return toDateKey(new Date(parseDateKey(key).getTime() + n * DAY_MS))
}

/** 从今天往前推 n 天的日期键（含今天），共 n 项 */
export function lastNDateKeys(n: number): string[] {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    keys.push(addDays(today(), -i))
  }
  return keys
}

/** 日期对应的月份键 YYYY-MM */
export function monthOf(key: string): string {
  return key.slice(0, 7)
}

/** 在月份键 YYYY-MM 基础上加减 n 个月 */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + n, 1)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${yy}-${mm}`
}

export interface CalendarCell {
  /** YYYY-MM-DD */
  date: string
  /** 是否属于当前展示月份（false 为上/下月补位日） */
  inMonth: boolean
}

/**
 * 某月打卡日历网格：周一起始，固定 6 行 × 7 列共 42 格。
 * 月首周补上月末尾日期、月末周补下月开头日期，
 * 因此切换月份时月末与月初在网格上自然衔接。
 */
export function calendarCells(month: string): CalendarCell[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const offset = (first.getDay() + 6) % 7 // 周一为 0
  const startKey = toDateKey(new Date(y, m - 1, 1 - offset))
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(startKey, i)
    return { date, inMonth: monthOf(date) === month }
  })
}

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 日期对应的星期标签 */
export function weekdayLabel(key: string): string {
  return WEEKDAY_LABELS[(parseDateKey(key).getDay() + 6) % 7]
}

/** 短标签，如 "9/15" */
export function shortLabel(key: string): string {
  const [, m, d] = key.split('-')
  return `${Number(m)}/${Number(d)}`
}
