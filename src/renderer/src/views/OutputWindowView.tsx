import React, { useEffect } from 'react'
import { ScaledMonitorFrame } from '../components/outputs/ScaledMonitorFrame'
import { useStudioStore } from '../store/useStudioStore'

export const OutputWindowView: React.FC<{ profileId: string }> = ({ profileId }) => {
  const { initialized, bootstrap, liveState, outputProfiles } = useStudioStore()

  useEffect(() => {
    if (!initialized) {
      bootstrap()
    }
  }, [initialized, bootstrap])

  const profile = outputProfiles.find((p) => p.id === profileId)
  if (!profile) {
    return <div className="w-screen h-screen bg-black" />
  }

  return <ScaledMonitorFrame liveState={liveState} profile={profile} className="w-screen h-screen" />
}

export const IdentifyBadgeView: React.FC<{ num: string; label: string }> = ({ num, label }) => {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-transparent">
      <div className="w-[520px] h-[230px] rounded-3xl bg-[#18191c]/95 border-4 border-orange-500 shadow-2xl flex flex-col items-center justify-center text-center px-6">
        <div className="text-xs font-bold tracking-[0.25em] text-orange-400 uppercase">
          NSC Presenter Detected Screen
        </div>
        <div className="text-6xl font-black text-white mt-1">SCREEN {num}</div>
        <div className="text-sm font-mono text-zinc-300 mt-2 truncate max-w-full">{label}</div>
      </div>
    </div>
  )
}
