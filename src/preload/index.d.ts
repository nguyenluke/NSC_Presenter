import type { NscApi } from './index'

declare global {
  interface Window {
    nscApi: NscApi
  }
}
