export interface PdfPage {
  getViewport(options: { scale: number }): { width: number; height: number }
  render(options: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: unknown; background: string }): { promise: Promise<void> }
  cleanup(): void
}
export interface PdfDocument {
  numPages: number
  getPage(page: number): Promise<PdfPage>
  destroy(): Promise<void>
}
export const GlobalWorkerOptions: { workerSrc: string }
export function getDocument(options: Record<string, unknown>): { promise: Promise<PdfDocument> }
