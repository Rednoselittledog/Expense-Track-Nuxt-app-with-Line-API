export interface CycleRange {
  start: string
  end: string
  totalDays: number
  elapsedDays: number
  labelYear: number
  labelMonth: number
}

export function getCycleRange(cycleStartDay: number, referenceDateStr: string): CycleRange {
  const ref = new Date(`${referenceDateStr}T00:00:00`)
  const refDay = ref.getDate()

  let cycleStartYear = ref.getFullYear()
  let cycleStartMonth = ref.getMonth()
  if (refDay < cycleStartDay) {
    cycleStartMonth -= 1
    if (cycleStartMonth < 0) {
      cycleStartMonth = 11
      cycleStartYear -= 1
    }
  }

  const start = new Date(cycleStartYear, cycleStartMonth, cycleStartDay)
  const end = new Date(cycleStartYear, cycleStartMonth + 1, cycleStartDay - 1)

  const dayMs = 24 * 60 * 60 * 1000
  const totalDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1
  const elapsedDays = Math.round((ref.getTime() - start.getTime()) / dayMs) + 1

  const daysInStartMonth = new Date(cycleStartYear, cycleStartMonth + 1, 0).getDate() - cycleStartDay + 1
  const daysInEndMonth = totalDays - daysInStartMonth
  const label =
    daysInStartMonth >= daysInEndMonth
      ? { labelYear: cycleStartYear, labelMonth: cycleStartMonth }
      : { labelYear: end.getFullYear(), labelMonth: end.getMonth() }

  const toISO = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return {
    start: toISO(start),
    end: toISO(end),
    totalDays,
    elapsedDays,
    ...label
  }
}
