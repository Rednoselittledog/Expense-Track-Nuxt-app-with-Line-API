<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Sparkles } from '@lucide/vue'

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submitText: [text: string]
  manualAdd: []
}>()

const { t } = useI18n()

const text = ref('')
const submitting = ref(false)
const inputRef = ref<InstanceType<typeof Input> | null>(null)

watch(open, (isOpen) => {
  if (isOpen) {
    text.value = ''
    nextTick(() => inputRef.value?.$el?.querySelector('input')?.focus())
  }
})

async function send() {
  if (!text.value.trim()) return
  submitting.value = true
  try {
    emit('submitText', text.value)
  } finally {
    submitting.value = false
  }
}

function manualAdd() {
  emit('manualAdd')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <span class="bg-brand-gradient flex size-8 items-center justify-center rounded-xl">
            <Sparkles class="text-primary-foreground size-4" />
          </span>
          {{ t('dashboard.addEntry') }}
        </DialogTitle>
      </DialogHeader>

      <div class="flex gap-2">
        <Input ref="inputRef" v-model="text" :placeholder="t('dashboard.parsePlaceholder')" class="flex-1" @keyup.enter="send" />
        <Button :disabled="submitting" :loading="submitting" @click="send">{{ t('dashboard.send') }}</Button>
      </div>

      <button type="button" class="text-small text-primary text-left underline underline-offset-2" @click="manualAdd">
        {{ t('dashboard.addManually') }}
      </button>
    </DialogContent>
  </Dialog>
</template>
