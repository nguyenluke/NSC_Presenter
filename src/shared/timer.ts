import type { LivePresentationState } from './types'

export function tickTimer(state: LivePresentationState): LivePresentationState {
  if (!state.timerRunning) return state
  return { ...state, timerSeconds: state.timerSeconds + (state.timerMode === 'countdown' ? -1 : 1) }
}

export function timerDisplay(seconds: number, mode: LivePresentationState['timerMode']) {
  const total = Math.floor(Math.abs(seconds))
  const time = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  const expired = mode === 'countdown' && seconds <= 0
  const urgent = mode === 'countdown' && seconds > 0 && seconds <= 60
  return { time: mode === 'countdown' && seconds < 0 ? `+${time}` : time,
    label: mode === 'countdown' ? (seconds < 0 ? 'OVERTIME' : 'TIMER') : 'ELAPSED', expired, urgent,
    textClass: expired ? 'text-red-400' : urgent ? 'text-amber-300' : 'text-emerald-400' }
}
