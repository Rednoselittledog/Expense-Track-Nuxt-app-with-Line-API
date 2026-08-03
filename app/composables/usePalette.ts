export const PALETTES = [
  { value: 'sunset', color: '#c9541f' },
  { value: 'forest', color: '#1f8a4c' },
  { value: 'ocean', color: '#1f6fc9' },
  { value: 'grape', color: '#7c3fc9' },
  { value: 'berry', color: '#c9317a' },
  { value: 'amber', color: '#a6660a' }
] as const

export type PaletteName = (typeof PALETTES)[number]['value']

export function usePalette() {
  return useState<PaletteName>('palette', () => 'sunset')
}
