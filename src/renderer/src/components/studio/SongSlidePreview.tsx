import React from 'react'
import { BilingualSlide, LivePresentationState, OutputProfile } from '@shared/types'
import { ScaledMonitorFrame } from '../outputs/ScaledMonitorFrame'

const FALLBACK_PROFILE: OutputProfile = {
  id: 'preview', name: 'Slide Preview', screenType: 'audience', enabled: false,
  windowMode: 'virtual', assignedDisplayId: null, languageMode: 'both',
  primaryFontSize: 64, secondaryFontSize: 42, primaryColor: '#FFFFFF',
  secondaryColor: '#FCD34D', dimOpacity: 0.35, verticalAlign: 'center'
}

// Use the actual audience compositor so slide text scales and aligns consistently
// in Show, Edit, Reflow, the live monitor, and physical output windows.
export const SongSlidePreview: React.FC<{
  slide: BilingualSlide
  profile?: OutputProfile
  liveState: LivePresentationState
  className?: string
}> = ({ slide, profile, liveState, className = 'w-full aspect-video' }) => (
  <ScaledMonitorFrame
    profile={{ ...(profile ?? FALLBACK_PROFILE), screenType: 'audience' }}
    liveState={{ ...liveState, currentSlide: { ...slide, sectionId: 'preview', sectionLabel: 'Preview',
      sectionType: 'Verse', globalIndex: 0 }, nextSlide: null, clearText: false,
      blackout: false, showLogo: false, foregroundMedia: null, audienceMessage: '' }}
    staticMedia
    className={className}
  />
)
