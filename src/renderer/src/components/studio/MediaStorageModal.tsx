import React, { useEffect, useState } from 'react'
import { Folder, X } from 'lucide-react'
import { MediaStorageStatus } from '@shared/types'

export const MediaStorageModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [status, setStatus] = useState<MediaStorageStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let mounted = true
    window.nscApi.mediaStorageStatus().then((data) => { if (mounted) setStatus(data) })
      .catch((err: Error) => { if (mounted) setError(err.message) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [busy, onClose])

  const chooseFolder = async (): Promise<void> => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await window.nscApi.chooseMediaFolder()
      if (result) {
        setStatus(result)
        setNotice(`Media folder saved. ${result.copied} file${result.copied === 1 ? '' : 's'} copied. Your originals remain in the previous folder.`)
      }
    } catch (err) {
      setError(err instanceof Error
        ? err.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
        : 'Could not change your media folder.')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="media-folder-title"
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-xl border border-[#3a3d46] bg-[#232529] shadow-2xl text-zinc-200">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#3a3d46]">
          <h2 id="media-folder-title" className="text-sm font-bold flex items-center gap-2"><Folder className="w-4 h-4 text-cyan-400" /> Media Folder</h2>
          <button autoFocus aria-label="Close media folder settings" disabled={busy} onClick={onClose}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-40"><X className="w-4 h-4" /></button>
        </header>
        <div className="p-5 space-y-4 text-xs">
          <p className="text-zinc-400">Choose where this PC stores imported images, videos, and audio. Use a dedicated folder, such as D:\NSC Media.</p>
          <div className="rounded border border-[#3a3d46] bg-[#18191c] p-3 space-y-2">
            <p className="font-semibold text-zinc-400">Current media folder</p>
            <p className="break-all select-text">{status?.directory ?? 'Loading…'}</p>
            {status && !status.available && <p className="text-amber-300">This folder is unavailable. Reconnect its drive, or choose a folder containing your media.</p>}
          </div>
          <p className="text-zinc-400">Existing library media will be copied into your chosen folder. Original files stay intact, and different files with matching names will never be overwritten.</p>
          <p className="text-zinc-400">Songs and the database stay in their current location. Generated worship pads need no files. This setting applies only to this PC.</p>
          <button disabled={busy || !status} onClick={() => void chooseFolder()}
            className="rounded bg-[#32353e] hover:bg-[#3e424d] px-4 py-2 font-semibold text-white disabled:opacity-40">
            {busy ? 'Choosing folder / copying media…' : 'Choose Media Folder'}
          </button>
          {busy && <p role="status" className="text-cyan-200">Large videos may take a while to copy. Keep the app open until copying finishes.</p>}
          {notice && <p role="status" className="text-cyan-200">{notice}</p>}
          {error && <p role="alert" className="text-red-300 whitespace-pre-wrap">{error}</p>}
        </div>
      </section>
    </div>
  )
}
