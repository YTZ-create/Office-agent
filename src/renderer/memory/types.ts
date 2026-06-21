/**
 * 记忆系统类型定义
 */

export type MemoryCategory =
  | 'user-preference'   // 用户偏好
  | 'project-context'   // 项目上下文
  | 'analysis-result'   // 分析结果
  | 'session-summary'   // 会话摘要
  | 'general'           // 通用

export interface MemoryEntry {
  /** 唯一 ID */
  id: string
  /** 记忆分类 */
  category: MemoryCategory
  /** 唯一键（用于去重，如 "proj:my-app:tech-stack"） */
  key: string
  /** 记忆内容（Markdown 文本） */
  content: string
  /** 标签 */
  tags: string[]
  /** 关联的项目路径 */
  projectPath?: string
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
  /** 可选的过期时间（Unix timestamp），过期后自动清理 */
  expiresAt?: number
}

export interface MemoryQuery {
  /** 文本搜索（匹配 content） */
  text?: string
  /** 按分类过滤 */
  category?: MemoryCategory
  /** 按标签过滤 */
  tag?: string
  /** 按项目路径过滤 */
  projectPath?: string
  /** 返回最大条数 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

export interface MemoryStats {
  total: number
  byCategory: Record<string, number>
  oldestEntry: number | null
  newestEntry: number | null
}
