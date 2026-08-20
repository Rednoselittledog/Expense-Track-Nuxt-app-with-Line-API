<script setup lang="ts">
import type { CategoryContext } from '~~/server/utils/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import { Wallet, Settings } from '@lucide/vue'

const { t } = useI18n()
const supabase = useSupabase()
const route = useRoute()

const { data: profile } = await useCurrentProfile()
const profileId = computed(() => profile.value?.id ?? '')

const { data: rawCategories } = await useAsyncData('index-categories', async () => {
  const { data, error } = await supabase.from('categories').select('id, parent_id, name').eq('is_active', true)
  if (error) throw error
  return data
})
const categories = computed<CategoryContext[]>(() => {
  const all = rawCategories.value ?? []
  const majors = all.filter((c) => !c.parent_id)
  return majors.map((major) => ({
    major: major.name,
    subs: all.filter((c) => c.parent_id === major.id).map((c) => c.name)
  }))
})

const parseText = ref('')
const parsing = ref(false)
const confirmDialogOpen = ref(false)
const draftItems = ref<any[]>([])
const addDialogOpen = ref(false)
const editingId = ref<string | null>(null)

interface EditableTransaction {
  id: string
  type: 'expense' | 'income'
  amount: number
  description: string
  occurred_on: string
  categories: { name: string; parent_id: string | null } | null
  transaction_allocations: { fund: 'daily' | 'fixed' | 'savings'; amount: number }[]
}

function openEdit(tx: EditableTransaction) {
  const major = rawCategories.value?.find((c) => c.id === tx.categories?.parent_id)?.name ?? ''
  draftItems.value = [
    {
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      occurred_on: tx.occurred_on,
      category: tx.categories ? { major, sub: tx.categories.name } : null,
      allocations: tx.transaction_allocations.map((a) => ({ fund: a.fund, amount: a.amount }))
    }
  ]
  editingId.value = tx.id
  confirmDialogOpen.value = true
}

async function runParse(text: string) {
  if (!text.trim()) return
  parsing.value = true
  try {
    const result = await $fetch<{ items: any[] }>('/api/parse', {
      method: 'POST',
      body: { profileId: profileId.value, text }
    })
    draftItems.value = result.items
    editingId.value = null
    addDialogOpen.value = false
    confirmDialogOpen.value = true
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    parsing.value = false
  }
}

function openManualAdd() {
  draftItems.value = []
  editingId.value = null
  addDialogOpen.value = false
  confirmDialogOpen.value = true
}

const transferDialogOpen = ref(false)
const mobileTab = computed(() => (route.query.tab as 'transactions' | 'categories' | 'settings' | undefined) ?? 'home')

watchEffect(() => {
  if (route.query.add === '1') {
    addDialogOpen.value = true
    navigateTo({ path: '/', query: { tab: route.query.tab } }, { replace: true })
  }
})

const balanceCardsRef = ref()
const transactionListRef = ref()
const categoryBreakdownRef = ref()

interface TodayTransaction {
  id: string
  type: 'expense' | 'income'
  amount: number
  description: string
}

const { data: todayData, refresh: refreshToday } = await useAsyncData(
  'index-today-transactions',
  () => {
    const today = todayInTimezone()
    return $fetch<{ transactions: TodayTransaction[] }>('/api/transactions', {
      query: { profileId: profileId.value, from: today, to: today }
    })
  },
  { watch: [profileId] }
)

function refreshAll() {
  balanceCardsRef.value?.refresh()
  transactionListRef.value?.refresh()
  categoryBreakdownRef.value?.refresh()
  refreshToday()
  parseText.value = ''
}
</script>

<template>
  <div class="bg-hero-gradient">
    <div class="mx-auto max-w-5xl p-4 md:p-8">
    <header v-if="mobileTab !== 'settings'" class="mb-6 hidden flex-wrap items-center justify-between gap-3 md:flex">
      <h1 class="text-h2 flex items-center gap-2 border-none pb-0">
        <span class="bg-brand-gradient shadow-soft flex size-10 items-center justify-center rounded-2xl">
          <Wallet class="text-primary-foreground size-5" />
        </span>
        {{ t('dashboard.title') }}
      </h1>
      <div class="bg-card shadow-soft flex flex-1 items-center gap-2 rounded-2xl border p-1.5 md:flex-none md:w-96">
        <Input
          v-model="parseText"
          :placeholder="t('dashboard.parsePlaceholder')"
          class="flex-1 border-none shadow-none focus-visible:ring-0"
          @keyup.enter="runParse(parseText)"
        />
        <Button :disabled="parsing" :loading="parsing" @click="runParse(parseText)">{{ t('dashboard.send') }}</Button>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" class="text-small underline" @click="openManualAdd">
          {{ t('dashboard.addManually') }}
        </button>
        <NuxtLink
          :to="{ path: '/', query: { tab: 'settings' } }"
          class="text-muted-foreground hover:text-foreground hover:bg-accent flex size-9 items-center justify-center rounded-full transition-colors"
          :title="t('settings.title')"
        >
          <Settings class="size-5" />
        </NuxtLink>
      </div>
    </header>

    <div v-if="mobileTab === 'settings'" class="pb-20 md:pb-0">
      <DashboardSettingsPanel />
    </div>

    <div v-else class="space-y-6 pb-20 md:pb-0">
      <div :class="{ 'hidden md:block': mobileTab !== 'home' }" class="space-y-6">
        <DashboardBalanceCards ref="balanceCardsRef" :profile-id="profileId" />

        <div class="hidden md:flex md:justify-end">
          <Button variant="outline" size="sm" @click="transferDialogOpen = true">{{ t('transfer.title') }}</Button>
        </div>

        <div class="bg-card shadow-soft space-y-2 rounded-2xl border p-3 md:hidden">
          <div class="flex gap-2">
            <Input
              v-model="parseText"
              :placeholder="t('dashboard.parsePlaceholder')"
              class="flex-1"
              @keyup.enter="runParse(parseText)"
            />
            <Button :disabled="parsing" :loading="parsing" @click="runParse(parseText)">{{ t('dashboard.send') }}</Button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" @click="openManualAdd">{{ t('dashboard.addManually') }}</Button>
            <Button variant="outline" size="sm" @click="transferDialogOpen = true">{{ t('transfer.title') }}</Button>
          </div>
        </div>

        <div class="md:hidden">
          <h2 class="text-large mb-2">{{ t('dashboard.today') }}</h2>
          <div class="space-y-2">
            <div
              v-for="tx in todayData?.transactions ?? []"
              :key="tx.id"
              class="bg-card shadow-soft flex items-center justify-between rounded-xl border p-3"
            >
              <span class="text-small">{{ tx.description }}</span>
              <span class="text-amount-sm" :class="tx.type === 'income' ? 'text-success' : 'text-destructive'">
                {{ tx.type === 'income' ? '+' : '−' }}฿{{ formatAmount(tx.amount) }}
              </span>
            </div>
            <p v-if="!todayData?.transactions.length" class="text-caption">{{ t('dashboard.noTransactions') }}</p>
          </div>
        </div>
      </div>

      <div :class="{ 'hidden md:block': mobileTab !== 'transactions' }">
        <DashboardTransactionList ref="transactionListRef" :profile-id="profileId" @edit="openEdit" />
      </div>

      <div :class="{ 'hidden md:block': mobileTab !== 'categories' }">
        <DashboardCategoryBreakdown ref="categoryBreakdownRef" :profile-id="profileId" />
      </div>
    </div>

    <DashboardMobileNav />

    <DashboardAddDialog v-model:open="addDialogOpen" @submit-text="runParse" @manual-add="openManualAdd" />

    <LedgerConfirmDialog
      v-model:open="confirmDialogOpen"
      :initial-items="draftItems"
      :profile-id="profileId"
      :categories="categories"
      :editing-id="editingId"
      @saved="refreshAll"
    />

    <LedgerTransferDialog v-model:open="transferDialogOpen" :profile-id="profileId" @saved="refreshAll" />
    </div>
  </div>
</template>
