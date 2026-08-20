<script setup lang="ts">
import type { LedgerRow } from '~/types/ledger'
import type { CategoryContext } from '~~/server/utils/types'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import { ListChecks } from '@lucide/vue'

type DraftItem = Omit<LedgerRow, 'id'>

const props = defineProps<{
  open: boolean
  initialItems: DraftItem[]
  profileId: string
  categories: CategoryContext[]
  editingId?: string | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  saved: []
}>()

const { t } = useI18n()

const rows = ref<LedgerRow[]>([])
const correctionText = ref('')
const saving = ref(false)
const rechecking = ref(false)
const errorMessage = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      rows.value = props.initialItems.map((item) => ({ ...item, id: crypto.randomUUID() }))
      correctionText.value = ''
      errorMessage.value = ''
    }
  }
)

const hasCorrection = computed(() => correctionText.value.trim().length > 0)

function stripId(row: LedgerRow): DraftItem {
  const { id, ...rest } = row
  return rest
}

async function recheck() {
  rechecking.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<{ items: DraftItem[] }>('/api/parse', {
      method: 'POST',
      body: {
        profileId: props.profileId,
        text: correctionText.value,
        previousItems: rows.value.map(stripId)
      }
    })
    rows.value = result.items.map((item) => ({ ...item, id: crypto.randomUUID() }))
    correctionText.value = ''
  } catch (e) {
    const message = extractErrorMessage(e)
    errorMessage.value = message
    toast.error(message)
  } finally {
    rechecking.value = false
  }
}

async function confirmSave() {
  saving.value = true
  errorMessage.value = ''
  try {
    const result = props.editingId
      ? await $fetch<{ updated: true; createdCategories: string[] }>(`/api/transactions/${props.editingId}`, {
          method: 'PATCH',
          body: { profileId: props.profileId, item: stripId(rows.value[0]!) }
        })
      : await $fetch<{ insertedIds: string[]; createdCategories: string[] }>('/api/transactions', {
          method: 'POST',
          body: { profileId: props.profileId, items: rows.value.map(stripId) }
        })
    emit('update:open', false)
    emit('saved')
    toast.success(t('toast.saved'))
    for (const name of result.createdCategories) {
      toast.info(t('toast.categoryCreated', { name }))
    }
  } catch (e) {
    const message = extractErrorMessage(e)
    errorMessage.value = message
    toast.error(message)
  } finally {
    saving.value = false
  }
}

function handlePrimaryAction() {
  if (hasCorrection.value) {
    recheck()
  } else {
    confirmSave()
  }
}

function cancel() {
  emit('update:open', false)
}

function preventCloseWhileBusy(e: Event) {
  if (saving.value || rechecking.value) e.preventDefault()
}
</script>

<template>
  <Dialog :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <DialogContent class="max-w-3xl" @escape-key-down="preventCloseWhileBusy" @interact-outside="preventCloseWhileBusy">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <span class="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-xl">
            <ListChecks class="size-4" />
          </span>
          {{ editingId ? t('ledger.editTitle') : t('ledger.confirmTitle', { count: rows.length }) }}
        </DialogTitle>
      </DialogHeader>

      <LedgerEditor v-model="rows" :categories="categories" :single="!!editingId" />

      <Input
        v-if="!editingId"
        v-model="correctionText"
        :placeholder="t('ledger.correctionPlaceholder')"
        class="border-dashed"
      />

      <p v-if="errorMessage" class="text-alert">{{ errorMessage }}</p>

      <DialogFooter>
        <Button variant="outline" @click="cancel">{{ t('actions.cancel') }}</Button>
        <Button :disabled="saving || rechecking" :loading="saving || rechecking" @click="handlePrimaryAction">
          {{
            rechecking
              ? t('actions.rechecking')
              : saving
                ? t('actions.saving')
                : hasCorrection
                  ? t('actions.recheck')
                  : editingId
                    ? t('actions.save')
                    : t('actions.confirm')
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
