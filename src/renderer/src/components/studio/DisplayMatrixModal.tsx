import React, { useState } from 'react'
import {
  AlertTriangle,
  Download,
  Eye,
  Monitor,
  Plus,
  RefreshCw,
  Trash2,
  Tv,
  Upload,
  X
} from 'lucide-react'
import { DisplayInfo, LanguageMode, OutputProfile, ScreenType } from '@shared/types'

interface DisplayMatrixModalProps {
  displays: DisplayInfo[]
  profiles: OutputProfile[]
  storagePath: string
  onClose: () => void
  onRefreshDisplays: () => Promise<void>
  onIdentifyDisplays: () => Promise<void>
  onCreateProfile: (screenType: ScreenType, assignedDisplayId?: number | null) => Promise<OutputProfile>
  onUpdateProfile: (profile: OutputProfile) => Promise<void>
  onDeleteProfile: (id: string) => Promise<void>
  onExportBackup: () => Promise<boolean>
  onImportBackup: () => Promise<boolean>
}

/**
 * ProPresenter 7 "Screens -> Configure Screens" Window:
 * - Recognizes ANY number of real HDMI / DisplayPort / USB-C screens plugged into your PC.
 * - Lets you freely add (+), rename, or delete (-) Audience Screens and Stage Screens
 *   (whether you use 1 screen, 2 screens, 4 screens, or 6 screens!).
 */
export const DisplayMatrixModal: React.FC<DisplayMatrixModalProps> = ({
  displays,
  profiles,
  storagePath,
  onClose,
  onRefreshDisplays,
  onIdentifyDisplays,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onExportBackup,
  onImportBackup
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    profiles[0]?.id ?? ''
  )
  const [backupNotice, setBackupNotice] = useState('')

  const audienceProfiles = profiles.filter((p) => p.screenType === 'audience')
  const stageProfiles = profiles.filter((p) => p.screenType === 'stage')
  const selectedProfile =
    profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null

  const externalCount = displays.filter((d) => !d.isPrimary).length

  const handleAddScreen = async (type: ScreenType, displayId?: number): Promise<void> => {
    const created = await onCreateProfile(type, displayId ?? null)
    setSelectedProfileId(created.id)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-5xl h-[86vh] bg-[#232529] border border-[#3a3d46] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* TOP HEADER */}
        <div className="px-5 py-3.5 bg-[#2b2d31] border-b border-[#18191c] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Monitor className="w-4 h-4 text-orange-400" />
              Configure Screens (ProPresenter Multi-Display Setup)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Connected Hardware: <b>{displays.length} total screen{displays.length > 1 ? 's' : ''}</b>{' '}
              ({externalCount} external HDMI/DisplayPort screen{externalCount === 1 ? '' : 's'} detected)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onIdentifyDisplays}
              className="px-3 py-1.5 rounded-md bg-orange-500/20 border border-orange-500/50 text-orange-300 text-xs font-bold hover:bg-orange-500/30 flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              Identify Physical Screens
            </button>
            <button
              onClick={onRefreshDisplays}
              className="px-3 py-1.5 rounded-md bg-[#363942] hover:bg-[#414550] text-xs font-semibold text-white flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Detect Plugged Cables
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[#383b44] text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* VISUAL HARDWARE MAP OF PLUGGED-IN MONITORS */}
        <div className="px-5 py-3 bg-[#1a1b1e] border-b border-[#2e3138]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Physical Monitors Connected to This Computer (Click an external monitor to create a screen on it)
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {displays.map((d) => {
              const assignedScreens = profiles.filter((p) => p.assignedDisplayId === d.id)
              return (
                <div
                  key={d.id}
                  className={`min-w-[210px] p-3 rounded-lg border flex flex-col justify-between ${
                    d.isPrimary
                      ? 'bg-[#23252a] border-[#3a3d46]'
                      : 'bg-[#1e2636] border-blue-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-white">SCREEN {d.index}</span>
                    {d.isPrimary ? (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-700 text-[10px] font-semibold text-zinc-200">
                        Your Operator Desk
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                        External Output
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 text-xs text-zinc-300 truncate">{d.label}</div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    {d.width} × {d.height}
                  </div>

                  {assignedScreens.length > 0 ? (
                    <div className="mt-2 text-[10px] font-semibold text-orange-300 truncate">
                      Assigned: {assignedScreens.map((s) => s.name).join(', ')}
                    </div>
                  ) : !d.isPrimary ? (
                    <div className="mt-2 flex gap-1">
                      <button
                        onClick={() => handleAddScreen('audience', d.id)}
                        className="flex-1 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[10px] font-bold text-white"
                      >
                        + Use as Audience
                      </button>
                      <button
                        onClick={() => handleAddScreen('stage', d.id)}
                        className="flex-1 py-1 rounded bg-purple-600 hover:bg-purple-500 text-[10px] font-bold text-white"
                      >
                        + Use as Stage
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 text-[10px] text-zinc-500">
                      Control window lives here
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* MAIN PROPRESENTER SPLIT: Left = Audience & Stage Screen Lists | Right = Selected Screen Settings */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT LIST: Add/Select Any Number of Audience or Stage Screens */}
          <div className="w-72 bg-[#1e2024] border-r border-[#32353e] flex flex-col justify-between p-3 overflow-y-auto">
            <div className="space-y-5">
              {/* Audience Screens Group */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Audience Screens ({audienceProfiles.length})
                  </span>
                  <button
                    onClick={() => handleAddScreen('audience')}
                    className="px-2 py-0.5 rounded bg-[#2e323b] hover:bg-blue-600 text-xs font-bold text-white flex items-center gap-1"
                    title="Add another Audience Screen (LED, Side TV, Lobby...)"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                <div className="space-y-1">
                  {audienceProfiles.map((p) => {
                    const isSelected = selectedProfile?.id === p.id
                    const targetDisp = displays.find((d) => d.id === p.assignedDisplayId)
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProfileId(p.id)}
                        className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#2563eb] text-white'
                            : 'bg-[#262930] hover:bg-[#30343d] text-zinc-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                p.enabled ? 'bg-emerald-400' : 'bg-zinc-500'
                              }`}
                            />
                            {p.name}
                          </div>
                          <div
                            className={`text-[10px] truncate mt-0.5 ${
                              isSelected ? 'text-blue-100' : 'text-zinc-400'
                            }`}
                          >
                            {p.windowMode === 'virtual'
                              ? 'Virtual Preview Window'
                              : targetDisp
                                ? `Screen ${targetDisp.index} (${targetDisp.width}×${targetDisp.height})`
                                : 'Auto External Screen'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Stage Screens Group */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Stage Screens ({stageProfiles.length})
                  </span>
                  <button
                    onClick={() => handleAddScreen('stage')}
                    className="px-2 py-0.5 rounded bg-[#2e323b] hover:bg-purple-600 text-xs font-bold text-white flex items-center gap-1"
                    title="Add a Stage Confidence Screen (Back TV, Pastor Monitor...)"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                <div className="space-y-1">
                  {stageProfiles.map((p) => {
                    const isSelected = selectedProfile?.id === p.id
                    const targetDisp = displays.find((d) => d.id === p.assignedDisplayId)
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProfileId(p.id)}
                        className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#7c3aed] text-white'
                            : 'bg-[#262930] hover:bg-[#30343d] text-zinc-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                p.enabled ? 'bg-emerald-400' : 'bg-zinc-500'
                              }`}
                            />
                            {p.name}
                          </div>
                          <div
                            className={`text-[10px] truncate mt-0.5 ${
                              isSelected ? 'text-purple-100' : 'text-zinc-400'
                            }`}
                          >
                            {p.windowMode === 'virtual'
                              ? 'Virtual Preview Window'
                              : targetDisp
                                ? `Screen ${targetDisp.index} (${targetDisp.width}×${targetDisp.height})`
                                : 'Auto External Screen'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#16171a] border border-[#2c2f37] text-[11px] text-zinc-400 leading-relaxed">
              <b className="text-zinc-200">Safety Tip:</b> If an output window ever covers your main screen, just press <b>ESC</b> to close that output immediately!
            </div>
          </div>

          {/* RIGHT INSPECTOR: Configure Selected Screen */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedProfile ? (
              <div className="max-w-2xl space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-[#343741]">
                  <div className="flex items-center gap-3 flex-1 mr-4">
                    <Tv className="w-5 h-5 text-orange-400 shrink-0" />
                    <input
                      value={selectedProfile.name}
                      onChange={(e) =>
                        onUpdateProfile({ ...selectedProfile, name: e.target.value })
                      }
                      className="px-3 py-1.5 rounded bg-[#16171a] border border-[#3a3d46] text-sm font-bold text-white w-72 focus:outline-none focus:border-orange-500"
                    />
                    <span className="px-2 py-0.5 rounded bg-[#32353f] text-[10px] font-bold uppercase text-zinc-300">
                      {selectedProfile.screenType}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        onUpdateProfile({
                          ...selectedProfile,
                          enabled: !selectedProfile.enabled
                        })
                      }
                      className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition ${
                        selectedProfile.enabled
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-[#343741] hover:bg-[#414552] text-zinc-200'
                      }`}
                    >
                      {selectedProfile.enabled ? '● Screen is ON' : 'Turn Screen ON'}
                    </button>

                    {profiles.length > 1 && (
                      <button
                        onClick={() => onDeleteProfile(selectedProfile.id)}
                        className="p-2 rounded-lg bg-[#2e2225] hover:bg-red-600 text-red-300 hover:text-white"
                        title="Delete this Screen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Choose Which Physical Monitor This Screen Uses */}
                <div className="grid grid-cols-2 gap-4 bg-[#1b1c20] p-4 rounded-xl border border-[#32353e]">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      1. Output Mode
                    </label>
                    <select
                      value={selectedProfile.windowMode}
                      onChange={(e) =>
                        onUpdateProfile({
                          ...selectedProfile,
                          windowMode: e.target.value as 'fullscreen' | 'virtual'
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#121316] border border-[#3a3d46] text-xs font-semibold text-white"
                    >
                      <option value="fullscreen">
                        Real Fullscreen TV / LED Projector
                      </option>
                      <option value="virtual">
                        Virtual Floating Window (Test on 1 Laptop)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      2. Choose Connected Monitor / HDMI Port
                    </label>
                    <select
                      value={selectedProfile.assignedDisplayId ?? ''}
                      onChange={(e) =>
                        onUpdateProfile({
                          ...selectedProfile,
                          assignedDisplayId: e.target.value ? Number(e.target.value) : null
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#121316] border border-[#3a3d46] text-xs font-semibold text-white"
                    >
                      <option value="">Auto-Pick First External Screen</option>
                      {displays.map((d) => (
                        <option key={d.id} value={d.id}>
                          Screen {d.index}: {d.width}×{d.height}{' '}
                          {d.isPrimary ? '⚠️ (Your Main Desk Screen)' : '✓ (External)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProfile.windowMode === 'fullscreen' &&
                    displays.find((d) => d.id === selectedProfile.assignedDisplayId)?.isPrimary && (
                      <div className="col-span-2 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center gap-2 text-xs text-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        You selected your Primary Desk Screen for Fullscreen. Remember you can press <b>ESC</b> anytime to exit fullscreen!
                      </div>
                    )}
                </div>

                {/* Typography & Bilingual Settings */}
                <div className="grid grid-cols-2 gap-4 bg-[#1b1c20] p-4 rounded-xl border border-[#32353e]">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Languages Displayed on This Screen
                    </label>
                    <select
                      value={selectedProfile.languageMode}
                      onChange={(e) =>
                        onUpdateProfile({
                          ...selectedProfile,
                          languageMode: e.target.value as LanguageMode
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#121316] border border-[#3a3d46] text-xs text-white"
                    >
                      <option value="both">Both Languages (Language 1 + 2)</option>
                      <option value="primary">Language 1 Only (e.g. Vietnamese)</option>
                      <option value="secondary">Language 2 Only (e.g. English)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Font Sizes (Language 1 / Language 2)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={28}
                        max={130}
                        value={selectedProfile.primaryFontSize}
                        onChange={(e) =>
                          onUpdateProfile({
                            ...selectedProfile,
                            primaryFontSize: Number(e.target.value)
                          })
                        }
                        className="w-1/2 px-3 py-2 rounded-lg bg-[#121316] border border-[#3a3d46] text-xs font-mono text-white"
                      />
                      <input
                        type="number"
                        min={22}
                        max={100}
                        value={selectedProfile.secondaryFontSize}
                        onChange={(e) =>
                          onUpdateProfile({
                            ...selectedProfile,
                            secondaryFontSize: Number(e.target.value)
                          })
                        }
                        className="w-1/2 px-3 py-2 rounded-lg bg-[#121316] border border-[#3a3d46] text-xs font-mono text-amber-300"
                      />
                    </div>
                  </div>

                  {selectedProfile.screenType === 'audience' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                          Lyric Position on Screen
                        </label>
                        <select
                          value={selectedProfile.verticalAlign}
                          onChange={(e) =>
                            onUpdateProfile({
                              ...selectedProfile,
                              verticalAlign: e.target.value as OutputProfile['verticalAlign']
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#121316] border border-[#3a3d46] text-xs text-white"
                        >
                          <option value="top">Top (Upper Screen)</option>
                          <option value="center">Centered (Standard LED / Projector)</option>
                          <option value="bottom">Lower-Third Bottom (Livestream / Side TV)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                          Background Darkener ({Math.round(selectedProfile.dimOpacity * 100)}%)
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={0.85}
                          step={0.05}
                          value={selectedProfile.dimOpacity}
                          onChange={(e) =>
                            onUpdateProfile({
                              ...selectedProfile,
                              dimOpacity: Number(e.target.value)
                            })
                          }
                          className="w-full accent-orange-500 mt-2"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* FOOTER: Portable Church Backup / Sync + Done */}
        <div className="px-5 py-3 bg-[#2b2d31] border-t border-[#18191c] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const ok = await onExportBackup()
                if (ok) setBackupNotice('Backup exported successfully!')
              }}
              className="px-3 py-1.5 rounded bg-[#383b44] hover:bg-[#444854] text-zinc-100 font-semibold flex items-center gap-1.5"
              title="Save all songs & screen setups to bring to the Church PC"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Export Library Backup
            </button>
            <button
              onClick={async () => {
                const ok = await onImportBackup()
                if (ok) setBackupNotice('Library restored successfully!')
              }}
              className="px-3 py-1.5 rounded bg-[#383b44] hover:bg-[#444854] text-zinc-100 font-semibold flex items-center gap-1.5"
              title="Load a backup file from home onto the Church PC"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              Restore Library Backup
            </button>
            {backupNotice && (
              <span className="text-emerald-400 font-semibold ml-2">{backupNotice}</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-500 truncate max-w-xs">
              {storagePath}
            </span>
            <button
              onClick={onClose}
              className="px-5 py-1.5 rounded-md bg-orange-500 hover:bg-orange-400 text-white font-bold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
