<script setup lang="ts">
import type { Fund } from '~/types/ledger'
import { FUNDS } from '~/types/ledger'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'vue-sonner'
import { ArrowLeftRight } from '@lucide/vue'

const props = defineProps<{
  open: boolean
  profileId: string
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  saved: []
}>()

const { t } = useI18n()

const amount = ref(0)
const from = ref<Fund>('daily')
const to = ref<Fund>('savings')
const occurredOn = ref(todayInTimezone())
const note = ref('')
const saving = ref(false)
const errorMessage = ref('')

const sameFund = computed(() => from.value === to.value)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      amount.value = 0
      from.value = 'daily'
      to.value = 'savings'
      occurredOn.value = todayInTimezone()
      note.value = ''
      errorMessage.value = ''
    }
  }
)

async function confirmSave() {
  if (sameFund.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/transfers', {
      method: 'POST',
      body: {
        profileId: props.profileId,
        amount: amount.value,
        from: from.value,
        to: to.value,
        occurred_on: occurredOn.value,
        note: note.value || undefined
      }
    })
    emit('update:open', false)
    emit('saved')
    toast.success(t('toast.saved'))
  } catch (e) {
    const message = extractErrorMessage(e)
    errorMessage.value = message
    toast.error(message)
  } finally {
    saving.value = false
  }
}

function cancel() {
  emit('update:open', false)
}

function preventCloseWhileBusy(e: Event) {
  if (saving.value) e.preventDefault()
}
</script>

<template>
  <Dialog :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <DialogContent class="max-w-md" @escape-key-down="preventCloseWhileBusy" @interact-outside="preventCloseWhileBusy">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <span class="flex size-8 items-center justify-center rounded-xl" style="background: color-mix(in oklch, var(--chart-1) 15%, transparent); color: var(--chart-1)">
            <ArrowLeftRight class="size-4" />
          </span>
          {{ t('transfer.title') }}
        </DialogTitle>
      </DialogHeader>

      <div class="space-y-3">
        <div class="flex items-end gap-2">
          <div class="flex-1">
            <label class="text-small mb-1 block">{{ t('transfer.from') }}</label>
            <Select v-model="from">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="fund in FUNDS" :key="fund" :value="fund">
                  {{ t(`ledger.fund${fund.charAt(0).toUpperCase()}${fund.slice(1)}`) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ArrowLeftRight class="text-muted-foreground mb-2 size-4 shrink-0" />
          <div class="flex-1">
            <label class="text-small mb-1 block">{{ t('transfer.to') }}</label>
            <Select v-model="to">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="fund in FUNDS" :key="fund" :value="fund">
                  {{ t(`ledger.fund${fund.charAt(0).toUpperCase()}${fund.slice(1)}`) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p v-if="sameFund" class="text-alert">{{ t('transfer.sameFund') }}</p>
        <div>
          <label class="text-small mb-1 block">{{ t('transfer.amount') }}</label>
          <Input
            type="number"
            :model-value="amount"
            @update:model-value="(v: unknown) => (amount = Number(v))"
          />
        </div>
        <div>
          <label class="text-small mb-1 block">{{ t('transfer.date') }}</label>
          <Input
            type="date"
            :model-value="occurredOn"
            @update:model-value="(v: unknown) => (occurredOn = String(v))"
          />
        </div>
        <div>
          <label class="text-small mb-1 block">{{ t('transfer.note') }}</label>
          <Input :model-value="note" @update:model-value="(v: unknown) => (note = String(v))" />
        </div>
      </div>

      <p v-if="errorMessage" class="text-alert">{{ errorMessage }}</p>

      <DialogFooter>
        <Button variant="outline" @click="cancel">{{ t('actions.cancel') }}</Button>
        <Button :disabled="saving || sameFund" :loading="saving" @click="confirmSave">
          {{ saving ? t('actions.saving') : t('actions.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
