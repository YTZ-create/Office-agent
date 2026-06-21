export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  if (i === 0) return `${bytes} B`
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

export function formatTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(diff / 86400000)
  if (days < 30) return `${days}天前`
  return new Date(isoString).toLocaleDateString('zh-CN')
}

export function formatChatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return `${date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

export function getFileIcon(ext: string): string {
  const icons: Record<string, string> = {
    '.ts': 'TS', '.tsx': 'TSX', '.js': 'JS', '.jsx': 'JSX', '.py': 'PY', '.rs': 'RS', '.go': 'GO',
    '.java': 'JV', '.c': 'C', '.cpp': 'C++', '.h': 'H', '.json': '{}', '.md': 'MD',
    '.css': 'CSS', '.html': '<>', '.xml': 'XML', '.yaml': 'YML', '.yml': 'YML',
    '.sql': 'SQL', '.sh': 'SH', '.txt': 'TXT', '.csv': 'CSV', '.pdf': 'PDF',
    '.png': 'IMG', '.jpg': 'IMG', '.svg': 'SVG', '.zip': 'ZIP',
  }
  return icons[ext.toLowerCase()] || ext.slice(1, 4).toUpperCase() || '?'
}

export function getFileColor(ext: string): string {
  const colors: Record<string, string> = {
    '.ts': '#3178C6', '.tsx': '#3178C6', '.js': '#F7DF1E', '.jsx': '#61DAFB',
    '.py': '#3776AB', '.rs': '#DEA584', '.go': '#00ADD8',
    '.md': '#FFD440', '.json': '#FFD440', '.css': '#1572B6', '.html': '#E34F26',
  }
  return colors[ext.toLowerCase()] || '#141111'
}
