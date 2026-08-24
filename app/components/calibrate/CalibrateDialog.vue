<script setup lang="ts">
import type { CalibrateInitialGroup, CalibrateOldItem } from '~/types/calibrate'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import { Pencil, X, CornerDownRight } from '@lucide/vue'

interface Group {
  id: string
  new: string
  olds: CalibrateOldItem[]
  recheck: boolean
}

const props = defineProps<{
  open: boolean
  initialGroups: CalibrateInitialGroup[]
  profileId: string
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  saved: []
}>()

const { t, locale } = useI18n()

const groups = ref<Group[]>([])
const correctionText = ref('')
const saving = ref(false)
const rechecking = ref(false)
const errorMessage = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      groups.value = props.initialGroups.map((g) => ({ ...g, id: crypto.randomUUID(), recheck: false }))
      correctionText.value = ''
      errorMessage.value = ''
    }
  }
)

const hasRecheckSelection = computed(() => groups.value.some((g) => g.recheck))

function removeGroup(groupId: string) {
  groups.value = groups.value.filter((g) => g.id !== groupId)
}

function removeOld(groupId: string, old: string) {
  groups.value = groups.value
    .map((g) => (g.id === groupId ? { ...g, olds: g.olds.filter((o) => o.old !== old) } : g))
    .filter((g) => g.olds.length > 0)
}

function affectedSampleText(item: CalibrateOldItem) {
  return item.affectedSample.map((s) => `${formatDateShort(s.occurred_on, locale.value)} ฿${formatAmount(s.amount)}`).join(' · ')
}

async function recheck() {
  rechecking.value = true
  errorMessage.value = ''
  try {
    const targets = groups.value.filter((g) => g.recheck)
    const focusOlds = targets.flatMap((g) => g.olds.map((o) => o.old))
    const result = await $fetch<{ groups: CalibrateInitialGroup[] }>('/api/calibrate/analyze', {
      method: 'POST',
      body: { profileId: props.profileId, focusOlds, correction: correctionText.value }
    })
    const untouched = groups.value.filter((g) => !g.recheck)
    const refreshed = result.groups.map((g) => ({ ...g, id: crypto.randomUUID(), recheck: false }))
    groups.value = [...untouched, ...refreshed]
    correctionText.value = ''
  } catch (e) {
    const message = extractErrorMessage(e)
    errorMessage.value = message
    toast.error(message)
  } finally {
    rechecking.value = false
  }
}

async function confirmApply() {
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/calibrate/apply', {
      method: 'POST',
      body: {
        profileId: props.profileId,
        groups: groups.value.map((g) => ({ new: g.new, olds: g.olds.map((o) => o.old) }))
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
  if (saving.value || rechecking.value) e.preventDefault()
}
</script>

<template>
  <Dialog :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <DialogContent class="max-w-2xl" @escape-key-down="preventCloseWhileBusy" @interact-outside="preventCloseWhileBusy">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <span class="bg-primary/12 text-primary flex size-8 items-center justify-center rounded-xl">
            <Pencil class="size-4" />
          </span>
          {{ t('calibrate.title') }}
        </DialogTitle>
      </DialogHeader>

      <p class="text-caption">{{ t('calibrate.subtitle') }}</p>

      <p v-if="groups.length === 0" class="text-caption py-6 text-center">{{ t('calibrate.noSuggestions') }}</p>

      <div v-else class="max-h-[50vh] space-y-3 overflow-y-auto">
        <div v-for="group in groups" :key="group.id" class="overflow-hidden rounded-md border">
          <div v-for="item in group.olds" :key="item.old" class="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
            <span class="text-small flex-1 truncate">{{ item.old }}</span>
            <details class="text-caption">
              <summary class="text-primary cursor-pointer list-none">{{ t('calibrate.affectedCount', { count: item.affectedCount }) }}</summary>
              <p class="text-caption mt-1">{{ affectedSampleText(item) }}</p>
            </details>
            <button type="button" :aria-label="t('calibrate.removeOld')" @click="removeOld(group.id, item.old)">
              <X class="text-muted-foreground size-3.5" />
            </button>
          </div>
          <div class="bg-accent/40 flex items-center gap-2 px-3 py-2">
            <CornerDownRight class="text-muted-foreground size-3.5 shrink-0" />
            <input v-model="group.recheck" type="checkbox" :aria-label="t('calibrate.recheckThis')" />
            <Input v-model="group.new" class="flex-1" />
            <button type="button" :aria-label="t('calibrate.removeGroup')" @click="removeGroup(group.id)">
              <X class="text-muted-foreground size-4" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <Input v-model="correctionText" :placeholder="t('calibrate.correctionPlaceholder')" class="flex-1 border-dashed" />
        <Button variant="outline" :disabled="!hasRecheckSelection || rechecking" :loading="rechecking" @click="recheck">
          {{ t('calibrate.recheckButton') }}
        </Button>
      </div>

      <p v-if="errorMessage" class="text-alert">{{ errorMessage }}</p>

      <DialogFooter>
        <Button variant="outline" @click="cancel">{{ t('actions.cancel') }}</Button>
        <Button :disabled="saving || groups.length === 0" :loading="saving" @click="confirmApply">
          {{ t('calibrate.confirmButton', { count: groups.length }) }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
