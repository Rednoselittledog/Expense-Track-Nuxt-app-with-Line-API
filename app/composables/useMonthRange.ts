export function useMonthRange() {
  const { locale } = useI18n()
  const today = new Date()
  const viewYear = ref(today.getFullYear())
  const viewMonth = ref(today.getMonth())

  const range = computed(() => {
    const from = new Date(viewYear.value, viewMonth.value, 1)
    const to = new Date(viewYear.value, viewMonth.value + 1, 0)
    return { from: toISODate(from), to: toISODate(to) }
  })

  const monthLabel = computed(() => formatMonthYear(viewYear.value, viewMonth.value, locale.value))

  function prevMonth() {
    if (viewMonth.value === 0) {
      viewMonth.value = 11
      viewYear.value -= 1
    } else {
      viewMonth.value -= 1
    }
  }

  function nextMonth() {
    if (viewMonth.value === 11) {
      viewMonth.value = 0
      viewYear.value += 1
    } else {
      viewMonth.value += 1
    }
  }

  return { viewYear, viewMonth, range, monthLabel, prevMonth, nextMonth }
}
