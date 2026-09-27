<script setup lang="ts">
import { computed } from 'vue'
import StatCard from '@/components/StatCard.vue'
import CheckinCalendar from '@/components/CheckinCalendar.vue'
import { useStatsStore } from '@/stores/stats'

const statsStore = useStatsStore()
const stats = computed(() => statsStore.stats)
</script>

<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">打卡日历</h2>
    </div>

    <div class="card-grid">
      <StatCard label="连续学习天数" :value="stats.currentStreak" icon="🔥" color="#f56c6c" />
      <StatCard label="历史最长连续" :value="stats.maxStreak" icon="🏅" color="#e6a23c" />
      <StatCard label="累计日志数" :value="stats.logCount" icon="📝" color="#409eff" />
      <StatCard label="平均每日时长(时)" :value="stats.averageDailyDuration" icon="📈" color="#67c23a" />
    </div>

    <CheckinCalendar class="calendar-card" />
  </div>
</template>

<style scoped>
.calendar-card {
  margin-top: 20px;
}
</style>
