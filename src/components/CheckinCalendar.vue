<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StudyLog, StudyPlan } from '@/types'
import { monthOf, parseDateKey, today } from '@/utils/date'
import {
  buildMonthCells,
  durationLevel,
  formatDuration,
  monthLabel,
  shiftMonth,
} from '@/utils/calendar'
import { currentStreak } from '@/utils/statistics'

const props = defineProps<{ logs: StudyLog[]; plans: StudyPlan[] }>()

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const currentMonth = ref(monthOf(today()))
const selectedDate = ref(today())

/** 日期 → 当日总时长 */
const durationByDate = computed(() => {
  const map = new Map<string, number>()
  for (const log of props.logs) {
    map.set(log.date, (map.get(log.date) ?? 0) + log.duration)
  }
  return map
})

/** 日期 → 当日日志列表 */
const logsByDate = computed(() => {
  const map = new Map<string, StudyLog[]>()
  for (const log of props.logs) {
    const list = map.get(log.date)
    if (list) list.push(log)
    else map.set(log.date, [log])
  }
  return map
})

const planNameMap = computed(() => {
  const map = new Map<string, string>()
  props.plans.forEach((p) => map.set(p.id, p.name))
  return map
})

const cells = computed(() => buildMonthCells(currentMonth.value))

/** 连续打卡天数：基于全部日志计算，跨月相邻不会算断 */
const streak = computed(() => currentStreak(props.logs))

/** 本月打卡概况 */
const monthStats = computed(() => {
  let days = 0
  let hours = 0
  for (const [date, duration] of durationByDate.value) {
    if (monthOf(date) === currentMonth.value) {
      days += 1
      hours += duration
    }
  }
  return { days, hours: Math.round(hours * 10) / 10 }
})

function durationOf(date: string): number {
  return durationByDate.value.get(date) ?? 0
}

/** 某日目标时长：日期区间覆盖该日的计划的每日时长之和 */
function goalOf(date: string): number {
  return props.plans
    .filter((p) => p.startDate <= date && p.endDate >= date)
    .reduce((sum, p) => sum + p.dailyHours, 0)
}

function isGoalMet(date: string): boolean {
  const goal = goalOf(date)
  return goal > 0 && durationOf(date) >= goal
}

function selectDay(date: string): void {
  selectedDate.value = date
  // 点到月初月末补齐的邻月格子时，顺势切到对应月份，保持衔接
  const m = monthOf(date)
  if (m !== currentMonth.value) currentMonth.value = m
}

function prevMonth(): void {
  currentMonth.value = shiftMonth(currentMonth.value, -1)
}

function nextMonth(): void {
  currentMonth.value = shiftMonth(currentMonth.value, 1)
}

function goToday(): void {
  currentMonth.value = monthOf(today())
  selectedDate.value = today()
}

const selectedLogs = computed(() =>
  (logsByDate.value.get(selectedDate.value) ?? [])
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
)

const selectedDuration = computed(() => durationOf(selectedDate.value))
const selectedGoal = computed(() => goalOf(selectedDate.value))
const selectedGoalMet = computed(() => isGoalMet(selectedDate.value))

const selectedDateLabel = computed(() => {
  const d = parseDateKey(selectedDate.value)
  const weekday = WEEKDAYS[(d.getDay() + 6) % 7]
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekday}`
})
</script>

<template>
  <el-card shadow="never" class="calendar-card">
    <template #header>
      <div class="card-header">
        <span>打卡日历</span>
        <span class="streak-badge">🔥 连续打卡 {{ streak }} 天</span>
      </div>
    </template>

    <div class="calendar-body">
      <div class="calendar-main">
        <div class="toolbar">
          <el-button size="small" @click="prevMonth">‹</el-button>
          <span class="month-label">{{ monthLabel(currentMonth) }}</span>
          <el-button size="small" @click="nextMonth">›</el-button>
          <el-button size="small" text type="primary" @click="goToday">回到今天</el-button>
          <span class="month-stats">本月打卡 {{ monthStats.days }} 天 · {{ formatDuration(monthStats.hours) }} 小时</span>
        </div>

        <div class="weekday-row">
          <span v-for="w in WEEKDAYS" :key="w">周{{ w }}</span>
        </div>

        <div class="grid">
          <button
            v-for="cell in cells"
            :key="cell.date"
            type="button"
            class="cell"
            :class="[
              `level-${durationLevel(durationOf(cell.date))}`,
              {
                'other-month': !cell.inMonth,
                today: cell.isToday,
                selected: cell.date === selectedDate,
              },
            ]"
            :title="`${cell.date} · ${formatDuration(durationOf(cell.date))} 小时`"
            @click="selectDay(cell.date)"
          >
            <span class="day-num">{{ cell.day }}</span>
            <span v-if="durationOf(cell.date) > 0" class="day-duration">
              {{ formatDuration(durationOf(cell.date)) }}h
            </span>
            <span v-if="isGoalMet(cell.date)" class="goal-mark">✓</span>
          </button>
        </div>

        <div class="legend">
          <span class="legend-item">
            <i v-for="n in 5" :key="n" class="legend-box" :class="`level-${n - 1}`" />
            时长由浅到深
          </span>
          <span class="legend-item"><i class="goal-mark demo">✓</i> 达到当日目标</span>
        </div>
      </div>

      <div class="day-detail">
        <div class="detail-head">
          <b>{{ selectedDateLabel }}</b>
          <el-tag v-if="selectedGoalMet" type="success" size="small">已达标</el-tag>
          <el-tag v-else-if="selectedGoal > 0" type="info" size="small">未达标</el-tag>
        </div>
        <div class="detail-sub">
          <span>学习 {{ formatDuration(selectedDuration) }} 小时</span>
          <span v-if="selectedGoal > 0"> · 目标 {{ formatDuration(selectedGoal) }} 小时</span>
        </div>

        <el-empty
          v-if="selectedLogs.length === 0"
          description="这一天没有学习记录"
          :image-size="72"
        />
        <div v-else class="log-list">
          <div v-for="log in selectedLogs" :key="log.id" class="log-item">
            <div class="log-line">
              <span class="log-content">{{ log.content }}</span>
              <span class="log-duration">{{ formatDuration(log.duration) }}h</span>
            </div>
            <div class="log-meta">
              <el-rate :model-value="log.mastery" disabled />
              <el-tag v-if="log.planId && planNameMap.get(log.planId)" size="small" effect="plain">
                {{ planNameMap.get(log.planId) }}
              </el-tag>
            </div>
            <p v-if="log.notes" class="log-extra">📌 {{ log.notes }}</p>
            <p v-if="log.problem" class="log-extra">❓ {{ log.problem }}</p>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.streak-badge {
  font-size: 13px;
  color: #f56c6c;
  font-weight: 600;
}

.calendar-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
}

@media (max-width: 900px) {
  .calendar-body {
    grid-template-columns: 1fr;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.month-label {
  font-size: 15px;
  font-weight: 600;
  color: #1f2d3d;
  min-width: 84px;
  text-align: center;
}

.month-stats {
  margin-left: auto;
  font-size: 12px;
  color: #909399;
}

.weekday-row,
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.weekday-row {
  margin-bottom: 4px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}

.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 56px;
  padding: 4px 2px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.1s ease;
}

.cell:hover {
  transform: scale(1.04);
}

.cell.level-0 { background: #f5f7fa; color: #606266; }
.cell.level-1 { background: #d9ecff; color: #1f2d3d; }
.cell.level-2 { background: #a6d2fa; color: #1f2d3d; }
.cell.level-3 { background: #79bbff; color: #fff; }
.cell.level-4 { background: #409eff; color: #fff; }

.cell.other-month {
  opacity: 0.4;
}

.cell.today {
  box-shadow: inset 0 0 0 2px #e6a23c;
}

.cell.selected {
  box-shadow: inset 0 0 0 2px #1f2d3d;
}

.cell.today.selected {
  box-shadow:
    inset 0 0 0 2px #1f2d3d,
    inset 0 0 0 4px #e6a23c;
}

.day-num {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.day-duration {
  font-size: 11px;
  line-height: 1;
  opacity: 0.9;
}

.goal-mark {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #2f9e63;
}

.cell.level-3 .goal-mark,
.cell.level-4 .goal-mark {
  color: #d4f5e2;
}

.legend {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.legend-box {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}

.legend-box.level-0 { background: #f5f7fa; border: 1px solid #e4e7ed; }
.legend-box.level-1 { background: #d9ecff; }
.legend-box.level-2 { background: #a6d2fa; }
.legend-box.level-3 { background: #79bbff; }
.legend-box.level-4 { background: #409eff; }

.goal-mark.demo {
  position: static;
  color: #2f9e63;
}

.day-detail {
  border-left: 1px solid #ebeef5;
  padding-left: 24px;
  min-height: 200px;
}

@media (max-width: 900px) {
  .day-detail {
    border-left: none;
    padding-left: 0;
    border-top: 1px solid #ebeef5;
    padding-top: 16px;
  }
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  color: #1f2d3d;
}

.detail-sub {
  margin: 6px 0 12px;
  font-size: 13px;
  color: #909399;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 420px;
  overflow-y: auto;
}

.log-item {
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafbfc;
}

.log-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 14px;
  color: #303133;
}

.log-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-duration {
  color: #409eff;
  font-weight: 600;
  flex-shrink: 0;
}

.log-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.log-extra {
  margin: 6px 0 0;
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
}
</style>
