/**
 * DependencyAnalyzer 单例管理
 */

import type { PlatformAPI } from '../api/platformAPI'
import { DependencyAnalyzer } from './dependencyGraph'

let _analyzer: DependencyAnalyzer | null = null

export function createDependencyAnalyzer(platform: PlatformAPI): DependencyAnalyzer {
  _analyzer = new DependencyAnalyzer(platform)
  return _analyzer
}

export function getDependencyAnalyzer(): DependencyAnalyzer {
  if (!_analyzer) throw new Error('DependencyAnalyzer not initialized. Call createDependencyAnalyzer(platform) first.')
  return _analyzer
}
