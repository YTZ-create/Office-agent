/**
 * KnowledgeBase — 基于 TF-IDF 的项目级文本搜索引擎
 * 零依赖、纯 TypeScript，适用于桌面端 Agent 场景
 */

import type { PlatformAPI, FileEntry } from '../api/platformAPI'
import type { KBDocument, KBIndex, KBSearchResult, KnowledgeBaseStats } from './types'
import { TEXT_EXTENSIONS, SKIP_EXTENSIONS } from './types'
import { MAX_DOC_SIZE, MAX_DOCS_PER_PROJECT, MAX_SEARCH_RESULTS, DEFAULT_MAX_CONTEXT_CHARS, MAX_SNIPPET_CHARS, STOP_WORDS } from './constants'

export class KnowledgeBase {
  private platform: PlatformAPI
  private docs: Map<string, KBDocument> = new Map()
  private index: KBIndex = new Map()
  private projectPath = ''
  private builtAt = 0

  constructor(platform: PlatformAPI) {
    this.platform = platform
  }

  // ========== 构建索引 ==========

  /** 从文件树构建倒排索引 */
  async buildFromFileTree(files: FileEntry[], folderPath: string): Promise<KnowledgeBaseStats> {
    this.projectPath = folderPath
    this.docs.clear()
    this.index.clear()

    const textFiles = this.collectTextFiles(files)
    const limited = textFiles.slice(0, MAX_DOCS_PER_PROJECT)

    // 逐个读取并索引（并行读但串行建索引，避免并发写 Map 的问题）
    const readResults = await Promise.all(
      limited.map(async (f) => {
        if (f.size > MAX_DOC_SIZE) return null
        const result = await this.platform.fs.readFile(f.path)
        if (!result.content || result.error) return null
        return { file: f, content: result.content }
      })
    )

    for (const item of readResults) {
      if (!item) continue
      const doc = this.indexDocument(item.file, item.content)
      this.docs.set(doc.path, doc)
    }

    this.builtAt = Date.now()
    return this.getStats()
  }

  /** 判断文件是否可索引 */
  isIndexable(file: FileEntry): boolean {
    if (file.isDirectory) return false
    if (SKIP_EXTENSIONS.has(file.ext.toLowerCase())) return false
    if (TEXT_EXTENSIONS.has(file.ext.toLowerCase())) return true
    // 无扩展名但名字在白名单中
    const lowerName = file.name.toLowerCase()
    if (TEXT_EXTENSIONS.has(lowerName)) return true
    return false
  }

  // ========== 搜索 ==========

  /** TF-IDF 搜索，返回 Top-K 结果 */
  search(query: string, topK: number = MAX_SEARCH_RESULTS): KBSearchResult[] {
    if (this.docs.size === 0) return []

    const queryTokens = this.tokenize(query)
    if (queryTokens.length === 0) return []

    const totalDocs = this.docs.size
    const scores = new Map<string, number>()
    const matchedTerms = new Map<string, Set<string>>()

    for (const token of queryTokens) {
      const postingList = this.index.get(token)
      if (!postingList) continue

      // IDF = log(总文档数 / 包含该词的文档数)
      const idf = Math.log(totalDocs / postingList.size)

      for (const [docPath, tf] of postingList) {
        const doc = this.docs.get(docPath)
        if (!doc) continue

        // TF = 词在文档中出现次数 / 文档总词数
        const tfNorm = tf / Math.max(doc.tokenCount, 1)
        const score = tfNorm * idf

        scores.set(docPath, (scores.get(docPath) || 0) + score)
        if (!matchedTerms.has(docPath)) matchedTerms.set(docPath, new Set())
        matchedTerms.get(docPath)!.add(token)
      }
    }

    // 按分数排序
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([path, score]) => {
        const doc = this.docs.get(path)!
        return {
          path,
          ext: doc.ext,
          score,
          matchedTerms: [...(matchedTerms.get(path) || new Set())],
          snippet: doc.content.substring(0, MAX_SNIPPET_CHARS),
        }
      })
  }

  /** 获取可注入 LLM 的相关上下文 */
  getRelevantContext(query: string, maxChars: number = DEFAULT_MAX_CONTEXT_CHARS): string {
    const results = this.search(query, 10)
    if (results.length === 0) return ''

    const parts: string[] = []
    let usedChars = 0
    const header = `以下是从项目文件中检索到的相关内容（共 ${results.length} 个匹配文件）：\n\n`
    parts.push(header)
    usedChars += header.length

    for (const r of results) {
      const header = `### 📄 ${r.path}\n匹配关键词: ${r.matchedTerms.join(', ')}\n\n`
      const remaining = maxChars - usedChars
      if (remaining < 200) break

      // 截取片段使其不超过剩余空间
      const maxSnippet = Math.min(MAX_SNIPPET_CHARS, remaining - header.length - 50)
      const snippet = r.snippet.length > maxSnippet
        ? r.snippet.substring(0, maxSnippet) + '\n...(截断)'
        : r.snippet

      const block = `${header}\`\`\`\n${snippet}\n\`\`\`\n\n`
      parts.push(block)
      usedChars += block.length
    }

    return parts.join('')
  }

  /** 获取统计信息 */
  getStats(): KnowledgeBaseStats {
    let estimatedSizeBytes = 0
    for (const doc of this.docs.values()) {
      estimatedSizeBytes += doc.content.length * 2 // UTF-16 估算
    }
    return {
      docCount: this.docs.size,
      termCount: this.index.size,
      estimatedSizeBytes,
      projectPath: this.projectPath,
      builtAt: this.builtAt,
    }
  }

  /** 检查是否已为某项目构建索引 */
  isBuiltFor(projectPath: string): boolean {
    return this.projectPath === projectPath && this.docs.size > 0
  }

  /** 清除索引 */
  clear(): void {
    this.docs.clear()
    this.index.clear()
    this.projectPath = ''
    this.builtAt = 0
  }

  // ========== 分词 ==========

  /** 简单分词：支持英文 + 中文 */
  private tokenize(text: string): string[] {
    const tokens: string[] = []

    // 英文/数字 token
    const enTokens = text.toLowerCase().match(/[a-z0-9_]{2,}/g)
    if (enTokens) {
      for (const t of enTokens) {
        if (!STOP_WORDS.has(t)) tokens.push(t)
      }
    }

    // 中文 token（连续中文，使用 unigram + bigram）
    const cnSeq = text.match(/[一-鿿㐀-䶿]+/g)
    if (cnSeq) {
      for (const seq of cnSeq) {
        // Unigram: 每个汉字
        for (const char of seq) {
          tokens.push(char)
        }
        // Bigram: 相邻两个字
        for (let i = 0; i < seq.length - 1; i++) {
          tokens.push(seq.substring(i, i + 2))
        }
      }
    }

    return tokens
  }

  // ========== 内部方法 ==========

  /** 遍历文件树，收集所有文本文件 */
  private collectTextFiles(files: FileEntry[]): FileEntry[] {
    const result: FileEntry[] = []
    const traverse = (entries: FileEntry[]) => {
      for (const f of entries) {
        if (f.isDirectory) {
          if (f.children) traverse(f.children)
        } else if (this.isIndexable(f)) {
          result.push(f)
        }
      }
    }
    traverse(files)
    return result
  }

  /** 为单个文档建立词汇频率表并更新倒排索引 */
  private indexDocument(file: FileEntry, content: string): KBDocument {
    const tokens = this.tokenize(content)
    const termFreq = new Map<string, number>()
    for (const t of tokens) {
      termFreq.set(t, (termFreq.get(t) || 0) + 1)
    }

    const path = file.relativePath || file.path

    // 更新倒排索引
    for (const [term, freq] of termFreq) {
      if (!this.index.has(term)) {
        this.index.set(term, new Map())
      }
      this.index.get(term)!.set(path, freq)
    }

    return {
      path,
      ext: file.ext,
      size: file.size,
      content,
      termFreq,
      tokenCount: tokens.length,
    }
  }
}
