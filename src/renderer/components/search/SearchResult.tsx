import React from 'react'
import { Search } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { getFileIcon, getFileColor } from '../../utils/formatters'
import type { FileEntry } from '../../api/neutralino'
import type { SearchResult } from '../../stores/chatStore'

export const SearchResultPanel: React.FC<{
  results: SearchResult[]
  keyword: string
  onFileClick?: (file: FileEntry) => void
}> = ({ results, keyword, onFileClick }) => {
  if (results.length === 0) {
    return (
      <div className="p-6 text-center text-black/70 text-sm">
        <Search size={24} className="mx-auto mb-2 opacity-70" />暂无搜索结果
      </div>
    )
  }

  const totalMatches = results.reduce((s, r) => s + r.matches.length, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b-2 border-brutal-black bg-white">
        <div className="text-sm font-bold">搜索 "{keyword}"</div>
        <div className="text-[10px] text-black/70 font-mono mt-0.5">{results.length} 个文件 · {totalMatches} 处匹配</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {results.map((r, i) => (
          <div key={i} className="px-4 py-2.5 border-b-2 border-brutal-black hover:bg-brutal-yellow cursor-pointer"
            onClick={() => onFileClick?.(r.file)}>
            <div className="flex items-center gap-2 mb-1">
              <Badge color={getFileColor(r.file.ext)} className="text-[9px]">{getFileIcon(r.file.ext)}</Badge>
              <span className="text-xs font-bold truncate flex-1">{r.file.relativePath}</span>
              <span className="text-[10px] text-black/70 font-mono">{r.matches.filter((m) => m.line > 0).length} 处</span>
            </div>
            <div className="space-y-0.5 pl-1">
              {r.matches.slice(0, 3).map((m, j) => (
                <div key={j} className="text-[11px] text-black/80 font-mono truncate">
                  {m.line > 0 && <span className="text-black/70 mr-1">L{m.line}:</span>}
                  <span dangerouslySetInnerHTML={{
                    __html: m.content.replace(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                      (match) => `<mark class="bg-brutal-yellow/60 px-0.5">${match}</mark>`)
                  }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
