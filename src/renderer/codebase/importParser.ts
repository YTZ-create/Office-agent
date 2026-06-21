/**
 * 轻量级 Import 解析器
 * 纯正则匹配，零依赖，不跑编译器
 */

import type { ImportInfo } from './types'

/** 解析 TypeScript / JavaScript 的 import/require 语句 */
export function parseImportsTS(content: string): ImportInfo[] {
  const results: ImportInfo[] = []

  // 1. ES6 静态 import: import X from 'Y' / import { X } from 'Y' / import * as X from 'Y' / import 'Y'
  const staticImportRe = /^\s*import\s+(?:type\s+)?(?:(?:\{[\s\S]*?\}|[*]\s+as\s+\w+|\w+)\s*(?:,\s*(?:\{[\s\S]*?\}|\w+)\s*)*\s*from\s*)?['"]([^'"]+)['"]/gm
  for (const m of content.matchAll(staticImportRe)) {
    const source = m[1]
    const names = extractNames(m[0])
    results.push({
      source,
      isRelative: source.startsWith('.'),
      isExternal: !source.startsWith('.') && !source.startsWith('@'),
      names,
      line: lineOf(content, m.index),
    })
  }

  // 2. 动态 import: import('Y')
  const dynamicImportRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const m of content.matchAll(dynamicImportRe)) {
    results.push({
      source: m[1],
      isRelative: m[1].startsWith('.'),
      isExternal: !m[1].startsWith('.') && !m[1].startsWith('@'),
      names: [],
      line: lineOf(content, m.index),
    })
  }

  // 3. CommonJS require: require('Y')
  const requireRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const m of content.matchAll(requireRe)) {
    results.push({
      source: m[1],
      isRelative: m[1].startsWith('.'),
      isExternal: !m[1].startsWith('.') && !m[1].startsWith('@'),
      names: [],
      line: lineOf(content, m.index),
    })
  }

  return dedupeImports(results)
}

/** 解析 Python 的 import 语句 */
export function parseImportsPython(content: string): ImportInfo[] {
  const results: ImportInfo[] = []

  // 1. import X / import X as Y / import X, Y, Z
  const importRe = /^import\s+([\w.,\s]+?)(?:\s+#.*)?$/gm
  for (const m of content.matchAll(importRe)) {
    const modules = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
    for (const mod of modules) {
      if (!mod) continue
      results.push({
        source: mod,
        isRelative: mod.startsWith('.'),
        isExternal: !mod.startsWith('.'),
        names: [mod],
        line: lineOf(content, m.index),
      })
    }
  }

  // 2. from X import Y / from X import Y as Z
  const fromImportRe = /^from\s+([\w.]+)\s+import\s+([\w.,\s*()]+?)(?:\s+#.*)?$/gm
  for (const m of content.matchAll(fromImportRe)) {
    const source = m[1]
    const namesStr = m[2].replace(/[()]/g, '')
    const names = namesStr.split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter((n) => n && n !== '*')
    results.push({
      source,
      isRelative: source.startsWith('.'),
      isExternal: !source.startsWith('.'),
      names,
      line: lineOf(content, m.index),
    })
  }

  return dedupeImports(results)
}

/** 根据文件扩展名选择解析器 */
export function parseImports(content: string, ext: string): ImportInfo[] {
  if (['.py', '.pyx', '.pyi'].includes(ext)) {
    return parseImportsPython(content)
  }
  return parseImportsTS(content)
}

// ========== 内部工具 ==========

function extractNames(importStmt: string): string[] {
  const names: string[] = []

  // 默认导入: import X from ...
  const defaultMatch = importStmt.match(/^import\s+(\w+)/)
  if (defaultMatch) names.push(defaultMatch[1])

  // 命名导入: import { X, Y } from ...
  const namedMatch = importStmt.match(/\{\s*([^}]+)\s*\}/)
  if (namedMatch) {
    const items = namedMatch[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
    names.push(...items)
  }

  // 命名空间导入: import * as X from ...
  const nsMatch = importStmt.match(/\*\s+as\s+(\w+)/)
  if (nsMatch) names.push(nsMatch[1])

  return names
}

function lineOf(content: string, index: number): number {
  return content.substring(0, index).split('\n').length
}

function dedupeImports(imports: ImportInfo[]): ImportInfo[] {
  const seen = new Set<string>()
  return imports.filter((imp) => {
    const key = `${imp.source}:${imp.line}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
