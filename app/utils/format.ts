export function formatDateShort(dateStr: string, locale: string) {
  const date = new Date(`${dateStr}T00:00:00`)
  return new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    day: 'numeric',
    month: 'short'
  }).format(date)
}

export function formatMonthYear(year: number, month: number, locale: string) {
  const date = new Date(year, month, 1)
  return new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    month: 'long',
    year: 'numeric'
  }).format(date)
}

export function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)
}
