import type { PaletteName } from '~/composables/usePalette'
import { PALETTES } from '~/composables/usePalette'

export default defineNuxtPlugin(() => {
  const palette = usePalette()
  const valid = new Set(PALETTES.map((p) => p.value))

  const stored = localStorage.getItem('palette')
  if (stored && valid.has(stored as PaletteName)) {
    palette.value = stored as PaletteName
  }

  // apply immediately for a flash-free first paint — safe because the only template that reads
  // `palette` reactively (the settings swatch picker) is wrapped in <ClientOnly>, so there's no
  // SSR-rendered markup for it to mismatch against during hydration
  document.documentElement.dataset.palette = palette.value

  watch(palette, (value) => {
    document.documentElement.dataset.palette = value
    localStorage.setItem('palette', value)
  })
})
