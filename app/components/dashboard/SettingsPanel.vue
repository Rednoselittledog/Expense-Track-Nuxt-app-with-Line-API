<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'vue-sonner'
import { SlidersHorizontal, Wallet, Check, TriangleAlert, Tags } from '@lucide/vue'

const { t, locale: uiLocale, setLocale } = useI18n()
const colorMode = useColorMode()
const palette = usePalette()

const { data: profile } = await useCurrentProfile()
const profileId = computed(() => profile.value?.id ?? '')

// same keys BalanceCards.vue uses for these — reuses its cached result instead of
// re-fetching, so switching to this tab is instant just like transactions/categories
const { data: dailySummary, pending: dailyPending } = useAsyncData(
  'balance-cards-daily',
  () => $fetch<{ monthlyAmount: number }>('/api/summary', { query: { profileId: profileId.value, view: 'daily' } }),
  { watch: [profileId], lazy: true }
)
const { data: fixedSummary, pending: fixedPending } = useAsyncData(
  'balance-cards-fixed',
  () => $fetch<{ budgeted: number }>('/api/summary', { query: { profileId: profileId.value, view: 'fixed' } }),
  { watch: [profileId], lazy: true }
)

const locale = ref<'th' | 'en'>('th')
const cycleStartDay = ref(1)
const budgetFund = ref<'daily' | 'fixed'>('daily')
const dailyAmount = ref(0)
const dailyCurrentAmount = ref(0)
const fixedAmount = ref(0)
const fixedCurrentAmount = ref(0)
const budgetEffective = ref<'now' | 'next_cycle'>('now')
const saving = ref(false)
const descriptionVocabulary = ref('')
const descriptionVocabularyUpdatedAt = ref<string | null>(null)
const refreshingVocabulary = ref(false)

const activeAmount = computed({
  get: () => (budgetFund.value === 'daily' ? dailyAmount.value : fixedAmount.value),
  set: (v: number) => {
    if (budgetFund.value === 'daily') dailyAmount.value = v
    else fixedAmount.value = v
  }
})
const activeCurrentAmount = computed(() => (budgetFund.value === 'daily' ? dailyCurrentAmount.value : fixedCurrentAmount.value))

watchEffect(() => {
  if (profile.value) {
    locale.value = profile.value.locale
    cycleStartDay.value = profile.value.cycle_start_day
    descriptionVocabulary.value = profile.value.description_vocabulary
    descriptionVocabularyUpdatedAt.value = profile.value.description_vocabulary_updated_at
  }
  if (dailySummary.value) {
    dailyAmount.value = dailySummary.value.monthlyAmount
    dailyCurrentAmount.value = dailySummary.value.monthlyAmount
  }
  if (fixedSummary.value) {
    fixedAmount.value = fixedSummary.value.budgeted
    fixedCurrentAmount.value = fixedSummary.value.budgeted
  }
})

// apply immediately on pick, like theme — don't gate a language switch behind a "Save"
// label the user might not be able to read yet
watch(locale, (newLocale) => {
  setLocale(newLocale)
})

async function confirmSave() {
  saving.value = true
  try {
    await $fetch('/api/profile', {
      method: 'PATCH',
      body: {
        profileId: profileId.value,
        locale: locale.value,
        cycle_start_day: cycleStartDay.value,
        description_vocabulary: descriptionVocabulary.value
      }
    })
    if (dailyAmount.value !== dailyCurrentAmount.value) {
      await $fetch('/api/budget-rates', {
        method: 'POST',
        body: {
          profileId: profileId.value,
          fund: 'daily',
          monthly_amount: dailyAmount.value,
          effective: budgetEffective.value
        }
      })
      dailyCurrentAmount.value = dailyAmount.value
    }
    if (fixedAmount.value !== fixedCurrentAmount.value) {
      await $fetch('/api/budget-rates', {
        method: 'POST',
        body: {
          profileId: profileId.value,
          fund: 'fixed',
          monthly_amount: fixedAmount.value,
          effective: budgetEffective.value
        }
      })
      fixedCurrentAmount.value = fixedAmount.value
    }
    toast.success(t('toast.saved'))
    navigateTo('/')
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    saving.value = false
  }
}

const resetDialogOpen = ref(false)
const resetting = ref(false)

async function confirmReset() {
  resetting.value = true
  try {
    const result = await $fetch<{ deletedCount: number }>('/api/reset', {
      method: 'POST',
      body: { profileId: profileId.value }
    })
    resetDialogOpen.value = false
    toast.success(t('toast.resetDone', { count: result.deletedCount }))
    navigateTo('/')
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    resetting.value = false
  }
}

function preventCloseWhileResetting(e: Event) {
  if (resetting.value) e.preventDefault()
}

function formatUpdatedAt(iso: string) {
  return new Intl.DateTimeFormat(uiLocale.value === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso)
  )
}

async function refreshVocabulary() {
  refreshingVocabulary.value = true
  try {
    const result = await $fetch<{ description_vocabulary: string }>('/api/vocabulary/refresh', {
      method: 'POST',
      body: { profileId: profileId.value }
    })
    descriptionVocabulary.value = result.description_vocabulary
    descriptionVocabularyUpdatedAt.value = new Date().toISOString()
    toast.success(t('toast.vocabularyRefreshed'))
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    refreshingVocabulary.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="text-h3 mb-6">{{ t('settings.title') }}</h1>

    <div class="grid gap-4 md:grid-cols-2">
      <Card class="animate-enter">
        <CardHeader>
          <CardTitle class="text-eyebrow flex items-center gap-1.5">
            <SlidersHorizontal class="size-3.5" />
            {{ t('settings.preferences') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-5">
          <div>
            <label class="text-small mb-2 block">{{ t('settings.theme') }}</label>
            <RadioGroup v-model="colorMode.preference" class="flex gap-4" orientation="horizontal">
              <label class="text-small flex items-center gap-1.5">
                <RadioGroupItem value="system" />
                {{ t('settings.themeSystem') }}
              </label>
              <label class="text-small flex items-center gap-1.5">
                <RadioGroupItem value="light" />
                {{ t('settings.themeLight') }}
              </label>
              <label class="text-small flex items-center gap-1.5">
                <RadioGroupItem value="dark" />
                {{ t('settings.themeDark') }}
              </label>
            </RadioGroup>
          </div>

          <div>
            <label class="text-small mb-2 block">{{ t('settings.language') }}</label>
            <RadioGroup v-model="locale" class="flex gap-4" orientation="horizontal">
              <label class="text-small flex items-center gap-1.5">
                <RadioGroupItem value="th" />
                {{ t('settings.languageThai') }}
              </label>
              <label class="text-small flex items-center gap-1.5">
                <RadioGroupItem value="en" />
                {{ t('settings.languageEnglish') }}
              </label>
            </RadioGroup>
          </div>

          <div>
            <label class="text-small mb-2 block">{{ t('settings.palette') }}</label>
            <ClientOnly>
              <div class="flex flex-wrap gap-3">
                <button
                  v-for="p in PALETTES"
                  :key="p.value"
                  type="button"
                  class="flex flex-col items-center gap-1"
                  :aria-pressed="palette === p.value"
                  :aria-label="t(`settings.paletteNames.${p.value}`)"
                  @click="palette = p.value"
                >
                  <span
                    class="ring-offset-background flex size-9 items-center justify-center rounded-full shadow-sm ring-offset-2 transition-all"
                    :class="palette === p.value ? 'ring-2 scale-105' : 'ring-1 ring-border hover:scale-105'"
                    :style="{ backgroundColor: p.color, '--tw-ring-color': p.color }"
                  >
                    <Check v-if="palette === p.value" class="size-4 text-white drop-shadow" />
                  </span>
                  <span class="text-caption">{{ t(`settings.paletteNames.${p.value}`) }}</span>
                </button>
              </div>
              <template #fallback>
                <div class="flex flex-wrap gap-3">
                  <div v-for="p in PALETTES" :key="p.value" class="flex flex-col items-center gap-1">
                    <span class="bg-muted size-9 rounded-full" />
                    <span class="text-caption opacity-0">{{ t(`settings.paletteNames.${p.value}`) }}</span>
                  </div>
                </div>
              </template>
            </ClientOnly>
          </div>
        </CardContent>
      </Card>

      <Card class="animate-enter" style="animation-delay: 60ms">
        <CardHeader>
          <CardTitle class="text-eyebrow flex items-center gap-1.5">
            <Wallet class="size-3.5" />
            {{ t('settings.budget') }}
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <label class="text-small mb-2 block">{{ t('settings.budgetFund') }}</label>
            <Tabs v-model="budgetFund" class="mb-3">
              <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger value="daily">{{ t('dashboard.daily') }}</TabsTrigger>
                <TabsTrigger value="fixed">{{ t('dashboard.fixed') }}</TabsTrigger>
              </TabsList>
            </Tabs>

            <label class="text-small mb-2 block">{{ t('settings.monthlyBudget') }}</label>
            <Skeleton v-if="dailyPending || fixedPending" class="h-9 w-full" />
            <Input
              v-else
              type="number"
              :model-value="activeAmount"
              @update:model-value="(v: unknown) => (activeAmount = Number(v))"
            />
            <RadioGroup
              v-if="activeAmount !== activeCurrentAmount"
              v-model="budgetEffective"
              class="text-caption mt-2 flex gap-4"
              orientation="horizontal"
            >
              <label class="flex items-center gap-1.5">
                <RadioGroupItem value="now" />
                {{ t('settings.effectiveNow') }}
              </label>
              <label class="flex items-center gap-1.5">
                <RadioGroupItem value="next_cycle" />
                {{ t('settings.effectiveNextCycle') }}
              </label>
            </RadioGroup>
          </div>

          <div>
            <label class="text-small mb-2 block">{{ t('settings.cycleStartDay') }}</label>
            <Input
              type="number"
              :model-value="cycleStartDay"
              @update:model-value="(v: unknown) => (cycleStartDay = Number(v))"
            />
            <p v-if="profile && cycleStartDay !== profile.cycle_start_day" class="text-alert mt-2">
              {{ t('settings.cycleStartWarning') }}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card class="animate-enter mt-4" style="animation-delay: 90ms">
      <CardHeader>
        <CardTitle class="text-eyebrow flex items-center gap-1.5">
          <Tags class="size-3.5" />
          {{ t('settings.vocabularyTitle') }}
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <p class="text-caption">{{ t('settings.vocabularyCaption') }}</p>
        <textarea
          v-model="descriptionVocabulary"
          :placeholder="t('settings.vocabularyPlaceholder')"
          rows="3"
          class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 md:text-sm"
        />
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-caption">
            {{
              descriptionVocabularyUpdatedAt
                ? t('settings.vocabularyUpdatedAt', { date: formatUpdatedAt(descriptionVocabularyUpdatedAt) })
                : t('settings.vocabularyNeverUpdated')
            }}
          </p>
          <Button variant="outline" size="sm" :disabled="refreshingVocabulary" :loading="refreshingVocabulary" @click="refreshVocabulary">
            {{ t('settings.vocabularyRefresh') }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" as-child class="flex-1 sm:w-32 sm:flex-none">
        <NuxtLink to="/">{{ t('actions.cancel') }}</NuxtLink>
      </Button>
      <Button :disabled="saving" :loading="saving" class="flex-1 sm:w-32 sm:flex-none" @click="confirmSave">
        {{ saving ? t('actions.saving') : t('actions.save') }}
      </Button>
    </div>

    <Card class="animate-enter border-destructive/30 mt-4" style="animation-delay: 120ms">
      <CardHeader>
        <CardTitle class="text-eyebrow text-destructive flex items-center gap-1.5">
          <TriangleAlert class="size-3.5" />
          {{ t('settings.dangerZone') }}
        </CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-caption sm:max-w-md">{{ t('settings.resetDatabaseCaption') }}</p>
        <Button variant="destructive" class="shrink-0" @click="resetDialogOpen = true">
          {{ t('settings.resetDatabase') }}
        </Button>
      </CardContent>
    </Card>

    <Dialog v-model:open="resetDialogOpen">
      <DialogContent class="max-w-sm" @escape-key-down="preventCloseWhileResetting" @interact-outside="preventCloseWhileResetting">
        <DialogHeader>
          <DialogTitle class="text-destructive flex items-center gap-2">
            <span class="bg-destructive/12 text-destructive flex size-8 items-center justify-center rounded-xl">
              <TriangleAlert class="size-4" />
            </span>
            {{ t('settings.resetConfirmTitle') }}
          </DialogTitle>
        </DialogHeader>
        <p class="text-small">{{ t('settings.resetConfirmBody') }}</p>
        <DialogFooter>
          <Button variant="outline" :disabled="resetting" @click="resetDialogOpen = false">{{ t('actions.cancel') }}</Button>
          <Button variant="destructive" :disabled="resetting" :loading="resetting" @click="confirmReset">
            {{ resetting ? t('actions.saving') : t('settings.resetConfirmButton') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
