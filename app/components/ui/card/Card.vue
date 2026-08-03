<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="card"
    :class="
      cn(
        'bg-card text-card-foreground shadow-soft flex flex-col gap-6 rounded-2xl border py-6 transition-shadow',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
