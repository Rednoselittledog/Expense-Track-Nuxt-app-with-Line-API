<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet, PiggyBank, Calendar, Repeat } from '@lucide/vue'
import { useTransition, TransitionPresets, usePreferredReducedMotion } from '@vueuse/core'

const props = defineProps<{
  profileId: string
}>()

const { t, locale } = useI18n()

interface DailySummary {
  accumulatedRemaining: number
  accumulatedSpending: number
  dailyRemaining: number
  dailyRate: number
  monthlyAmount: number
  cycle: { start: string; end: string; labelYear: number; labelMonth: number; elapsedDays: number }
}
interface FixedSummary {
  budgeted: number
  spent: number
  remaining: number
  cycle: { start: string; end: string }
}
interface SavingsSummary {
  balance: number
  lastTopUp: { amount: number; occurred_on: string } | null
}

const { data: daily, refresh: refreshDaily, pending: dailyPending } = await useAsyncData(
  'balance-cards-daily',
  () => $fetch<DailySummary>('/api/summary', { query: { profileId: props.profileId, view: 'daily' } }),
  { watch: [() => props.profileId] }
)
const { data: fixed, refresh: refreshFixed, pending: fixedPending } = await useAsyncData(
  'balance-cards-fixed',
  () => $fetch<FixedSummary>('/api/summary', { query: { profileId: props.profileId, view: 'fixed' } }),
  { watch: [() => props.profileId] }
)
const { data: savings, refresh: refreshSavings, pending: savingsPending } = await useAsyncData(
  'balance-cards-savings',
  () => $fetch<SavingsSummary>('/api/summary', { query: { profileId: props.profileId, view: 'savings' } }),
  { watch: [() => props.profileId] }
)

const cycleRangeLabel = computed(() => {
  if (!daily.value) return ''
  return `${formatDateShort(daily.value.cycle.start, locale.value)} – ${formatDateShort(daily.value.cycle.end, locale.value)}`
})

const cycleMonthLabel = computed(() => {
  if (!daily.value) return ''
  return formatMonthYear(daily.value.cycle.labelYear, daily.value.cycle.labelMonth, locale.value)
})

async function refresh() {
  await Promise.all([refreshDaily(), refreshFixed(), refreshSavings()])
}

defineExpose({ refresh })

// headline numbers count up instead of snapping in — skipped entirely under prefers-reduced-motion
const reducedMotion = usePreferredReducedMotion()
function animatedAmount(source: Ref<number>) {
  const animated = useTransition(source, { duration: 700, transition: TransitionPresets.easeOutExpo })
  return computed(() => (reducedMotion.value === 'reduce' ? source.value : animated.value))
}
const dailyRemainingDisplay = animatedAmount(computed(() => daily.value?.dailyRemaining ?? 0))
const savingsBalanceDisplay = animatedAmount(computed(() => savings.value?.balance ?? 0))

const pacePercent = computed(() => {
  if (!daily.value) return 0
  const allowed = daily.value.dailyRate * daily.value.cycle.elapsedDays
  return allowed > 0 ? Math.min(100, (daily.value.accumulatedSpending / allowed) * 100) : 0
})

const fixedPercent = computed(() => {
  if (!fixed.value) return 0
  if (fixed.value.budgeted <= 0) return fixed.value.spent > 0 ? 100 : 0
  return Math.min(100, (fixed.value.spent / fixed.value.budgeted) * 100)
})
const fixedOverBudget = computed(() => !!fixed.value && fixed.value.spent > fixed.value.budgeted)

// mobile: swipeable carousel instead of tabs — dot below tracks which of the 3 cards is in view
const carouselRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
function onCarouselScroll() {
  const el = carouselRef.value
  if (!el) return
  activeIndex.value = Math.round(el.scrollLeft / el.clientWidth)
}
function scrollToIndex(index: number) {
  const el = carouselRef.value
  if (!el) return
  el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
}
</script>

<template>
  <div>
    <div
      ref="carouselRef"
      class="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 md:grid md:grid-cols-3 md:overflow-visible md:snap-none md:pb-0"
      @scroll="onCarouselScroll"
    >
      <Card class="animate-enter relative min-w-full shrink-0 snap-center overflow-hidden md:min-w-0">
        <div class="bg-brand-gradient absolute inset-x-0 top-0 h-1.5" />
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <span class="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-xl">
              <Wallet class="size-4" />
            </span>
            <span class="text-eyebrow">{{ t('dashboard.daily') }}</span>
          </CardTitle>
          <template v-if="daily">
            <p class="text-large flex items-center gap-1.5">
              <Calendar class="text-muted-foreground size-4" />
              {{ cycleMonthLabel }}
            </p>
            <p class="text-caption">{{ cycleRangeLabel }}</p>
          </template>
        </CardHeader>
        <CardContent v-if="dailyPending">
          <Skeleton class="h-9 w-40" />
        </CardContent>
        <CardContent v-else-if="daily">
          <p class="text-caption">{{ t('dashboard.dailyRemainingPacing') }}</p>
          <p class="text-amount-lg" :class="daily.dailyRemaining < 0 ? 'text-destructive' : 'text-success'">
            ฿{{ formatAmount(dailyRemainingDisplay) }}
          </p>
          <Progress :model-value="pacePercent" class="mt-2" />

          <div class="mt-3 flex gap-6">
            <div>
              <p class="text-caption">{{ t('dashboard.accumulatedRemaining') }}</p>
              <p class="text-amount-sm">฿{{ formatAmount(daily.accumulatedRemaining) }}</p>
            </div>
            <div>
              <p class="text-caption">{{ t('dashboard.accumulatedSpending') }}</p>
              <p class="text-amount-sm">฿{{ formatAmount(daily.accumulatedSpending) }}</p>
            </div>
          </div>

          <p class="text-caption mt-3">
            {{ t('dashboard.dailyRateCaption', { rate: formatAmount(daily.dailyRate) }) }}
          </p>
        </CardContent>
      </Card>

      <Card class="animate-enter relative min-w-full shrink-0 snap-center overflow-hidden md:min-w-0" style="animation-delay: 60ms">
        <div class="absolute inset-x-0 top-0 h-1.5" style="background: linear-gradient(135deg, var(--chart-5), var(--chart-1))" />
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <span
              class="flex size-8 items-center justify-center rounded-xl"
              style="background: color-mix(in oklch, var(--chart-5) 15%, transparent); color: var(--chart-5)"
            >
              <Repeat class="size-4" />
            </span>
            <span class="text-eyebrow">{{ t('dashboard.fixed') }}</span>
          </CardTitle>
          <p class="text-caption">{{ t('dashboard.fixedCaption') }}</p>
        </CardHeader>
        <CardContent v-if="fixedPending">
          <Skeleton class="h-9 w-40" />
        </CardContent>
        <CardContent v-else-if="fixed">
          <p class="text-small" :class="{ 'text-destructive': fixedOverBudget }">
            {{ t('dashboard.fixedUsed', { spent: formatAmount(fixed.spent), budgeted: formatAmount(fixed.budgeted) }) }}
          </p>
          <Progress :model-value="fixedPercent" class="mt-2" />
          <p class="text-caption mt-3">
            <template v-if="fixedOverBudget">
              {{ t('dashboard.fixedOverBudget', { amount: formatAmount(Math.abs(fixed.remaining)) }) }}
            </template>
            <template v-else>{{ t('dashboard.fixedRemaining', { amount: formatAmount(fixed.remaining) }) }}</template>
          </p>
        </CardContent>
      </Card>

      <Card class="animate-enter relative min-w-full shrink-0 snap-center overflow-hidden md:min-w-0" style="animation-delay: 120ms">
        <div class="absolute inset-x-0 top-0 h-1.5" style="background: linear-gradient(135deg, var(--chart-1), var(--chart-3))" />
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <span class="flex size-8 items-center justify-center rounded-xl" style="background: color-mix(in oklch, var(--chart-1) 15%, transparent); color: var(--chart-1)">
              <PiggyBank class="size-4" />
            </span>
            <span class="text-eyebrow">{{ t('dashboard.savings') }}</span>
          </CardTitle>
        </CardHeader>
        <CardContent v-if="savingsPending">
          <Skeleton class="h-9 w-40" />
        </CardContent>
        <CardContent v-else-if="savings">
          <p class="text-caption">{{ t('dashboard.balance') }}</p>
          <p class="text-amount-lg" style="color: var(--chart-1)">฿{{ formatAmount(savingsBalanceDisplay) }}</p>

          <p class="text-caption mt-3">
            <template v-if="savings.lastTopUp">
              {{
                t('dashboard.lastTopUp', {
                  amount: formatAmount(savings.lastTopUp.amount),
                  date: formatDateShort(savings.lastTopUp.occurred_on, locale)
                })
              }}
            </template>
            <template v-else>{{ t('dashboard.noTopUpYet') }}</template>
          </p>
        </CardContent>
      </Card>
    </div>

    <div class="mt-2 flex justify-center gap-1.5 md:hidden">
      <button
        v-for="i in 3"
        :key="i"
        type="button"
        class="h-1.5 rounded-full transition-all"
        :class="activeIndex === i - 1 ? 'bg-primary w-4' : 'bg-muted w-1.5'"
        :aria-label="`slide ${i}`"
        @click="scrollToIndex(i - 1)"
      />
    </div>
  </div>
</template>
