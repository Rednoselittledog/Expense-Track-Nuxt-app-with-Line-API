export function toCsv(rows: string[][]): string {
  const escapeCell = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')
}
