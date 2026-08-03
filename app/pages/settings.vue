<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'vue-sonner'
import { ArrowLeft, SlidersHorizontal, Wallet, Check, TriangleAlert } from '@lucide/vue'

const { t, setLocale } = useI18n()
const colorMode = useColorMode()
const palette = usePalette()

const { data: profile } = await useCurrentProfile()
const profileId = computed(() => profile.value?.id ?? '')

const { data: dailySummary } = await useAsyncData(
  'settings-daily-summary',
  () => $fetch<{ monthlyAmount: number }>('/api/summary', { query: { profileId: profileId.value, view: 'daily' } }),
  { watch: [profileId] }
)
const { data: fixedSummary } = await useAsyncData(
  'settings-fixed-summary',
  () => $fetch<{ budgeted: number }>('/api/summary', { query: { profileId: profileId.value, view: 'fixed' } }),
  { watch: [profileId] }
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
      body: { profileId: profileId.value, locale: locale.value, cycle_start_day: cycleStartDay.value }
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
</script>

<template>
  <div class="bg-hero-gradient mx-auto max-w-md p-4 pb-20 md:max-w-3xl md:pb-8 md:p-8">
    <header class="mb-6 flex items-center gap-3">
      <NuxtLink
        to="/"
        class="hover:bg-accent flex size-9 items-center justify-center rounded-full transition-colors"
        :aria-label="t('actions.cancel')"
      >
        <ArrowLeft class="size-5" />
      </NuxtLink>
      <h1 class="text-h3">{{ t('settings.title') }}</h1>
    </header>

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
            <Input
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

    <DashboardMobileNav />
  </div>
</template>
