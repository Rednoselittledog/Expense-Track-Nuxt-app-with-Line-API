<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight, ChevronLeft, PieChart } from '@lucide/vue'

const props = defineProps<{
  profileId: string
}>()

const { t, locale } = useI18n()

interface SubSummary {
  sub: string
  id: string | null
  total: number
}
interface CategorySummary {
  range: { from: string; to: string }
  grandTotal: number
  majors: { major: string; total: number; percent: number; subs: SubSummary[] }[]
}
interface SubTransaction {
  id: string
  description: string
  occurred_on: string
  transaction_allocations: { fund: 'daily' | 'fixed' | 'savings'; amount: number }[]
}

const { range, monthLabel, prevMonth, nextMonth } = useMonthRange()

const activeFund = ref<'daily' | 'fixed' | 'savings'>('daily')

const { data: dailyData, refresh: refreshDaily, pending: dailyPending } = await useAsyncData(
  'category-breakdown-daily',
  () =>
    $fetch<CategorySummary>('/api/summary', {
      query: { profileId: props.profileId, view: 'category', fund: 'daily', from: range.value.from, to: range.value.to }
    }),
  { watch: [() => props.profileId, range], lazy: true }
)
const { data: fixedData, refresh: refreshFixed, pending: fixedPending } = await useAsyncData(
  'category-breakdown-fixed',
  () =>
    $fetch<CategorySummary>('/api/summary', {
      query: { profileId: props.profileId, view: 'category', fund: 'fixed', from: range.value.from, to: range.value.to }
    }),
  { watch: [() => props.profileId, range], lazy: true }
)
const { data: savingsData, refresh: refreshSavings, pending: savingsPending } = await useAsyncData(
  'category-breakdown-savings',
  () =>
    $fetch<CategorySummary>('/api/summary', {
      query: { profileId: props.profileId, view: 'category', fund: 'savings', from: range.value.from, to: range.value.to }
    }),
  { watch: [() => props.profileId, range], lazy: true }
)

async function refresh() {
  await Promise.all([refreshDaily(), refreshFixed(), refreshSavings()])
}
defineExpose({ refresh })

const dataByFund = computed(() => ({ daily: dailyData.value, fixed: fixedData.value, savings: savingsData.value }))
const pendingByFund = computed(() => ({ daily: dailyPending.value, fixed: fixedPending.value, savings: savingsPending.value }))

// drill-down: expand a sub-category to lazily fetch its actual transactions for the active fund/month
const expandedSubs = ref<Set<string>>(new Set())
const subTransactions = reactive<Record<string, SubTransaction[] | 'loading'>>({})

function subKey(fund: string, subId: string | null, sub: string) {
  return `${fund}|${subId ?? sub}`
}

async function toggleSub(sub: SubSummary) {
  const key = subKey(activeFund.value, sub.id, sub.sub)
  if (expandedSubs.value.has(key)) {
    expandedSubs.value.delete(key)
    return
  }
  expandedSubs.value.add(key)
  if (subTransactions[key] || !sub.id) return

  subTransactions[key] = 'loading'
  const result = await $fetch<{ transactions: SubTransaction[] }>('/api/transactions', {
    query: { profileId: props.profileId, from: range.value.from, to: range.value.to, categoryId: sub.id }
  })
  subTransactions[key] = result.transactions.filter((tx) => tx.transaction_allocations.some((a) => a.fund === activeFund.value))
}

function subAllocAmount(tx: SubTransaction, fund: 'daily' | 'fixed' | 'savings') {
  return tx.transaction_allocations.find((a) => a.fund === fund)?.amount ?? 0
}
</script>

<template>
  <div class="space-y-4">
    <div class="mb-1 flex items-center gap-3">
      <Button variant="outline" size="icon" :aria-label="t('dashboard.prevMonth')" @click="prevMonth">
        <ChevronLeft class="size-4" />
      </Button>
      <span class="text-small">{{ monthLabel }}</span>
      <Button variant="outline" size="icon" :aria-label="t('dashboard.nextMonth')" @click="nextMonth">
        <ChevronRight class="size-4" />
      </Button>
    </div>

    <Tabs v-model="activeFund">
      <TabsList class="grid w-full grid-cols-3 md:w-80">
        <TabsTrigger value="daily">{{ t('dashboard.daily') }}</TabsTrigger>
        <TabsTrigger value="fixed">{{ t('dashboard.fixed') }}</TabsTrigger>
        <TabsTrigger value="savings">{{ t('dashboard.savings') }}</TabsTrigger>
      </TabsList>

      <TabsContent v-for="fundTab in (['daily', 'fixed', 'savings'] as const)" :key="fundTab" :value="fundTab" class="space-y-4">
        <template v-if="pendingByFund[fundTab]">
          <Skeleton class="mx-auto h-[200px] w-[200px] rounded-full" />
          <Skeleton class="h-16 w-full" />
          <Skeleton class="h-16 w-full" />
        </template>
        <template v-else>
          <Card class="bg-hero-gradient">
            <CardHeader>
              <CardTitle class="text-h4 flex items-center gap-2">
                <span class="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-xl">
                  <PieChart class="size-4" />
                </span>
                {{ t('dashboard.categoryBreakdown') }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DashboardCategoryPieChart
                :majors="dataByFund[fundTab]?.majors ?? []"
                :grand-total="dataByFund[fundTab]?.grandTotal ?? 0"
              />
            </CardContent>
          </Card>

          <Card
            v-for="(m, mi) in dataByFund[fundTab]?.majors ?? []"
            :key="m.major"
            class="animate-enter py-0"
            :style="{ animationDelay: `${mi * 40}ms` }"
          >
            <Collapsible v-slot="{ open }">
              <CollapsibleTrigger class="hover:bg-accent flex w-full cursor-pointer items-center justify-between rounded-2xl p-4 text-left">
                <span class="flex min-w-0 items-center gap-2.5">
                  <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: `var(--chart-${(mi % 5) + 1})` }" />
                  <ChevronRight class="text-muted-foreground size-4 shrink-0 transition-transform" :class="{ 'rotate-90': open }" />
                  <span class="text-large truncate">{{ m.major }}</span>
                </span>
                <span class="text-amount-sm shrink-0">{{ m.percent }}% · ฿{{ formatAmount(m.total) }}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="px-4 pb-4">
                  <div v-for="s in m.subs" :key="s.sub" class="border-t first:border-t-0">
                    <button
                      type="button"
                      class="hover:bg-accent text-caption flex w-full items-center justify-between gap-2 rounded-md py-2 pl-6 text-left"
                      :disabled="!s.id"
                      @click="toggleSub(s)"
                    >
                      <span class="flex items-center gap-1.5">
                        <ChevronRight
                          v-if="s.id"
                          class="size-3.5 shrink-0 transition-transform"
                          :class="{ 'rotate-90': expandedSubs.has(subKey(fundTab, s.id, s.sub)) }"
                        />
                        {{ s.sub }}
                      </span>
                      <span>฿{{ formatAmount(s.total) }}</span>
                    </button>
                    <div v-if="expandedSubs.has(subKey(fundTab, s.id, s.sub))" class="animate-enter pb-2 pl-11">
                      <template v-if="subTransactions[subKey(fundTab, s.id, s.sub)] === 'loading'">
                        <Skeleton class="h-4 w-full" />
                      </template>
                      <template v-else>
                        <div
                          v-for="tx in (subTransactions[subKey(fundTab, s.id, s.sub)] as SubTransaction[] | undefined) ?? []"
                          :key="tx.id"
                          class="text-caption flex justify-between py-1"
                        >
                          <span class="truncate">{{ formatDateShort(tx.occurred_on, locale) }} · {{ tx.description }}</span>
                          <span class="shrink-0">฿{{ formatAmount(subAllocAmount(tx, fundTab)) }}</span>
                        </div>
                        <p
                          v-if="!(subTransactions[subKey(fundTab, s.id, s.sub)] as SubTransaction[] | undefined)?.length"
                          class="text-caption"
                        >
                          {{ t('dashboard.noTransactions') }}
                        </p>
                      </template>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </template>
      </TabsContent>
    </Tabs>
  </div>
</template>
