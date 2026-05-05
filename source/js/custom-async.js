// 用户交互后，自动播放音乐
document.addEventListener(
  'click',
  function () {
    const ap = window.aplayers[0]
    try {
      ap?.play()
    } catch (error) {
      console.log('自动播放失败，需要用户交互:', error)
    }
  },
  { once: true },
)
