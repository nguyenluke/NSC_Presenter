import React, { useEffect, useRef, useState } from 'react'
import { LivePresentationState, OutputProfile } from '@shared/types'
import { AudienceCanvas } from './AudienceCanvas'
import { StageMonitorCanvas } from './StageMonitorCanvas'

interface ScaledMonitorFrameProps {
  liveState: LivePresentationState
  profile: OutputProfile
  className?: string
}

export const ScaledMonitorFrame: React.FC<ScaledMonitorFrameProps> = ({
  liveState,
  profile,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.2)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateScale = (): void => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const scaleX = rect.width / 1920
        const scaleY = rect.height / 1080
        setScale(Math.min(scaleX, scaleY))
      }
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative bg-black flex items-center justify-center overflow-hidden ${className}`}
    >
      <div
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0
        }}
      >
        {profile.screenType === 'stage' ? (
          <StageMonitorCanvas liveState={liveState} profile={profile} />
        ) : (
          <AudienceCanvas liveState={liveState} profile={profile} />
        )}
      </div>
    </div>
  )
}
