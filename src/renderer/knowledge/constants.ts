/**
 * 知识库常量
 */

/** 单个文件最大读取大小（100KB，跳过超大文件） */
export const MAX_DOC_SIZE = 100 * 1024

/** 每个项目最多索引的文件数 */
export const MAX_DOCS_PER_PROJECT = 500

/** 搜索结果最大返回数 */
export const MAX_SEARCH_RESULTS = 20

/** getRelevantContext 默认最大字符数 */
export const DEFAULT_MAX_CONTEXT_CHARS = 8000

/** 搜索结果片段最大字符数 */
export const MAX_SNIPPET_CHARS = 1500

/** 英文停用词 */
export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
  'this', 'that', 'these', 'those', 'am', 'at', 'by', 'for', 'with', 'about',
  'between', 'through', 'during', 'before', 'after', 'above', 'below',
  'to', 'from', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because',
  'as', 'until', 'while', 'of', 'up', 'down', 'or', 'and', 'but', 'if',
  'its', 'also', 'into', 'what', 'which', 'who', 'whom',
])
