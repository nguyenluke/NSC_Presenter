import React from 'react'
import { LivePresentationState, MediaAsset, OutputProfile } from '@shared/types'

interface AudienceCanvasProps {
  liveState: LivePresentationState
  profile: OutputProfile
}

function MediaLayer({ asset }: { asset: MediaAsset | null }): React.ReactElement | null {
  if (!asset) return null

  if (asset.mediaType === 'atmosphere') {
    return (
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{ background: asset.url }}
      />
    )
  }

  if (asset.mediaType === 'video') {
    return (
      <video
        key={asset.url}
        src={asset.url}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full transition-opacity duration-500"
        style={{ objectFit: asset.fitMode }}
      />
    )
  }

  return (
    <img
      key={asset.url}
      src={asset.url}
      alt={asset.title}
      className="absolute inset-0 w-full h-full transition-opacity duration-500"
      style={{ objectFit: asset.fitMode }}
    />
  )
}

export const AudienceCanvas: React.FC<AudienceCanvasProps> = ({ liveState, profile }) => {
  const showBg = !liveState.clearBackground && !liveState.blackout
  const showForegroundGraphic = Boolean(liveState.foregroundMedia) && !liveState.blackout
  const showLyrics =
    Boolean(liveState.currentSlide) &&
    !liveState.clearText &&
    !liveState.foregroundMedia &&
    !liveState.showLogo &&
    !liveState.blackout

  const slide = liveState.currentSlide
  const showPrimary =
    slide && (profile.languageMode === 'both' || profile.languageMode === 'primary')
  const showSecondary =
    slide &&
    Boolean(slide.secondaryText?.trim()) &&
    (profile.languageMode === 'both' || profile.languageMode === 'secondary')

  return (
    <div className="relative w-[1920px] h-[1080px] bg-black overflow-hidden select-none">
      {/* LAYER 1: Seamless Visual Design / Motion Loop Background */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          showBg ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <MediaLayer asset={liveState.activeBackground} />
      </div>

      {/* LAYER 2A: Readability Scrim */}
      {showBg && !showForegroundGraphic && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ backgroundColor: `rgba(0, 0, 0, ${profile.dimOpacity})` }}
        />
      )}

      {/* LAYER 2B: Standalone Sermon / Event Design Graphic */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          showForegroundGraphic ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none'
        }`}
      >
        <MediaLayer asset={liveState.foregroundMedia} />
      </div>

      {/* LAYER 3: Dual-Language Worship / Scripture Lyrics Compositor */}
      <div
        className={`absolute inset-0 z-10 flex flex-col px-28 transition-opacity duration-200 ${
          profile.verticalAlign === 'bottom' ? 'justify-end pb-24' : 'justify-center'
        } ${showLyrics ? 'opacity-100' : 'opacity-0'}`}
      >
        {slide && (
          <div className="w-full text-center space-y-7">
            {showPrimary && (
              <p
                className="font-bold tracking-tight whitespace-pre-line leading-[1.24]"
                style={{
                  fontSize: `${profile.primaryFontSize}px`,
                  color: profile.primaryColor,
                  textShadow:
                    '0 4px 22px rgba(0,0,0,0.92), 0 2px 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)'
                }}
              >
                {slide.primaryText}
              </p>
            )}

            {showSecondary && (
              <p
                className="font-medium italic tracking-wide whitespace-pre-line leading-[1.28]"
                style={{
                  fontSize: `${profile.secondaryFontSize}px`,
                  color: profile.secondaryColor,
                  textShadow:
                    '0 4px 18px rgba(0,0,0,0.92), 0 2px 5px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)'
                }}
              >
                {slide.secondaryText}
              </p>
            )}
          </div>
        )}
      </div>

      {/* LAYER 3.5: ProPresenter Audience Message / Childcare Ticker Banner (Top Ribbon) */}
      {liveState.audienceMessage.trim() !== '' && !liveState.blackout && (
        <div className="absolute top-8 inset-x-20 z-30 flex justify-center">
          <div className="px-10 py-4 rounded-2xl bg-black/80 border-2 border-amber-400/70 backdrop-blur-md shadow-2xl">
            <p className="text-4xl font-bold text-amber-200 tracking-wide text-center">
              {liveState.audienceMessage}
            </p>
          </div>
        </div>
      )}

      {/* LAYER 4A: Church Welcome / Logo Override */}
      <div
        className={`absolute inset-0 z-30 bg-black flex items-center justify-center transition-opacity duration-300 ${
          liveState.showLogo && !liveState.blackout
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {liveState.logoMedia && liveState.logoMedia.mediaType !== 'atmosphere' ? (
          <MediaLayer asset={liveState.logoMedia} />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center"
            style={{
              background:
                liveState.logoMedia?.url ||
                'radial-gradient(circle at 50% 50%, #1d4ed8 0%, #090b0f 75%)'
            }}
          >
            <div className="px-14 py-8 rounded-3xl border-2 border-white/20 bg-black/30 backdrop-blur-md text-center">
              <div className="text-7xl font-black tracking-[0.22em] text-white">NSC CHURCH</div>
              <div className="mt-4 text-3xl font-medium tracking-[0.3em] text-amber-300 uppercase">
                Welcome Home • Chào Mừng Hội Thánh
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LAYER 4B: Master Blackout Override */}
      <div
        className={`absolute inset-0 z-40 bg-black transition-opacity duration-300 ${
          liveState.blackout ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
    </div>
  )
}
