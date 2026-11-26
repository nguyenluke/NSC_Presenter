import type { OutputProfile } from '@shared/types'

type ThemeSettings = Pick<OutputProfile, 'languageMode' | 'verticalAlign' | 'primaryFontSize' |
  'secondaryFontSize' | 'primaryColor' | 'secondaryColor'>

export interface PresentationTheme {
  id: string
  name: string
  description: string
  settings: ThemeSettings
}

export const PRESENTATION_THEMES: PresentationTheme[] = [
  { id: 'sanctuary', name: 'Center Bilingual', description: 'White + Gold', settings: {
    languageMode: 'both', verticalAlign: 'center', primaryFontSize: 64, secondaryFontSize: 42,
    primaryColor: '#FFFFFF', secondaryColor: '#FCD34D'
  } },
  { id: 'topBilingual', name: 'Top Bilingual', description: 'White + Gold · Top', settings: {
    languageMode: 'both', verticalAlign: 'top', primaryFontSize: 64, secondaryFontSize: 42,
    primaryColor: '#FFFFFF', secondaryColor: '#FCD34D'
  } },
  { id: 'bilingualCyan', name: 'Modern Bilingual', description: 'White + Ice Blue', settings: {
    languageMode: 'both', verticalAlign: 'center', primaryFontSize: 64, secondaryFontSize: 42,
    primaryColor: '#FFFFFF', secondaryColor: '#67E8F9'
  } },
  { id: 'lowerThird', name: 'Lower Third', description: 'Bilingual · Bottom', settings: {
    languageMode: 'both', verticalAlign: 'bottom', primaryFontSize: 48, secondaryFontSize: 34,
    primaryColor: '#FFFFFF', secondaryColor: '#FCD34D'
  } },
  { id: 'vnOnly', name: 'Single Language', description: 'Primary · Extra Bold', settings: {
    languageMode: 'primary', verticalAlign: 'center', primaryFontSize: 72, secondaryFontSize: 42,
    primaryColor: '#FFFFFF', secondaryColor: '#FCD34D'
  } }
]
