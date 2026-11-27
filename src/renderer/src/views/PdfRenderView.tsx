import React, { useEffect } from 'react'
import { getDocument, GlobalWorkerOptions, PdfDocument } from '../vendor/pdfjs/pdf.mjs'
import workerUrl from '../vendor/pdfjs/pdf.worker.mjs?url'
import { PdfRenderBridge } from '@shared/documents'

declare global { interface Window { nscPdfRenderer?: PdfRenderBridge } }

export const PdfRenderView: React.FC = () => {
  useEffect(() => {
    let document: PdfDocument | null = null
    GlobalWorkerOptions.workerSrc = new URL(workerUrl, window.location.href).href
    const assets = new URL('pdfjs/', window.location.href.split('#')[0]).href
    window.nscPdfRenderer = {
      open: async (base64) => {
        if (document) await document.destroy()
        const data = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
        document = await getDocument({ data, isEvalSupported: false, enableXfa: false,
          maxImageSize: 16777216, canvasMaxAreaInBytes: 134217728,
          cMapUrl: `${assets}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}standard_fonts/`,
          wasmUrl: `${assets}wasm/`, useSystemFonts: true, stopAtErrors: true }).promise
        return document.numPages
      },
      page: async (pageNumber) => {
        if (!document) throw new Error('No PDF is open.')
        const page = await document.getPage(pageNumber)
        const natural = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: Math.min(1920 / natural.width, 1080 / natural.height) })
        const canvas = window.document.createElement('canvas')
        canvas.width = Math.max(1, Math.ceil(viewport.width))
        canvas.height = Math.max(1, Math.ceil(viewport.height))
        const context = canvas.getContext('2d')!
        await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise
        const png = canvas.toDataURL('image/png').split(',')[1]
        canvas.width = canvas.height = 0
        page.cleanup()
        return png
      },
      close: async () => { if (document) await document.destroy(); document = null }
    }
    return () => { delete window.nscPdfRenderer; void document?.destroy() }
  }, [])
  return <div>Preparing document pages…</div>
}
