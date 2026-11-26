import type { CustomTextLayout } from './types'

export const DEFAULT_TEXT_LAYOUT: CustomTextLayout = { x: 50, y: 50, width: 88, align: 'center', languageGap: 28 }
const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback

export function normalizeTextLayout(value?: Partial<CustomTextLayout>): CustomTextLayout {
  return { x: clamp(value?.x, 0, 100, 50), y: clamp(value?.y, 0, 100, 50),
    width: clamp(value?.width, 20, 98, 88), languageGap: clamp(value?.languageGap, 0, 100, 28),
    align: value?.align === 'left' || value?.align === 'right' ? value.align : 'center' }
}

export function customTextGeometry(layout: CustomTextLayout, textHeight: number, noticeBottom: number) {
  const width = Math.min(1888, 1920 * layout.width / 100)
  const safeTop = Math.min(1064, Math.max(16, noticeBottom > 0 ? noticeBottom + 32 : 16))
  const availableHeight = Math.max(0, 1080 - safeTop - 16)
  const height = Math.min(Math.max(0, textHeight), availableHeight)
  const left = Math.max(16, Math.min(1920 - width - 16, 1920 * layout.x / 100 - width / 2))
  const top = Math.max(safeTop, Math.min(1080 - height - 16, 1080 * layout.y / 100 - height / 2))
  return { left, top, width, maxHeight: availableHeight }
}
