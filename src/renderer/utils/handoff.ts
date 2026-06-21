/**
 * 手交检测与清理工具
 * 支持多种格式：```handoff 包裹、裸 JSON（英文/中文引号/全角冒号）
 */

/** 将中文引号和全角冒号统一为英文字符，便于 JSON 解析 */
function normalizeQuotes(s: string): string {
  return s
    .replace(/\u201c/g, '"')  // " → "
    .replace(/\u201d/g, '"')  // " → "
    .replace(/\uff1a/g, ':')   // ： → :
}

/**
 * 检测 Agent 回复中是否包含手交指令
 * 支持多种引号风格：英文引号 ""、中文引号 ""、全角冒号 ：
 */
export function detectHandoff(content: string): { targetAgentId: string; reason: string } | null {
  // 先尝试 ```handoff 包裹的格式
  const handoffRegex = /```handoff\s*\n([\s\S]*?)```/
  const match = content.match(handoffRegex)
  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.targetAgentId) {
        return {
          targetAgentId: parsed.targetAgentId,
          reason: parsed.reason || '',
        }
      }
    } catch {
      // 解析失败，尝试归一化后再解析
      try {
        const parsed = JSON.parse(normalizeQuotes(match[1].trim()))
        if (parsed.targetAgentId) {
          return {
            targetAgentId: parsed.targetAgentId,
            reason: parsed.reason || '',
          }
        }
      } catch {
        // 继续尝试裸 JSON
      }
    }
  }

  // 尝试裸 JSON 格式（支持英文引号、中文引号、全角冒号）
  const bareJsonRegex = /\{[^}]*?["\u201c\u201d]targetAgentId["\u201c\u201d]\s*[:\uff1a]\s*["\u201c\u201d]([^"\u201c\u201d]+)["\u201c\u201d][^}]*?["\u201c\u201d]reason["\u201c\u201d]\s*[:\uff1a]\s*["\u201c\u201d]([^"\u201c\u201d]*)["\u201c\u201d][^}]*?\}/
  const bareMatch = content.match(bareJsonRegex)
  if (bareMatch) {
    return {
      targetAgentId: bareMatch[1],
      reason: bareMatch[2] || '',
    }
  }

  // 最后尝试：归一化整个内容后查找 JSON
  const normalized = normalizeQuotes(content)
  const normRegex = /\{\s*"targetAgentId"\s*:\s*"([^"]+)"\s*,\s*"reason"\s*:\s*"([^"]*)"\s*\}/
  const normMatch = normalized.match(normRegex)
  if (normMatch) {
    return {
      targetAgentId: normMatch[1],
      reason: normMatch[2] || '',
    }
  }

  return null
}

/**
 * 从 Agent 回复内容中移除手交指令 JSON，避免显示在消息气泡中
 */
export function cleanHandoffContent(content: string): string {
  // 移除 ```handoff 包裹的格式
  let cleaned = content.replace(/```handoff\s*\n[\s\S]*?```/g, '')
  // 移除裸 JSON 格式（支持英文引号、中文引号、全角冒号）
  cleaned = cleaned.replace(/\{[^}]*?["\u201c\u201d]targetAgentId["\u201c\u201d]\s*[:\uff1a]\s*["\u201c\u201d][^"\u201c\u201d]+["\u201c\u201d][^}]*?["\u201c\u201d]reason["\u201c\u201d]\s*[:\uff1a]\s*["\u201c\u201d][^"\u201c\u201d]*["\u201c\u201d][^}]*?\}/g, '')
  // 移除归一化后匹配的 JSON
  cleaned = cleaned.replace(/\{\s*["\u201c\u201d]targetAgentId["\u201c\u201d]\s*[:\uff1a]\s*["\u201c\u201d][^"\u201c\u201d]+["\u201c\u201d]\s*,\s*["\u201c\u201d]reason["\u201c\u201d]\s*[:\uff1a]\s*["\u201c\u201d][^"\u201c\u201d]*["\u201c\u201d]\s*\}/g, '')
  return cleaned.trim()
}
