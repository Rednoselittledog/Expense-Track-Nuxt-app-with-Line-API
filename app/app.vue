<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
</script>

<template>
  <TooltipProvider>
    <NuxtLoadingIndicator color="var(--primary)" />
    <NuxtPage />
    <Toaster />
  </TooltipProvider>
</template>
