/**
 * DependencyAnalyzer — 构建项目依赖图
 * 支持循环依赖检测、耦合度分析、入口点识别
 */

import type { PlatformAPI, FileEntry } from '../api/platformAPI'
import type {
  ImportInfo,
  ModuleNode,
  DependencyGraph,
  CircularDependency,
  CouplingMetrics,
  CodebaseReport,
} from './types'
import { parseImports } from './importParser'

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.pyx'])
const MAX_PARSE_FILES = 300
const RESOLVE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx', '.py']

export class DependencyAnalyzer {
  private platform: PlatformAPI
  private graph: DependencyGraph | null = null
  private projectPath = ''

  constructor(platform: PlatformAPI) {
    this.platform = platform
  }

  /** 构建依赖图 */
  async buildFromFileTree(files: FileEntry[], folderPath: string): Promise<DependencyGraph> {
    this.projectPath = folderPath
    const modules = new Map<string, ModuleNode>()
    const externalDeps = new Map<string, string[]>()
    const codeFiles = this.collectCodeFiles(files).slice(0, MAX_PARSE_FILES)

    // Phase 1: 并行读取所有代码文件，解析 imports
    const parsed = await Promise.all(
      codeFiles.map(async (f) => {
        const result = await this.platform.fs.readFile(f.path)
        if (!result.content) return null
        const imports = parseImports(result.content, f.ext)
        const lineCount = result.content.split('\n').length
        const path = f.relativePath || f.path
        return { path, ext: f.ext, size: f.size, imports, lineCount }
      })
    )

    // 建立模块节点
    for (const item of parsed) {
      if (!item) continue
      const node: ModuleNode = {
        path: item.path,
        ext: item.ext,
        size: item.size,
        imports: item.imports,
        importedBy: [],
        lineCount: item.lineCount,
      }
      modules.set(item.path, node)
    }

    // Phase 2: 解析相对引用，构建反向边
    const allPaths = new Set(modules.keys())

    for (const [modPath, node] of modules) {
      for (const imp of node.imports) {
        if (imp.isRelative) {
          const resolved = this.resolveRelative(modPath, imp.source, allPaths)
          if (resolved) {
            const target = modules.get(resolved)
            if (target) {
              target.importedBy.push(modPath)
            }
          }
        } else {
          // 外部依赖
          const pkgName = this.extractPackageName(imp.source)
          if (!externalDeps.has(pkgName)) {
            externalDeps.set(pkgName, [])
          }
          if (!externalDeps.get(pkgName)!.includes(modPath)) {
            externalDeps.get(pkgName)!.push(modPath)
          }
        }
      }
    }

    this.graph = {
      modules,
      externalDeps,
      moduleCount: modules.size,
      totalLines: [...modules.values()].reduce((s, m) => s + m.lineCount, 0),
    }

    return this.graph
  }

  /** 检测循环依赖 (DFS 白/灰/黑染色) */
  detectCircularDependencies(): CircularDependency[] {
    if (!this.graph) return []

    const WHITE = 0, GRAY = 1, BLACK = 2
    const color = new Map<string, number>()
    const parent = new Map<string, string | null>()
    const cycles: CircularDependency[] = []

    for (const path of this.graph.modules.keys()) {
      color.set(path, WHITE)
      parent.set(path, null)
    }

    const dfs = (node: string) => {
      color.set(node, GRAY)

      const module = this.graph!.modules.get(node)!
      for (const imp of module.imports) {
        if (!imp.isRelative) continue
        const resolved = this.resolveRelative(node, imp.source, new Set(this.graph!.modules.keys()))
        if (!resolved || !this.graph!.modules.has(resolved)) continue

        const c = color.get(resolved)
        if (c === GRAY) {
          // 找到环！回溯构建环路径
          const cycle: string[] = [resolved]
          let cur = node
          while (cur !== resolved) {
            cycle.push(cur)
            cur = parent.get(cur) || ''
            if (!cur) break
          }
          cycle.push(resolved)
          cycles.push({ cycle: cycle.reverse(), length: cycle.length })
        } else if (c === WHITE) {
          parent.set(resolved, node)
          dfs(resolved)
        }
      }

      color.set(node, BLACK)
    }

    for (const path of this.graph.modules.keys()) {
      if (color.get(path) === WHITE) dfs(path)
    }

    return cycles
  }

  /** 计算耦合指标 */
  computeCouplingMetrics(): CouplingMetrics[] {
    if (!this.graph) return []

    const metrics: CouplingMetrics[] = []
    for (const [path, node] of this.graph.modules) {
      let fanOut = 0
      for (const imp of node.imports) {
        if (imp.isRelative) {
          const resolved = this.resolveRelative(path, imp.source, new Set(this.graph.modules.keys()))
          if (resolved && this.graph.modules.has(resolved)) fanOut++
        }
      }
      const fanIn = node.importedBy.length
      const instability = fanIn + fanOut === 0 ? 0 : fanOut / (fanIn + fanOut)

      metrics.push({ path, fanIn, fanOut, instability: Math.round(instability * 100) / 100 })
    }

    return metrics
  }

  /** 找到入口点（未被任何文件引用的文件） */
  findEntryPoints(): string[] {
    if (!this.graph) return []

    const entryPoints: string[] = []
    for (const [path, node] of this.graph.modules) {
      if (node.importedBy.length === 0) {
        entryPoints.push(path)
      }
    }
    return entryPoints
  }

  /** 生成综合报告 */
  generateReport(): CodebaseReport | null {
    if (!this.graph) return null

    const circularDeps = this.detectCircularDependencies()
    const metrics = this.computeCouplingMetrics()

    // 外部依赖 Top-10
    const externalDepsTop = [...this.graph.externalDeps.entries()]
      .map(([name, refs]) => ({ name, count: refs.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // 高耦合模块 Top-5 (按 instability 降序，越接近 1 越不稳定)
    const highCoupling = metrics
      .sort((a, b) => b.instability - a.instability)
      .slice(0, 5)

    // 高扇入模块 Top-5 (基础设施模块)
    const highFanIn = metrics
      .sort((a, b) => b.fanIn - a.fanIn)
      .slice(0, 5)

    return {
      moduleCount: this.graph.moduleCount,
      totalLines: this.graph.totalLines,
      entryPoints: this.findEntryPoints(),
      externalDepsTop,
      circularDeps,
      highCoupling,
      highFanIn,
    }
  }

  /** 获取可注入 LLM 的 Markdown 上下文 */
  getContextForLLM(maxLength: number = 6000): string {
    const report = this.generateReport()
    if (!report) return ''

    const parts: string[] = [
      '## 代码库结构分析',
      '',
      `- **总模块数**: ${report.moduleCount}`,
      `- **总代码行数**: ${report.totalLines}`,
      `- **入口文件**: ${report.entryPoints.slice(0, 5).join(', ') || '无'}${report.entryPoints.length > 5 ? ` ...等 ${report.entryPoints.length} 个` : ''}`,
      '',
    ]

    // 外部依赖
    if (report.externalDepsTop.length > 0) {
      parts.push('### 外部依赖 (Top 10)')
      parts.push('')
      parts.push('| 依赖 | 引用文件数 |')
      parts.push('|------|-----------|')
      for (const d of report.externalDepsTop) {
        parts.push(`| ${d.name} | ${d.count} |`)
      }
      parts.push('')
    }

    // 循环依赖
    if (report.circularDeps.length > 0) {
      parts.push('### ⚠️ 循环依赖')
      parts.push('')
      for (const c of report.circularDeps) {
        parts.push(`- ${c.cycle.join(' → ')}`)
      }
    } else {
      parts.push('### ✅ 循环依赖: 无')
    }
    parts.push('')

    // 高耦合模块
    if (report.highCoupling.length > 0) {
      parts.push('### 高不稳定性模块 (Top 5)')
      parts.push('')
      parts.push('| 文件 | FanIn | FanOut | Instability |')
      parts.push('|------|-------|--------|-------------|')
      for (const m of report.highCoupling) {
        parts.push(`| ${m.path} | ${m.fanIn} | ${m.fanOut} | ${m.instability} |`)
      }
      parts.push('')
    }

    // 高扇入模块
    if (report.highFanIn.length > 0) {
      parts.push('### 核心依赖模块 (Top 5)')
      parts.push('')
      parts.push('| 文件 | FanIn | FanOut |')
      parts.push('|------|-------|--------|')
      for (const m of report.highFanIn) {
        parts.push(`| ${m.path} | ${m.fanIn} | ${m.fanOut} |`)
      }
      parts.push('')
    }

    const text = parts.join('\n')
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '\n\n...(截断)'
    }
    return text
  }

  /** 检查是否已为某项目构建 */
  isBuiltFor(projectPath: string): boolean {
    return this.projectPath === projectPath && this.graph !== null
  }

  clear(): void {
    this.graph = null
    this.projectPath = ''
  }

  // ========== 内部 ==========

  private collectCodeFiles(files: FileEntry[]): FileEntry[] {
    const result: FileEntry[] = []
    const traverse = (entries: FileEntry[]) => {
      for (const f of entries) {
        if (f.isDirectory) {
          if (f.children) traverse(f.children)
        } else if (CODE_EXTS.has(f.ext.toLowerCase())) {
          result.push(f)
        }
      }
    }
    traverse(files)
    return result
  }

  /** 解析相对路径引用为实际文件路径 */
  private resolveRelative(fromPath: string, importSource: string, allPaths: Set<string>): string | null {
    // 规范化 fromPath 的目录
    const fromDir = fromPath.includes('/') ? fromPath.substring(0, fromPath.lastIndexOf('/')) : ''

    // 尝试不同的扩展名和后缀
    const base = fromDir ? `${fromDir}/${importSource}` : importSource

    // 直接匹配
    if (allPaths.has(base)) return base

    // 去掉 /index 后缀后再试扩展名
    const candidates = [
      base,
      ...RESOLVE_EXTS.map((ext) => base + ext),
    ]

    for (const c of candidates) {
      if (allPaths.has(c)) return c
    }

    return null
  }

  /** 提取 npm 包名（处理 scoped packages） */
  private extractPackageName(source: string): string {
    if (source.startsWith('@')) {
      const parts = source.split('/')
      return parts.slice(0, 2).join('/')
    }
    return source.split('/')[0]
  }
}
