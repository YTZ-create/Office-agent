/**
 * MemoryStore 单例管理
 */

import type { PlatformAPI } from '../api/platformAPI'
import { MemoryStore } from './memoryStore'

let _memoryStore: MemoryStore | null = null

export async function initMemoryStore(platform: PlatformAPI): Promise<MemoryStore> {
  _memoryStore = new MemoryStore(platform)
  await _memoryStore.init()
  return _memoryStore
}

export function getMemoryStore(): MemoryStore {
  if (!_memoryStore) throw new Error('MemoryStore not initialized. Call initMemoryStore(platform) first.')
  return _memoryStore
}
