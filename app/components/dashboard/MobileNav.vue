<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Home, ListChecks, PieChart, Settings, Plus } from '@lucide/vue'

const { t } = useI18n()
const route = useRoute()

const activeTab = computed(() => (route.query.tab as string) ?? 'home')

const leftItems = computed(() => [
  { key: 'home' as const, label: t('nav.home'), icon: Home, to: { path: '/' } },
  { key: 'transactions' as const, label: t('nav.transactions'), icon: ListChecks, to: { path: '/', query: { tab: 'transactions' } } }
])
const rightItems = computed(() => [
  {
    key: 'categories' as const,
    label: t('nav.categories'),
    icon: PieChart,
    to: { path: '/', query: { tab: 'categories' } }
  }
])
</script>

<template>
  <nav
    class="glass-panel shadow-soft-lg border-border/60 fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 items-end rounded-3xl border pt-1 md:hidden"
    style="padding-bottom: max(env(safe-area-inset-bottom), 0.4rem)"
  >
    <Tooltip v-for="item in leftItems" :key="item.key">
      <TooltipTrigger as-child>
        <NuxtLink
          :to="item.to"
          class="mx-1 flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors"
          :class="activeTab === item.key ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'"
        >
          <component :is="item.icon" class="size-5" />
          <span class="text-caption">{{ item.label }}</span>
        </NuxtLink>
      </TooltipTrigger>
      <TooltipContent>{{ item.label }}</TooltipContent>
    </Tooltip>

    <div class="flex justify-center">
      <Tooltip>
        <TooltipTrigger as-child>
          <NuxtLink
            :to="{ path: '/', query: { add: '1' } }"
            class="bg-brand-gradient text-primary-foreground shadow-soft-lg -translate-y-4 flex size-13 items-center justify-center rounded-full transition-transform active:scale-95 hover:scale-105"
            :aria-label="t('dashboard.addManually')"
          >
            <Plus class="size-6" />
          </NuxtLink>
        </TooltipTrigger>
        <TooltipContent>{{ t('dashboard.addManually') }}</TooltipContent>
      </Tooltip>
    </div>

    <Tooltip v-for="item in rightItems" :key="item.key">
      <TooltipTrigger as-child>
        <NuxtLink
          :to="item.to"
          class="mx-1 flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors"
          :class="activeTab === item.key ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'"
        >
          <component :is="item.icon" class="size-5" />
          <span class="text-caption">{{ item.label }}</span>
        </NuxtLink>
      </TooltipTrigger>
      <TooltipContent>{{ item.label }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <NuxtLink
          :to="{ path: '/', query: { tab: 'settings' } }"
          class="mx-1 flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors"
          :class="activeTab === 'settings' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'"
        >
          <Settings class="size-5" />
          <span class="text-caption">{{ t('settings.title') }}</span>
        </NuxtLink>
      </TooltipTrigger>
      <TooltipContent>{{ t('settings.title') }}</TooltipContent>
    </Tooltip>
  </nav>
</template>
