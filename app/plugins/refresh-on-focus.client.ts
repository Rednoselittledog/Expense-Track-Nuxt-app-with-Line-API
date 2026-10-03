// data goes stale while the tab sits in the background (or the phone sleeps on the PWA),
// so re-fetch every useAsyncData key when the user comes back instead of making them reload
export default defineNuxtPlugin(() => {
  let hiddenAt = 0

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now()
      return
    }
    // ponytail: fixed 30s staleness window, make it per-key if some endpoint gets expensive
    if (Date.now() - hiddenAt > 30_000) refreshNuxtData()
  })
})
