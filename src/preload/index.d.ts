import type { KellnerApi } from '../shared/ipc'

declare global {
  interface Window {
    kellner: KellnerApi
  }
}
