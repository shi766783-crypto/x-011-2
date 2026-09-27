<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { StudyLog } from '@/types'
import { DAILY_GOAL_HOURS } from '@/constants'
import { useLogsStore } from '@/stores/logs'
import { usePlansStore } from '@/stores/plans'
import {
  addMonths,
  calendarCells,
  monthOf,
  today,
  weekdayLabel,
} from '@/utils/date'
import {
  groupDurationByDate,
  isInStreak,
  monthSummary,
} from '@/utils/statistics'

const logsStore = useLogsStore()
const plansStore = usePlansStore()
const router = useRouter()

const currentMonth = ref(monthOf(today()))
const selectedDate = ref<string | null>(null)
const drawerVisible = ref(false)

const todayKey = today()

const cells = computed(() => calendarCells(currentMonth.value))
const durationMap = computed(() => groupDurationByDate(logsStore.logs))
const dateSet = computed(() => new Set(logsStore.logs.map((l) => l.date)))
const summary = computed(() => monthSummary(logsStore.logs, currentMonth.value))

const monthLabel = computed(() => {
  const [y, m] = currentMonth.value.split('-')
  return `${y} 年 ${Number(m)} 月`
})

const planNameMap = computed(() => {
  const map = new Map<string, string>()
  plansStore.plans.forEach((p) => map.set(p.id, p.name))
  return map
})

const selectedLogs = computed<StudyLog[]>(() => {
  if (!selectedDate.value) return []
  return logsStore.logs
    .filter((l) => l.date === selectedDate.value)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
})

const selectedDuration = computed(() =>
  selectedDate.value ? durationMap.value.get(selectedDate.value) ?? 0 : 0,
)

const selectedGoalMet = computed(() => selectedDuration.value >= DAILY_GOAL_HOURS)

function durationOf(date: string): number {
  return durationMap.value.get(date) ?? 0
}

/** 颜色深浅等级 0-5，按每日达标时长划分 */
function heatLevel(duration: number): number {
  if (duration <= 0) return 0
  const goal = DAILY_GOAL_HOURS
  if (duration < goal * 0.5) return 1
  if (duration < goal) return 2
  if (duration < goal * 2) return 3
  if (duration < goal * 4) return 4
  return 5
}

function selectCell(date: string, inMonth: boolean): void {
  // 点击上/下月补位日时先切换月份，再展开该日明细
  if (!inMonth) currentMonth.value = monthOf(date)
  selectedDate.value = date
  drawerVisible.value = true
}

function prevMonth(): void {
  currentMonth.value = addMonths(currentMonth.value, -1)
}

function nextMonth(): void {
  currentMonth.value = addMonths(currentMonth.value, 1)
}

function backToToday(): void {
  currentMonth.value = monthOf(todayKey)
}

function goWriteLog(): void {
  drawerVisible.value = false
  router.push({ path: '/logs', query: selectedDate.value ? { date: selectedDate.value } : {} })
}

function formatHours(value: number): string {
  return `${Math.round(value * 10) / 10}h`
}
</script>

<template>
  <el-card shadow="never" class="checkin-calendar">
    <template #header>
      <div class="cal-header">
        <div class="cal-nav">
          <el-button-group>
            <el-button @click="prevMonth">‹</el-button>
            <el-button @click="backToToday">今天</el-button>
            <el-button @click="nextMonth">›</el-button>
          </el-button-group>
          <span class="cal-title">{{ monthLabel }}</span>
        </div>
        <div class="cal-summary">
          <span>学习 <b>{{ summary.activeDays }}</b> 天</span>
          <span>达标 <b class="goal-text">{{ summary.goalDays }}</b> 天</span>
          <span>时长 <b>{{ summary.totalDuration }}</b>h</span>
          <span>最长连续 <b class="streak-text">{{ summary.maxStreak }}</b> 天</span>
        </div>
      </div>
    </template>

    <div class="calendar-grid weekday-row">
      <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="weekday">{{ w }}</span>
    </div>

    <div class="calendar-grid">
      <button
        v-for="cell in cells"
        :key="cell.date"
        type="button"
        class="day-cell"
        :class="[
          `level-${heatLevel(durationOf(cell.date))}`,
          {
            'is-muted': !cell.inMonth,
            'is-today': cell.date === todayKey,
            'is-selected': cell.date === selectedDate,
            'is-empty': cell.inMonth && durationOf(cell.date) === 0,
          },
        ]"
        @click="selectCell(cell.date, cell.inMonth)"
      >
        <span class="day-num">{{ Number(cell.date.slice(8)) }}</span>
        <span v-if="durationOf(cell.date) > 0" class="day-duration">{{ formatHours(durationOf(cell.date)) }}</span>
        <span
          v-if="durationOf(cell.date) >= DAILY_GOAL_HOURS"
          class="goal-badge"
          title="当日达标"
        >✓</span>
        <span
          v-if="isInStreak(dateSet, cell.date)"
          class="streak-mark"
          title="连续打卡中"
        >🔥</span>
      </button>
    </div>

    <div class="legend">
      <span class="legend-label">少</span>
      <span v-for="lv in [1, 2, 3, 4, 5]" :key="lv" class="legend-box" :class="`level-${lv}`" />
      <span class="legend-label">多</span>
      <span class="legend-tip">✓ 当日达标（≥ {{ DAILY_GOAL_HOURS }}h） · 🔥 连续打卡</span>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="selectedDate ? `${selectedDate} ${weekdayLabel(selectedDate)}` : ''"
      size="400px"
      append-to-body
    >
      <template v-if="selectedDate">
        <div class="detail-summary">
          <el-tag size="large" :type="selectedGoalMet ? 'success' : 'info'">
            {{ selectedGoalMet ? '当日达标' : '未达标' }}
          </el-tag>
          <span class="detail-hours">
            共 <b>{{ Math.round(selectedDuration * 10) / 10 }}</b> 小时 ·
            {{ selectedLogs.length }} 条日志
          </span>
        </div>

        <el-empty v-if="selectedLogs.length === 0" description="这天还没有学习记录">
          <el-button type="primary" @click="goWriteLog">去写日志</el-button>
        </el-empty>

        <div v-else class="log-list">
          <div v-for="log in selectedLogs" :key="log.id" class="log-item">
            <div class="log-item-header">
              <span class="log-content">{{ log.content }}</span>
              <el-tag size="small" type="primary" effect="plain">{{ log.duration }}h</el-tag>
            </div>
            <div class="log-meta">
              <el-tag v-if="log.planId" size="small" type="info" effect="plain">
                {{ planNameMap.get(log.planId) ?? '未关联计划' }}
              </el-tag>
              <el-rate :model-value="log.mastery" disabled />
            </div>
            <template v-if="log.problem || log.solution || log.notes">
              <p v-if="log.problem" class="log-field"><b>问题：</b>{{ log.problem }}</p>
              <p v-if="log.solution" class="log-field"><b>解决：</b>{{ log.solution }}</p>
              <p v-if="log.notes" class="log-field"><b>笔记：</b>{{ log.notes }}</p>
            </template>
          </div>
          <el-button class="write-more" @click="goWriteLog">补记 / 编辑日志</el-button>
        </div>
      </template>
    </el-drawer>
  </el-card>
</template>

<style scoped>
.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.cal-nav {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cal-nav :deep(.el-button) {
  font-size: 16px;
  font-weight: 600;
  padding-left: 14px;
  padding-right: 14px;
}

.cal-title {
  font-size: 17px;
  font-weight: 600;
  color: #1f2d3d;
}

.cal-summary {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #606266;
}

.cal-summary b {
  color: #1f2d3d;
}

.goal-text {
  color: #67c23a !important;
}

.streak-text {
  color: #f56c6c !important;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.weekday-row {
  margin-bottom: 6px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  color: #909399;
}

.day-cell {
  position: relative;
  height: 64px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  transition: transform 0.1s, box-shadow 0.1s;
  font-family: inherit;
}

.day-cell:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 1;
}

.day-cell.is-empty {
  background: #fafbfc;
}

.day-cell.is-muted {
  opacity: 0.38;
}

.day-cell.is-today {
  border: 2px solid #f56c6c;
  padding: 5px 7px;
}

.day-cell.is-selected {
  box-shadow: 0 0 0 2px #1f2d3d;
}

.day-num {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.day-duration {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.goal-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #67c23a;
  color: #fff;
  font-size: 10px;
  line-height: 15px;
  text-align: center;
  font-weight: 700;
}

.streak-mark {
  position: absolute;
  right: 4px;
  bottom: 2px;
  font-size: 11px;
  line-height: 1;
}

/* 热力色阶：浅 → 深 */
.level-0 {
  color: #c0c4cc;
}

.level-1 {
  background: #ecf5ff;
  border-color: #d9ecff;
  color: #5a7a9c;
}

.level-2 {
  background: #c6e2ff;
  border-color: #a0cfff;
  color: #315a82;
}

.level-3 {
  background: #79bbff;
  border-color: #409eff;
  color: #fff;
}

.level-4 {
  background: #409eff;
  border-color: #337ecc;
  color: #fff;
}

.level-5 {
  background: #0d3a70;
  border-color: #0a2e59;
  color: #fff;
}

.legend {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 14px;
}

.legend-label {
  font-size: 12px;
  color: #909399;
}

.legend-box {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid transparent;
}

.legend-box.level-1 { background: #ecf5ff; border-color: #d9ecff; }
.legend-box.level-2 { background: #c6e2ff; border-color: #a0cfff; }
.legend-box.level-3 { background: #79bbff; border-color: #409eff; }
.legend-box.level-4 { background: #409eff; border-color: #337ecc; }
.legend-box.level-5 { background: #0d3a70; border-color: #0a2e59; }

.legend-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}

.detail-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.detail-hours {
  font-size: 14px;
  color: #606266;
}

.detail-hours b {
  color: #1f2d3d;
  font-size: 16px;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 14px;
  background: #fafbfc;
}

.log-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.log-content {
  font-weight: 600;
  color: #1f2d3d;
  font-size: 14px;
}

.log-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.log-field {
  margin: 4px 0 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.write-more {
  margin-top: 4px;
}
</style>
