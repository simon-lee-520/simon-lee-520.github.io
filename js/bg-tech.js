async function bootLandingBackground () {
  if (window.__landingBgInited) return
  if (!document.body.classList.contains('page-landing')) return

  try {
    const { initLandingBackground } = await import('./landing-bg/index.js')
    initLandingBackground()
  } catch (err) {
    console.error('[landing-bg] failed to load', err)
    document.body.classList.add('landing-fallback-static')
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootLandingBackground)
} else {
  bootLandingBackground()
}
