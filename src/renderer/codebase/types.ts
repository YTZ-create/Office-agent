/**
 * 代码库分析类型定义
 */

/** 一个 import/require 语句的结构化信息 */
export interface ImportInfo {
  /** 导入源路径（如 'react', '../../utils/llm'） */
  source: string
  /** 是否是相对路径引用 */
  isRelative: boolean
  /** 是否是外部包引用 */
  isExternal: boolean
  /** 导入的符号名列表 */
  names: string[]
  /** 在源文件中的行号 */
  line: number
}

/** 模块节点（一个代码文件） */
export interface ModuleNode {
  /** 文件相对路径 */
  path: string
  /** 文件扩展名 */
  ext: string
  /** 文件大小（字节） */
  size: number
  /** 该文件 import 了哪些模块 */
  imports: ImportInfo[]
  /** 哪些模块依赖此文件（解析后的相对路径） */
  importedBy: string[]
  /** 代码行数 */
  lineCount: number
}

/** 依赖图 */
export interface DependencyGraph {
  /** 所有模块节点，key 为相对路径 */
  modules: Map<string, ModuleNode>
  /** 外部依赖 → 引用它的文件路径列表 */
  externalDeps: Map<string, string[]>
  /** 总模块数 */
  moduleCount: number
  /** 总代码行数估算 */
  totalLines: number
}

/** 循环依赖 */
export interface CircularDependency {
  /** 形成环的文件路径列表（按依赖顺序） */
  cycle: string[]
  /** 环的长度 */
  length: number
}

/** 模块耦合指标 */
export interface CouplingMetrics {
  /** 文件路径 */
  path: string
  /** 扇入：有多少文件依赖它 */
  fanIn: number
  /** 扇出：它依赖多少文件 */
  fanOut: number
  /** 不稳定性 = fanOut / (fanIn + fanOut)，0=非常稳定, 1=非常不稳定 */
  instability: number
}

/** 给 LLM 的综合分析报告 */
export interface CodebaseReport {
  /** 模块总数 */
  moduleCount: number
  /** 总代码行数 */
  totalLines: number
  /** 入口文件（未被任何人引用的文件） */
  entryPoints: string[]
  /** 外部依赖 Top-N */
  externalDepsTop: { name: string; count: number }[]
  /** 循环依赖列表 */
  circularDeps: CircularDependency[]
  /** 高耦合模块 Top-N */
  highCoupling: CouplingMetrics[]
  /** 高扇入模块（基础设施模块） */
  highFanIn: CouplingMetrics[]
}
