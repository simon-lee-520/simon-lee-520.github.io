'use strict'

const BADGE_MAP = {
  original: { label: '原创', className: 'copyright-badge copyright-badge--original' },
  repost: { label: '转载', className: 'copyright-badge copyright-badge--repost' },
  原创: { label: '原创', className: 'copyright-badge copyright-badge--original' },
  转载: { label: '转载', className: 'copyright-badge copyright-badge--repost' }
}

hexo.extend.helper.register('copyrightBadge', function (copyrightType) {
  const type = copyrightType || 'original'
  return BADGE_MAP[type] || BADGE_MAP.original
})
