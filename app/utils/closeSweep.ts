import type { Fund } from '../types/ledger'

export type SweepFund = 'daily' | 'fixed'
export const SWEEP_FUNDS: SweepFund[] = ['daily', 'fixed']

export interface SweepStep {
  fund: SweepFund
  amount: number
  from: Fund
  to: Fund
}

const MIN_AMOUNT = 0.01

// Turns the counted end-of-cycle balances into the transfers that empty daily and fixed.
// Pure because each branch moves real money: a fund that ended negative was overspent, and the
// cash for that genuinely came out of savings — so it settles the other way round, or daily never
// reaches zero and the "close the cycle" banner can never be cleared. Funds already moved are
// skipped so retrying after a half-finished sweep doesn't transfer the same money twice.
// See scripts/closeSweep.check.ts.
export function planCloseSweep(
  actuals: Record<SweepFund, number>,
  alreadySwept: SweepFund[] = []
): SweepStep[] {
  const steps: SweepStep[] = []
  for (const fund of SWEEP_FUNDS) {
    if (alreadySwept.includes(fund)) continue
    const amount = Math.round(actuals[fund] * 100) / 100
    if (Math.abs(amount) < MIN_AMOUNT) continue
    steps.push({
      fund,
      amount: Math.abs(amount),
      from: amount > 0 ? fund : 'savings',
      to: amount > 0 ? 'savings' : fund
    })
  }
  return steps
}
