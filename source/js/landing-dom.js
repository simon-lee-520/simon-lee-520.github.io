/**
 * Landing DOM 动效（与 WebGL 解耦，移动端 fallback 同样生效）
 */
export function initLandingDomEffects () {
  const hero = document.querySelector('.landing-hero-inner')
  if (hero) hero.classList.add('landing-hero-reveal')

  const contentInner = document.querySelector('.landing-content-inner')
  if (contentInner) contentInner.classList.add('landing-content-reveal')
}
