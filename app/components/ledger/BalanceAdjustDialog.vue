<script setup lang="ts">
import type { Fund } from '~/types/ledger'
import { FUNDS } from '~/types/ledger'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'vue-sonner'
import { Scale } from '@lucide/vue'

const props = defineProps<{
  open: boolean
  profileId: string
  current: number
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  saved: []
}>()

const { t } = useI18n()

const actual = ref(0)
// where the difference lands. Daily by default: an unrecorded expense is almost always a
// day-to-day one, and that's the pot it should come out of
const fund = ref<Fund>('daily')
const saving = ref(false)
const errorMessage = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      actual.value = props.current
      fund.value = 'daily'
      errorMessage.value = ''
    }
  }
)

const delta = computed(() => Math.round((actual.value - props.current) * 100) / 100)
const canSubmit = computed(() => Math.abs(delta.value) >= 0.01)

async function confirmSave() {
  if (!canSubmit.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/reconcile', {
      method: 'POST',
      body: {
        profileId: props.profileId,
        total: { actual: actual.value, fund: fund.value }
      }
    })
    emit('update:open', false)
    emit('saved')
    toast.success(t('toast.balanceAdjusted', { amount: formatAmount(Math.abs(delta.value)) }))
  } catch (e) {
    const message = extractErrorMessage(e)
    errorMessage.value = message
    toast.error(message)
  } finally {
    saving.value = false
  }
}

function preventCloseWhileBusy(e: Event) {
  if (saving.value) e.preventDefault()
}
</script>

<template>
  <Dialog :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <DialogContent class="max-w-sm" @escape-key-down="preventCloseWhileBusy" @interact-outside="preventCloseWhileBusy">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <span class="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-xl">
            <Scale class="size-4" />
          </span>
          {{ t('balance.adjustTitle') }}
        </DialogTitle>
      </DialogHeader>

      <p class="text-caption">{{ t('balance.adjustSubtitle') }}</p>

      <div class="space-y-3">
        <div>
          <label class="text-small mb-1 flex items-baseline justify-between gap-2">
            <span>{{ t('balance.countedLabel') }}</span>
            <span class="text-caption">{{ t('balance.inSystem', { amount: formatAmount(current) }) }}</span>
          </label>
          <Input type="number" :model-value="actual" @update:model-value="(v: unknown) => (actual = Number(v))" />
        </div>

        <div v-if="canSubmit">
          <p class="text-small mb-1" :class="delta > 0 ? 'text-success' : 'text-destructive'">
            {{ delta > 0 ? '+' : '−' }}฿{{ formatAmount(Math.abs(delta)) }}
            ·
            {{ delta > 0 ? t('balance.deltaUp') : t('balance.deltaDown') }}
          </p>
          <label class="text-small mb-1 block">{{ t('balance.absorbFund') }}</label>
          <Select v-model="fund">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="f in FUNDS" :key="f" :value="f">
                {{ t(`ledger.fund${f.charAt(0).toUpperCase()}${f.slice(1)}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-caption mt-1">{{ t('balance.absorbHint') }}</p>
        </div>
      </div>

      <p v-if="errorMessage" class="text-alert">{{ errorMessage }}</p>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">{{ t('actions.cancel') }}</Button>
        <Button :disabled="saving || !canSubmit" :loading="saving" @click="confirmSave">
          {{ saving ? t('actions.saving') : t('balance.confirmButton') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
