<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { ListChecks, ChevronLeft, ChevronRight, Download } from '@lucide/vue'

const props = defineProps<{
  profileId: string
}>()

const { t, locale } = useI18n()

interface TransactionRow {
  id: string
  type: 'expense' | 'income'
  is_transfer: boolean
  amount: number
  description: string
  occurred_on: string
  categories: { name: string; parent_id: string | null } | null
  transaction_allocations: { fund: 'daily' | 'fixed' | 'savings'; amount: number }[]
}

const { range: monthRange, monthLabel, prevMonth, nextMonth } = useMonthRange()

const advancedFilterOpen = ref(false)
const filterMode = ref<'month' | 'range'>('month')
const customFrom = ref(todayInTimezone())
const customTo = ref(todayInTimezone())

const range = computed(() => (filterMode.value === 'range' ? { from: customFrom.value, to: customTo.value } : monthRange.value))

const { data, refresh, pending } = await useAsyncData(
  'transaction-list',
  () =>
    $fetch<{ transactions: TransactionRow[] }>('/api/transactions', {
      query: { profileId: props.profileId, from: range.value.from, to: range.value.to }
    }),
  { watch: [() => props.profileId, range], lazy: true }
)

const transactions = computed(() => data.value?.transactions ?? [])

// group by date for the mobile card list — most-recent-first, matching the query order
const groupedByDate = computed(() => {
  const groups: { date: string; items: TransactionRow[] }[] = []
  for (const tx of transactions.value) {
    const last = groups[groups.length - 1]
    if (last && last.date === tx.occurred_on) {
      last.items.push(tx)
    } else {
      groups.push({ date: tx.occurred_on, items: [tx] })
    }
  }
  return groups
})

const exportUrl = computed(
  () => `/api/transactions/export?profileId=${props.profileId}&from=${range.value.from}&to=${range.value.to}`
)

function fundLabel(fund: 'daily' | 'fixed' | 'savings') {
  if (fund === 'daily') return t('ledger.fundDaily')
  if (fund === 'fixed') return t('ledger.fundFixed')
  return t('ledger.fundSavings')
}
function categoryLabel(tx: TransactionRow) {
  if (tx.categories) return tx.categories.name
  if (tx.is_transfer) return t('dashboard.transfer')
  return '—'
}

defineExpose({ refresh })
</script>

<template>
  <Card>
    <CardHeader class="flex-row items-center justify-between space-y-0">
      <CardTitle class="text-h4 flex items-center gap-2">
        <span class="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-xl">
          <ListChecks class="size-4" />
        </span>
        {{ t('dashboard.transactions') }}
      </CardTitle>
      <a :href="exportUrl" target="_blank" class="text-small hover:text-primary bg-accent/60 hover:bg-accent flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors">
        <Download class="size-3.5" />
        {{ t('dashboard.exportCsv') }}
      </a>
    </CardHeader>
    <CardContent>
      <div class="mb-1 flex flex-wrap items-center gap-3">
        <template v-if="filterMode === 'month'">
          <Button variant="outline" size="icon" :aria-label="t('dashboard.prevMonth')" @click="prevMonth">
            <ChevronLeft class="size-4" />
          </Button>
          <span class="text-small">{{ monthLabel }}</span>
          <Button variant="outline" size="icon" :aria-label="t('dashboard.nextMonth')" @click="nextMonth">
            <ChevronRight class="size-4" />
          </Button>
        </template>
        <template v-else>
          <Input v-model="customFrom" type="date" class="w-36" />
          <span class="text-caption">{{ t('dashboard.to') }}</span>
          <Input v-model="customTo" type="date" class="w-36" />
        </template>
      </div>

      <button
        type="button"
        class="text-caption mb-3 underline"
        @click="advancedFilterOpen = !advancedFilterOpen"
      >
        {{ t('dashboard.advancedFilter') }}
      </button>

      <RadioGroup v-if="advancedFilterOpen" v-model="filterMode" class="mb-3 flex gap-4">
        <label class="text-small flex items-center gap-1">
          <RadioGroupItem value="month" />
          {{ t('dashboard.byMonth') }}
        </label>
        <label class="text-small flex items-center gap-1">
          <RadioGroupItem value="range" />
          {{ t('dashboard.byRange') }}
        </label>
      </RadioGroup>

      <div v-if="pending" class="space-y-2">
        <Skeleton class="h-10 w-full" />
        <Skeleton class="h-10 w-full" />
        <Skeleton class="h-10 w-full" />
      </div>
      <template v-else>
        <!-- desktop: table -->
        <div class="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('ledger.columnDate') }}</TableHead>
                <TableHead>{{ t('ledger.columnDescription') }}</TableHead>
                <TableHead>{{ t('ledger.columnAmount') }}</TableHead>
                <TableHead>{{ t('ledger.columnCategory') }}</TableHead>
                <TableHead>{{ t('ledger.columnFund') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="tx in transactions" :key="tx.id" class="hover:bg-accent/40">
                <TableCell class="text-caption">{{ formatDateShort(tx.occurred_on, locale) }}</TableCell>
                <TableCell>{{ tx.description }}</TableCell>
                <TableCell>
                  <span class="text-amount-sm" :class="tx.type === 'income' ? 'text-success' : 'text-destructive'">
                    {{ tx.type === 'income' ? '+' : '−' }}฿{{ formatAmount(tx.amount) }}
                  </span>
                </TableCell>
                <TableCell>
                  <span class="text-caption">{{ categoryLabel(tx) }}</span>
                </TableCell>
                <TableCell>
                  <div class="flex gap-1">
                    <Badge v-for="alloc in tx.transaction_allocations" :key="alloc.fund" variant="secondary">
                      {{ fundLabel(alloc.fund) }}
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow v-if="transactions.length === 0">
                <TableCell colspan="5" class="text-caption text-center">{{ t('dashboard.noTransactions') }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- mobile: date-grouped cards -->
        <div class="space-y-4 md:hidden">
          <div v-for="(group, gi) in groupedByDate" :key="group.date" class="animate-enter" :style="{ animationDelay: `${gi * 40}ms` }">
            <p class="text-caption mb-1">{{ formatDateShort(group.date, locale) }}</p>
            <div class="space-y-2">
              <div v-for="tx in group.items" :key="tx.id" class="border-border bg-card hover:shadow-soft rounded-xl border p-3 transition-shadow">
                <div class="flex items-center justify-between">
                  <span class="text-small">{{ tx.description }}</span>
                  <span
                    class="text-amount-sm"
                    :class="tx.type === 'income' ? 'text-success' : 'text-destructive'"
                  >
                    {{ tx.type === 'income' ? '+' : '−' }}฿{{ formatAmount(tx.amount) }}
                  </span>
                </div>
                <div class="mt-1 flex items-center gap-1">
                  <span class="text-caption">{{ categoryLabel(tx) }}</span>
                  <Badge v-for="alloc in tx.transaction_allocations" :key="alloc.fund" variant="secondary">
                    {{ fundLabel(alloc.fund) }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <p v-if="transactions.length === 0" class="text-caption text-center">{{ t('dashboard.noTransactions') }}</p>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
