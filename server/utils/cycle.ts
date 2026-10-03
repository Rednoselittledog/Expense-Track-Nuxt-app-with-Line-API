// Formats using local getters, never toISOString(): the dates here are built as local midnight,
// and on a machine ahead of UTC (this project's own, at +07) toISOString() rolls them back a day.
export function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface CycleRange {
  start: string
  end: string
  totalDays: number
  elapsedDays: number
  labelYear: number
  labelMonth: number
}

export function isWithinCycle(date: string, cycle: CycleRange) {
  return date >= cycle.start && date <= cycle.end
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

  return {
    start: toISODate(start),
    end: toISODate(end),
    totalDays,
    elapsedDays,
    ...label
  }
}
