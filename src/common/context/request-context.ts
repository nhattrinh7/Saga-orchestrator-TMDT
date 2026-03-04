import { AsyncLocalStorage } from 'async_hooks'

interface RequestStore {
  kongRequestId: string
}

export const requestContext = new AsyncLocalStorage<RequestStore>()

export function getKongRequestId(): string {
  return requestContext.getStore()?.kongRequestId || 'no-request-id'
}
