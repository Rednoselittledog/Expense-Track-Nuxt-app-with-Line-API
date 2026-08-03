<script setup lang="ts">
import type { TabsContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { TabsContent } from 'reka-ui'
import { reactiveOmit } from '@vueuse/core'
import { cn } from '@/lib/utils'

const props = defineProps<TabsContentProps & { class?: HTMLAttributes['class'] }>()
const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <TabsContent data-slot="tabs-content" v-bind="delegatedProps" :class="cn('animate-enter flex-1 outline-none', props.class)">
    <slot />
  </TabsContent>
</template>
