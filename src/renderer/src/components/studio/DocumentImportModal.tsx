import React, { useEffect, useState } from 'react'
import { DocumentImportProgress } from '@shared/documents'
import { MediaAsset } from '@shared/types'

export const DocumentImportModal: React.FC<{
  onClose: () => void
  onImported: (result: { mediaAssets: MediaAsset[]; documentId: string }) => void
}> = ({ onClose, onImported }) => {
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [progress, setProgress] = useState<DocumentImportProgress | null>(null)
  const [error, setError] = useState('')
  useEffect(() => window.nscApi.onDocumentImportProgress(setProgress), [])
  return <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-6">
    <section role="dialog" aria-modal="true" aria-label="Import sermon document" className="max-w-lg w-full rounded-xl bg-[#232529] border border-[#3a3d46] p-5 text-zinc-200 space-y-4">
      <h2 className="font-bold text-sm">Import Sermon Slides</h2>
      <p className="text-xs text-zinc-400">Import a PDF, PowerPoint .ppt or .pptx as ordered pages in Sermon &amp; Events. PDF works offline without Office. PowerPoint files need installed Microsoft PowerPoint or LibreOffice on this PC.</p>
      <p className="text-xs text-zinc-400">Slides become static images: no animations, embedded video or editable PowerPoint objects. Up to 200 pages / 100 MB. Importing does not change the live screen.</p>
      {progress && <p role="status" className="text-xs text-cyan-200">{cancelling ? 'Cancelling after the current conversion/page…' : progress.phase}{progress.total > 0 ? ` · ${progress.completed}/${progress.total}` : ''}</p>}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      <div className="flex justify-end gap-2 text-xs">
        <button disabled={busy} onClick={onClose} className="px-3 py-2 rounded bg-[#32353e] disabled:opacity-40">Close</button>
        {busy ? <button disabled={cancelling} onClick={() => { setCancelling(true); void window.nscApi.cancelDocumentImport() }} className="px-3 py-2 text-amber-300">Cancel import</button> :
          <button className="px-3 py-2 rounded bg-orange-500 text-white font-semibold" onClick={() => {
            setBusy(true); setCancelling(false); setError(''); setProgress(null)
            void window.nscApi.importSermonDocument().then(result => { if (result) onImported(result) })
              .catch(err => setError(err.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''))).finally(() => setBusy(false))
          }}>Choose PDF / PowerPoint</button>}
      </div>
    </section>
  </div>
}
