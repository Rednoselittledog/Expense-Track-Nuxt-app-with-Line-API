export interface CalibrateOldItem {
  old: string
  affectedCount: number
  affectedSample: { occurred_on: string; amount: number }[]
}

export interface CalibrateInitialGroup {
  new: string
  olds: CalibrateOldItem[]
}
