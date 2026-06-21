/**
 * 知识库类型定义
 */

/** 一个被索引的文档（对应一个文件） */
export interface KBDocument {
  /** 文件相对路径（作为唯一 ID） */
  path: string
  /** 文件扩展名 */
  ext: string
  /** 文件大小（字节） */
  size: number
  /** 文件全文内容 */
  content: string
  /** token → 出现次数 */
  termFreq: Map<string, number>
  /** 总 token 数 */
  tokenCount: number
}

/** 倒排索引：term → { 文档路径 → 该文档中该词的出现次数 } */
export type KBIndex = Map<string, Map<string, number>>

/** 搜索结果中的单条命中 */
export interface KBSearchResult {
  /** 文件相对路径 */
  path: string
  /** 文件扩展名 */
  ext: string
  /** TF-IDF 相关性得分 */
  score: number
  /** 匹配的关键词 */
  matchedTerms: string[]
  /** 文件内容片段（截取前 N 字符） */
  snippet: string
}

/** 知识库统计信息 */
export interface KnowledgeBaseStats {
  /** 已索引的文档数 */
  docCount: number
  /** 索引中唯一的 term 数 */
  termCount: number
  /** 索引的总大小估算（字节） */
  estimatedSizeBytes: number
  /** 索引的项目路径 */
  projectPath: string
  /** 最后构建时间 */
  builtAt: number
}

/** 文本文件扩展名白名单 */
export const TEXT_EXTENSIONS = new Set([
  // === 编程语言 ===
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyx', '.pyi',
  '.rs', '.go', '.java', '.kt', '.kts',
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hh',
  '.cs', '.swift', '.scala', '.rb', '.php',
  '.lua', '.r', '.pl', '.pm', '.sh', '.bash', '.zsh',
  '.sql', '.graphql', '.gql',
  '.vue', '.svelte', '.astro',
  // === 样式 & 标记 ===
  '.css', '.scss', '.sass', '.less', '.styl',
  '.html', '.htm', '.xml', '.svg',
  // === 配置 & 数据 ===
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.env', '.env.local', '.env.example',
  '.editorconfig', '.prettierrc', '.eslintrc',
  '.babelrc', '.browserslistrc',
  // === 文档 & 文本 ===
  '.md', '.mdx', '.txt', '.rst', '.tex',
  '.log', '.csv', '.tsv',
  // === 构建 & 包管理 ===
  'dockerfile', 'makefile', '.gitignore', '.gitattributes',
  '.npmignore', '.dockerignore',
  // === 特殊文件名（无扩展名） ===
  'license', 'changelog', 'contributing', 'authors', 'codeowners',
])

/** 跳过这类型文件（二进制） */
export const SKIP_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
  '.pyc', '.pyo', '.class', '.jar', '.war', '.ear',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.tiff', '.tif',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.ogg', '.wav',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.cab', '.iso',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb',
  '.wasm', '.map',
])
