import { create } from 'zustand'
import type { FileEntry } from '../api/neutralino'
import { api } from '../api/neutralino'

const STORAGE_KEY = 'chat_history'
const MAX_HISTORY = 50

export interface SearchResult {
  file: FileEntry
  matches: { line: number; content: string }[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  agentName?: string
  agentColor?: string
  timestamp: number
  files?: FileEntry[]
  searchResults?: SearchResult[]
}

export interface AgentConversationMessage {
  id: string
  agentName: string
  agentColor: string
  content: string
  timestamp: number
  isLeader?: boolean
}

interface ChatState {
  messages: ChatMessage[]
  agentConversation: AgentConversationMessage[]
  inputValue: string
  isStreaming: boolean
  activeAgentId: string | null
  abortController: AbortController | null

  setInputValue: (v: string) => void
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateLastMessage: (content: string) => void
  addAgentConversation: (msg: Omit<AgentConversationMessage, 'id' | 'timestamp'>) => void
  clearAgentConversation: () => void
  clearMessages: () => void
  setIsStreaming: (v: boolean) => void
  setActiveAgent: (id: string | null) => void
  setAbortController: (c: AbortController | null) => void
  stopGeneration: () => void
  persistMessages: () => void
  restoreMessages: () => Promise<void>
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  agentConversation: [],
  inputValue: '',
  isStreaming: false,
  activeAgentId: null,
  abortController: null,

  setInputValue: (value) => set({ inputValue: value }),

  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) =>
    set((s) => {
      const newMessages = [
        ...s.messages,
        { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now() },
      ]
      // 自动持久化
      try { api.storage.setData(STORAGE_KEY, JSON.stringify(newMessages.slice(-MAX_HISTORY))) } catch { /* skip */ }
      return { messages: newMessages }
    }),

  updateLastMessage: (content: string) =>
    set((s) => {
      const messages = [...s.messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].role === 'agent') {
        messages[lastIdx] = { ...messages[lastIdx], content }
      }
      try { api.storage.setData(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY))) } catch { /* skip */ }
      return { messages }
    }),

  addAgentConversation: (msg: Omit<AgentConversationMessage, 'id' | 'timestamp'>) =>
    set((s) => ({
      agentConversation: [
        ...s.agentConversation,
        { ...msg, id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now() },
      ],
    })),

  clearAgentConversation: () => set({ agentConversation: [] }),

  clearMessages: () => set({ messages: [] }),
  setIsStreaming: (v) => set({ isStreaming: v }),
  setActiveAgent: (id) => set({ activeAgentId: id }),
  setAbortController: (c) => set({ abortController: c }),
  stopGeneration: () => {
    const state = useChatStore.getState()
    state.abortController?.abort()
    set({ abortController: null, isStreaming: false })
  },

  /** 持久化消息到本地存储 */
  persistMessages: () => {
    const state = useChatStore.getState()
    const recent = state.messages.slice(-MAX_HISTORY)
    try {
      api.storage.setData(STORAGE_KEY, JSON.stringify(recent))
    } catch {
      // 存储失败，忽略
    }
  },

  /** 从本地存储恢复消息 */
  restoreMessages: async () => {
    try {
      const raw = await api.storage.getData(STORAGE_KEY)
      if (raw) {
        const messages = JSON.parse(raw)
        set({ messages })
      }
    } catch {
      // 读取失败，使用空消息
    }
  },
}))
