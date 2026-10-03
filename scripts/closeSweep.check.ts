// Self-check for the cycle-close sweep. Lives outside app/utils so Nuxt's auto-import scan
// never picks up a module with top-level assertions.
//
//   node --experimental-strip-types scripts/closeSweep.check.ts
import assert from 'node:assert/strict'
import { planCloseSweep } from '../app/utils/closeSweep.ts'

// leftover in both funds — both go into savings
assert.deepEqual(planCloseSweep({ daily: 300, fixed: 500 }), [
  { fund: 'daily', amount: 300, from: 'daily', to: 'savings' },
  { fund: 'fixed', amount: 500, from: 'fixed', to: 'savings' }
])

// the reported bug: an overspent fund settles the other way, so it still lands on zero
assert.deepEqual(planCloseSweep({ daily: -200, fixed: 0 }), [
  { fund: 'daily', amount: 200, from: 'savings', to: 'daily' }
])

// mixed signs are settled independently, not netted
assert.deepEqual(planCloseSweep({ daily: -200, fixed: 500 }), [
  { fund: 'daily', amount: 200, from: 'savings', to: 'daily' },
  { fund: 'fixed', amount: 500, from: 'fixed', to: 'savings' }
])

// an empty cycle moves nothing, and neither do rounding crumbs
assert.deepEqual(planCloseSweep({ daily: 0, fixed: 0 }), [])
assert.deepEqual(planCloseSweep({ daily: 0.004, fixed: -0.004 }), [])

// a retry after a half-finished sweep must not move the same money again
assert.deepEqual(planCloseSweep({ daily: 300, fixed: 500 }, ['daily']), [
  { fund: 'fixed', amount: 500, from: 'fixed', to: 'savings' }
])
assert.deepEqual(planCloseSweep({ daily: 300, fixed: 500 }, ['daily', 'fixed']), [])

console.log('closeSweep: all checks passed')
