<script setup lang="ts">
const props = defineProps<{
  majors: { major: string; total: number; percent: number }[]
  grandTotal: number
}>()

const { t } = useI18n()

const colorByMajor = computed(() => {
  const sortedNames = [...props.majors.map((m) => m.major)].sort((a, b) => a.localeCompare(b))
  const map = new Map<string, string>()
  sortedNames.forEach((name, i) => map.set(name, `var(--chart-${(i % 5) + 1})`))
  return map
})

defineExpose({ colorByMajor })

const RADIUS = 55
const STROKE = 24
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 3

const segments = computed(() => {
  let cumulative = 0
  return props.majors.map((m) => {
    const length = (m.percent / 100) * CIRCUMFERENCE
    const visible = Math.max(length - GAP, 0)
    const segment = {
      major: m.major,
      total: m.total,
      percent: m.percent,
      color: colorByMajor.value.get(m.major) ?? 'var(--muted-foreground)',
      dasharray: `${visible} ${CIRCUMFERENCE - visible}`,
      dashoffset: -cumulative
    }
    cumulative += length
    return segment
  })
})

const hoveredIndex = ref<number | null>(null)
const hovered = computed(() => (hoveredIndex.value !== null ? segments.value[hoveredIndex.value] : null))
</script>

<template>
  <div v-if="majors.length > 0" class="animate-enter-scale flex justify-center">
    <div class="relative shrink-0">
      <svg viewBox="0 0 140 140" width="200" height="200" class="-rotate-90">
        <circle
          v-for="(seg, i) in segments"
          :key="seg.major"
          cx="70"
          cy="70"
          :r="RADIUS"
          fill="none"
          :stroke="seg.color"
          :stroke-width="STROKE"
          :stroke-dasharray="seg.dasharray"
          :stroke-dashoffset="seg.dashoffset"
          stroke-linecap="round"
          tabindex="0"
          class="cursor-pointer outline-none transition-opacity duration-200"
          :class="{ 'opacity-40': hoveredIndex !== null && hoveredIndex !== i }"
          @pointerenter="hoveredIndex = i"
          @pointerleave="hoveredIndex = null"
          @focus="hoveredIndex = i"
          @blur="hoveredIndex = null"
        />
      </svg>
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <template v-if="hovered">
          <p class="text-caption max-w-24 truncate">{{ hovered.major }}</p>
          <p class="text-large">{{ hovered.percent }}%</p>
          <p class="text-caption">฿{{ formatAmount(hovered.total) }}</p>
        </template>
        <template v-else>
          <p class="text-caption">{{ t('dashboard.total') }}</p>
          <p class="text-large">฿{{ formatAmount(grandTotal) }}</p>
        </template>
      </div>
    </div>
  </div>
  <p v-else class="text-caption text-center">{{ t('dashboard.noSpending') }}</p>
</template>
