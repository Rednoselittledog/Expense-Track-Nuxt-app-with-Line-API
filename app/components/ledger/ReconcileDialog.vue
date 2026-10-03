<script setup lang="ts">
import type { Fund } from '~/types/ledger'
import { FUNDS } from '~/types/ledger'
import type { SweepFund } from '~/utils/closeSweep'
import { planCloseSweep } from '~/utils/closeSweep'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import { Scale } from '@lucide/vue'

const props = defineProps<{
  open: boolean
  profileId: string
  current: Record<Fund, number>
  // closing a cycle: date the entries at that cycle's end instead of today, and offer to sweep
  // what's left in daily/fixed into savings — otherwise that money vanishes when the cycle resets
  occurredOn?: string
  closingLabel?: string
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  saved: []
}>()

const { t } = useI18n()

const actuals = ref<Record<Fund, number>>({ daily: 0, fixed: 0, savings: 0 })
const saving = ref(false)
const errorMessage = ref('')
const sweep = ref(true)

const closing = computed(() => !!props.closingLabel)

// after reconciling, daily/fixed hold exactly what the user typed — so that figure is also what
// the sweep moves. No recomputation needed between the two steps.
const sweepAmount = computed(() =>
  closing.value ? Math.round((actuals.value.daily + actuals.value.fixed) * 100) / 100 : 0
)

// which funds have actually been moved, so a retry after a mid-sweep failure doesn't transfer the
// same money twice. Each transfer is its own request and there is no batch endpoint to make them
// one unit, so the client has to remember what already landed.
const swept = ref<SweepFund[]>([])
const sweepSteps = computed(() => planCloseSweep(actuals.value, swept.value))
const canSweep = computed(() => closing.value && sweep.value && sweepSteps.value.length > 0)

// seeded with what the system already thinks, so an untouched fund has a zero delta and is
// left alone — the user only types the funds they actually counted
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      actuals.value = { ...props.current }
      errorMessage.value = ''
      sweep.value = true
      swept.value = []
    }
  }
)

const deltas = computed(
  () =>
    Object.fromEntries(
      FUNDS.map((fund) => [fund, Math.round((actuals.value[fund] - props.current[fund]) * 100) / 100])
    ) as Record<Fund, number>
)

const changed = computed(() => FUNDS.filter((fund) => Math.abs(deltas.value[fund]) >= 0.01))

const canSubmit = computed(() => changed.value.length > 0 || canSweep.value)

async function confirmSave() {
  if (!canSubmit.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    let adjusted = 0
    if (changed.value.length) {
      const result = await $fetch<{ adjustments: { fund: Fund }[] }>('/api/reconcile', {
        method: 'POST',
        body: {
          profileId: props.profileId,
          occurred_on: props.occurredOn,
          targets: changed.value.map((fund) => ({ fund, actual: actuals.value[fund] }))
        }
      })
      adjusted = result.adjustments.length
    }

    // sweep second, never first: moving the money before the books match reality would carry the
    // unrecorded difference into savings, where nothing resets it and the error compounds
    if (closing.value && sweep.value) {
      // re-planned on every attempt: a step that already landed is dropped, so a retry after a
      // failure finishes the sweep instead of repeating it
      for (const step of planCloseSweep(actuals.value, swept.value)) {
        await $fetch('/api/transfers', {
          method: 'POST',
          body: {
            profileId: props.profileId,
            amount: step.amount,
            from: step.from,
            to: step.to,
            occurred_on: props.occurredOn,
            note: t('close.sweepNote', { cycle: props.closingLabel })
          }
        })
        swept.value.push(step.fund)
      }
    }

    emit('update:open', false)
    emit('saved')
    toast.success(
      closing.value && sweep.value
        ? t('toast.cycleClosed', { amount: formatAmount(Math.abs(sweepAmount.value)) })
        : t('toast.reconcileDone', { count: adjusted })
    )
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
    <DialogContent class="max-w-md" @escape-key-down="preventCloseWhileBusy" @interact-outside="preventCloseWhileBusy">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <span class="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-xl">
            <Scale class="size-4" />
          </span>
          {{ closing ? t('close.title', { cycle: closingLabel }) : t('reconcile.title') }}
        </DialogTitle>
      </DialogHeader>

      <p class="text-caption">{{ closing ? t('close.subtitle') : t('reconcile.subtitle') }}</p>

      <div class="space-y-3">
        <div v-for="fund in FUNDS" :key="fund">
          <label class="text-small mb-1 flex items-baseline justify-between gap-2">
            <span>{{ t(`ledger.fund${fund.charAt(0).toUpperCase()}${fund.slice(1)}`) }}</span>
            <span class="text-caption">{{ t('reconcile.inSystem', { amount: formatAmount(current[fund]) }) }}</span>
          </label>
          <Input
            type="number"
            :model-value="actuals[fund]"
            @update:model-value="(v: unknown) => (actuals[fund] = Number(v))"
          />
          <p
            v-if="Math.abs(deltas[fund]) >= 0.01"
            class="text-caption mt-1"
            :class="deltas[fund] > 0 ? 'text-success' : 'text-destructive'"
          >
            {{ deltas[fund] > 0 ? '+' : '−' }}฿{{ formatAmount(Math.abs(deltas[fund])) }}
            ·
            {{ deltas[fund] > 0 ? t('reconcile.deltaUp') : t('reconcile.deltaDown') }}
          </p>
        </div>
      </div>

      <label v-if="closing" class="bg-accent/40 flex items-start gap-2 rounded-xl border p-3">
        <input v-model="sweep" type="checkbox" class="mt-0.5 size-4 shrink-0" />
        <span>
          <span class="text-small block">
            {{
              sweepAmount >= 0
                ? t('close.sweepLabel', { amount: formatAmount(sweepAmount) })
                : t('close.sweepCoverLabel', { amount: formatAmount(-sweepAmount) })
            }}
          </span>
          <span class="text-caption">{{ t('close.sweepHint') }}</span>
        </span>
      </label>

      <p v-if="errorMessage" class="text-alert">{{ errorMessage }}</p>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">{{ t('actions.cancel') }}</Button>
        <Button :disabled="saving || !canSubmit" :loading="saving" @click="confirmSave">
          {{
            saving
              ? t('actions.saving')
              : closing
                ? t('close.confirmButton')
                : t('reconcile.confirmButton', { count: changed.length })
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
