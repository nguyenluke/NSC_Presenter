export interface PdfRenderBridge {
  open: (base64: string) => Promise<number>
  page: (pageNumber: number) => Promise<string>
  close: () => Promise<void>
}

export interface DocumentImportProgress {
  phase: string
  completed: number
  total: number
}
