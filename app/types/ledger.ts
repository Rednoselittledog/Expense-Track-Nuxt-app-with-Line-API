export type Fund = 'daily' | 'fixed' | 'savings'

export const FUNDS: Fund[] = ['daily', 'fixed', 'savings']

export interface LedgerRow {
  id: string
  type: 'expense' | 'income'
  amount: number
  description: string
  occurred_on: string
  category: { major: string; sub: string } | null
  allocations: { fund: Fund; amount: number }[]
}
