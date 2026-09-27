import type {
  KnowledgeCard,
  MonthSummary,
  StudyLog,
  StudyPlan,
  StudyStats,
  TrendPoint,
} from '@/types'
import { DAILY_GOAL_HOURS } from '@/constants'
import { addDays, lastNDateKeys, monthOf, shortLabel, today } from '@/utils/date'
import { isPlanCompleted } from '@/utils/progress'

/** 按日期聚合学习时长（小时） */
export function groupDurationByDate(logs: StudyLog[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const log of logs) {
    map.set(log.date, (map.get(log.date) ?? 0) + log.duration)
  }
  return map
}

/** 累计学习时长（小时） */
export function totalDuration(logs: StudyLog[]): number {
  return logs.reduce((sum, l) => sum + l.duration, 0)
}

/** 当前连续学习天数（今天尚未记录则从昨天起算，不中断计数） */
export function currentStreak(logs: StudyLog[]): number {
  const dates = new Set(logs.map((l) => l.date))
  if (dates.size === 0) return 0
  let cursor = today()
  if (!dates.has(cursor)) cursor = addDays(cursor, -1)
  let streak = 0
  while (dates.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** 历史最长连续学习天数 */
export function maxStreak(logs: StudyLog[]): number {
  const dates = new Set(logs.map((l) => l.date))
  if (dates.size === 0) return 0
  const sorted = [...dates].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === addDays(sorted[i - 1], 1) ? run + 1 : 1
    best = Math.max(best, run)
  }
  return best
}

/**
 * 截止到某日（含当日）向前连续打卡的天数。
 * 逐日回退判断，跨月份时只是日期键正常增减，不会在月末/月初处断开。
 */
export function streakEndingAt(dates: Set<string>, date: string): number {
  let streak = 0
  let cursor = date
  while (dates.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** 某一天是否处于一段长度 >= 2 的连续打卡中（跨月不断） */
export function isInStreak(dates: Set<string>, date: string): boolean {
  return (
    dates.has(date) &&
    (dates.has(addDays(date, -1)) || dates.has(addDays(date, 1)))
  )
}

/**
 * 指定月份（YYYY-MM）的打卡汇总。
 * 最长连续天数取该月每个学习日"向前连续打卡长度"的最大值，
 * 该长度通过逐日回退计算，跨月相邻（如 3/31 与 4/1）自然接续，不会断档。
 */
export function monthSummary(logs: StudyLog[], month: string): MonthSummary {
  const byDate = groupDurationByDate(logs)
  const dates = new Set(logs.map((l) => l.date))

  let totalDuration = 0
  let activeDays = 0
  let goalDays = 0
  let maxStreakInMonth = 0

  for (const [date, duration] of byDate) {
    if (monthOf(date) !== month) continue
    totalDuration += duration
    activeDays += 1
    if (duration >= DAILY_GOAL_HOURS) goalDays += 1
    // streakEndingAt 逐日回退，3/31 接 4/1 时会把上月天数一并计入
    maxStreakInMonth = Math.max(maxStreakInMonth, streakEndingAt(dates, date))
  }

  const round1 = (v: number) => Math.round(v * 10) / 10
  return {
    totalDuration: round1(totalDuration),
    activeDays,
    goalDays,
    maxStreak: maxStreakInMonth,
  }
}

/** 平均每日学习时长（按有记录的天数计算） */
export function averageDailyDuration(logs: StudyLog[]): number {
  const days = new Set(logs.map((l) => l.date)).size
  if (days === 0) return 0
  return totalDuration(logs) / days
}

/** 指定月份（YYYY-MM）的累计学习时长 */
export function monthlyDuration(logs: StudyLog[], month: string): number {
  return logs.filter((l) => monthOf(l.date) === month).reduce((sum, l) => sum + l.duration, 0)
}

/** 近 n 天学习时长趋势 */
export function dailyTrend(logs: StudyLog[], n = 30): TrendPoint[] {
  const byDate = groupDurationByDate(logs)
  return lastNDateKeys(n).map((date) => ({
    date,
    label: shortLabel(date),
    duration: Math.round((byDate.get(date) ?? 0) * 10) / 10,
  }))
}

/** 涉猎的不同领域数（计划 + 卡片去重） */
export function distinctDomains(plans: StudyPlan[], cards: KnowledgeCard[]): number {
  const domains = new Set<string>()
  plans.forEach((p) => domains.add(p.domain))
  cards.forEach((c) => domains.add(c.domain))
  return domains.size
}

/** 完成计划数 */
export function completedPlanCount(plans: StudyPlan[], logs: StudyLog[]): number {
  return plans.filter((p) => isPlanCompleted(p, logs)).length
}

/** 卡片掌握率（精通卡片占比） */
export function cardMasteryRate(cards: KnowledgeCard[]): number {
  if (cards.length === 0) return 0
  const mastered = cards.filter((c) => c.mastery === '精通').length
  return Math.round((mastered / cards.length) * 100)
}

/** 汇总全部统计指标 */
export function computeStats(
  plans: StudyPlan[],
  logs: StudyLog[],
  cards: KnowledgeCard[],
): StudyStats {
  const month = monthOf(today())
  const total = totalDuration(logs)

  return {
    totalDuration: Math.round(total * 10) / 10,
    currentStreak: currentStreak(logs),
    maxStreak: maxStreak(logs),
    averageDailyDuration: Math.round(averageDailyDuration(logs) * 10) / 10,
    monthlyDuration: Math.round(monthlyDuration(logs, month) * 10) / 10,
    activePlans: plans.filter((p) => !isPlanCompleted(p, logs) && p.endDate >= today()).length,
    completedPlans: completedPlanCount(plans, logs),
    cardCount: cards.length,
    masteredCardCount: cards.filter((c) => c.mastery === '精通').length,
    cardMasteryRate: cardMasteryRate(cards),
    logCount: logs.length,
    domainCount: distinctDomains(plans, cards),
    trend: dailyTrend(logs, 30),
  }
}
