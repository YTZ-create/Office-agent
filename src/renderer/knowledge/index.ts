/**
 * KnowledgeBase 单例管理
 */

import type { PlatformAPI } from '../api/platformAPI'
import { KnowledgeBase } from './knowledgeBase'

let _kb: KnowledgeBase | null = null

export function initKnowledgeBase(platform: PlatformAPI): KnowledgeBase {
  _kb = new KnowledgeBase(platform)
  return _kb
}

export function getKnowledgeBase(): KnowledgeBase {
  if (!_kb) throw new Error('KnowledgeBase not initialized. Call initKnowledgeBase(platform) first.')
  return _kb
}
