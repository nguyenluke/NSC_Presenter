import React, { useEffect, useState } from 'react'
import { Cloud, RefreshCw, X } from 'lucide-react'
import { LibraryConfig, SongSyncResult, SongSyncStatus } from '@shared/songSync'
import { useStudioStore } from '../../store/useStudioStore'

export const SharedLibraryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [status, setStatus] = useState<SongSyncStatus | null>(null)
  const [config, setConfig] = useState<LibraryConfig>({ url: '', publishableKey: '', libraryId: '' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [result, setResult] = useState<SongSyncResult | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const refreshSongs = useStudioStore((state) => state.refreshLibrarySongs)

  useEffect(() => {
    window.nscApi.libraryStatus().then((data) => {
      setStatus(data)
      if (data.config) setConfig(data.config)
      setShowSettings(!data.config)
    }).catch((err: Error) => setError(err.message))
  }, [])

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true); setError(''); setNotice('')
    try { await action() }
    catch (err) { setError(err instanceof Error ? err.message : 'The library operation failed.') }
    finally {
      try { setStatus(await window.nscApi.libraryStatus()); await refreshSongs() }
      catch { setError((previous) => previous || 'Could not refresh the library. Close and reopen this panel.') }
      setBusy(false)
    }
  }
  const inputClass = 'w-full rounded border border-[#42454e] bg-[#18191c] px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500'
  const buttonClass = 'rounded px-3 py-2 text-xs font-semibold bg-[#3a3d46] hover:bg-[#484c58] disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="shared-library-title"
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border border-[#3a3d46] bg-[#232529] shadow-2xl text-zinc-200">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#3a3d46]">
          <h2 id="shared-library-title" className="text-sm font-bold flex items-center gap-2"><Cloud className="w-4 h-4 text-blue-400" /> Shared Song Library</h2>
          <button aria-label="Close shared library" disabled={busy} onClick={onClose} className="p-1 hover:bg-white/10 rounded disabled:opacity-40"><X className="w-4 h-4" /></button>
        </header>
        <div className="p-5 space-y-4">
          <p className="text-xs text-zinc-400">Share bilingual songs between home and church. Songs remain saved on this PC for offline services. Playlists, media files, and screen settings stay on this PC.</p>
          <div className="rounded border border-[#3a3d46] p-3 text-xs flex items-center justify-between gap-3">
            <span>{status ? `${status.pending} local change${status.pending === 1 ? '' : 's'} waiting to sync` : 'Loading library status…'}</span>
            <button disabled={busy || !status} className="text-blue-300 hover:underline disabled:opacity-40" onClick={() => setShowSettings(!showSettings)}>{showSettings ? 'Hide connection' : 'Connection settings'}</button>
          </div>
          {showSettings && (
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void run(async () => {
              await window.nscApi.configureLibrary(config)
              setResult(null); setShowSettings(false); setNotice('Connection saved. Sign in with your library account.')
            }) }}>
              <p className="text-xs text-zinc-400">First run the setup SQL and add your account to the library, following docs/SHARED_LIBRARY.md in the project.</p>
              <label className="block text-xs space-y-1"><span>Supabase project URL</span><input required type="url" disabled={busy} value={config.url} onChange={(event) => setConfig({ ...config, url: event.target.value })} placeholder="https://your-project.supabase.co" className={inputClass} /></label>
              <label className="block text-xs space-y-1"><span>Publishable key (or legacy anon key)</span><input required disabled={busy} value={config.publishableKey} onChange={(event) => setConfig({ ...config, publishableKey: event.target.value })} placeholder="sb_publishable_…" className={inputClass} /></label>
              <label className="block text-xs space-y-1"><span>Library ID</span><input required disabled={busy} value={config.libraryId} onChange={(event) => setConfig({ ...config, libraryId: event.target.value.trim() })} placeholder="UUID returned by the setup SQL" className={inputClass} /></label>
              <button disabled={busy || !status} className={buttonClass}>Save connection</button>
            </form>
          )}
          {status?.config && !status.email && (
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void run(async () => {
              try { await window.nscApi.librarySignIn(email, password); setNotice('Signed in. Choose Sync songs when ready.') }
              finally { setPassword('') }
            }) }}>
              <label className="block text-xs space-y-1"><span>Email</span><input autoFocus required type="email" autoComplete="username" disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label>
              <label className="block text-xs space-y-1"><span>Password</span><input required type="password" autoComplete="current-password" disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label>
              <button disabled={busy} className={buttonClass}>Sign in</button>
              <p className="text-xs text-zinc-500">Sign in again after restarting the app. Your password is never saved.</p>
            </form>
          )}
          {status?.email && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs gap-2"><span className="truncate">Signed in as {status.email}</span><button disabled={busy} className={buttonClass} onClick={() => void run(async () => { await window.nscApi.librarySignOut(); setResult(null) })}>Sign out</button></div>
              <button disabled={busy || showSettings} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-40" onClick={() => void run(async () => {
                const data = await window.nscApi.syncLibrary()
                setResult(data.result)
                setNotice(`${data.result.uploaded} uploaded, ${data.result.downloaded} downloaded. ${data.result.conflicts.length ? 'Review conflicting songs below.' : 'Song sync complete.'}`)
              })}><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Working…' : 'Sync songs'}</button>
              <p className="text-xs text-zinc-400">Sync before service. Changes stay local until you sync again. Songs with the same title are kept separate unless they share the same song ID.</p>
            </div>
          )}
          {error && <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200 whitespace-pre-wrap">{error}</p>}
          {notice && <p role="status" className="rounded border border-blue-500/40 bg-blue-500/10 p-3 text-xs text-blue-200">{notice}</p>}
          {result?.conflicts.map((conflict) => (
            <article key={conflict.sharedId} className="border border-amber-500/40 rounded p-3 space-y-3">
              <h3 className="text-sm font-semibold text-amber-200">{conflict.title}: both copies changed</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="mb-1">This PC {conflict.localDeleted ? '(deleted)' : ''}</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words bg-black/25 p-2 rounded">{conflict.localText}</pre></div>
                <div><p className="mb-1">Shared library {conflict.sharedDeleted ? '(deleted)' : ''}</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words bg-black/25 p-2 rounded">{conflict.sharedText}</pre></div>
              </div>
              <div className="flex gap-2">{(['local', 'shared'] as const).map((choice) => (
                <button key={choice} disabled={busy} className={buttonClass} onClick={() => {
                  const message = choice === 'local'
                    ? 'Keep this PC’s version? The next sync will replace the shared version, including any local deletion.'
                    : 'Use the shared version? This replaces this PC’s pending edits, including any shared deletion.'
                  if (!window.confirm(message)) return
                  void run(async () => {
                    await window.nscApi.resolveLibraryConflict(conflict.sharedId, choice, conflict.revision)
                    setResult((previous) => previous && ({ ...previous, conflicts: previous.conflicts.filter((item) => item.sharedId !== conflict.sharedId) }))
                    setNotice(choice === 'local' ? 'Local version kept. Sync songs again to upload it.' : 'Shared version saved on this PC.')
                  })
                }}>{choice === 'local' ? (conflict.localDeleted ? 'Keep local deletion' : 'Keep this PC’s version') : (conflict.sharedDeleted ? 'Accept shared deletion' : 'Use shared version')}</button>
              ))}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
