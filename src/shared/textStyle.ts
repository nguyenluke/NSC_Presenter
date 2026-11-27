import type { TextStyle } from './types'

export const FONT_FAMILIES = ['Arial', 'Arial Black', 'Aptos', 'Calibri', 'Cambria', 'Georgia', 'Helvetica',
  'Impact', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New']

export function textStyle(style: TextStyle | undefined, secondary: boolean) {
  return {
    fontFamily: style?.fontFamily ? `"${style.fontFamily.replace(/["\\\r\n]/g, '')}", sans-serif` : undefined,
    fontWeight: style?.bold === undefined ? (secondary ? 500 : 700) : style.bold ? 700 : 400,
    fontStyle: (style?.italic === undefined ? secondary : style.italic) ? 'italic' as const : 'normal' as const,
    letterSpacing: style?.tracking === undefined ? undefined : `${Math.max(-3, Math.min(12, style.tracking))}px`,
    // scaleX also works for installed fonts that do not provide condensed/expanded faces.
    transform: style?.stretch && style.stretch !== 100 ? `translateX(-50%) scaleX(${Math.max(70, Math.min(140, style.stretch)) / 100})` : undefined,
    width: style?.stretch && style.stretch !== 100 ? `${10000 / Math.max(70, Math.min(140, style.stretch))}%` : undefined,
    position: style?.stretch && style.stretch !== 100 ? 'relative' as const : undefined,
    left: style?.stretch && style.stretch !== 100 ? '50%' : undefined,
    transformOrigin: 'center center'
  }
}
