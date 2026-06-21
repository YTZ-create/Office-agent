import React, { useRef } from 'react'
import { Send, Square } from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useFolderStore } from '../../stores/folderStore'
import { agentRegistry } from '../../agents/registry'
import { getKnowledgeBase } from '../../knowledge'
import { getMemoryStore } from '../../memory'
import { getDependencyAnalyzer } from '../../codebase'
import { detectHandoff } from '../../utils/handoff'
import { START_REPLIES, END_REPLIES, randomPick } from '../../utils/replies'

export const ChatInput: React.FC = () => {
  const { inputValue, setInputValue, addMessage, updateLastMessage, setIsStreaming, activeAgentId, messages, isStreaming, stopGeneration } = useChatStore()
  const activeFolderId = useFolderStore((s) => s.activeFolderId)
  const activeFolder = useFolderStore((s) => s.folders.find((f) => f.id === activeFolderId))
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text) return
    if (!activeFolder) {
      addMessage({ role: 'system', content: '请先在侧边栏选择一个文件夹' })
      return
    }

    addMessage({ role: 'user', content: text })
    setInputValue('')
    setIsStreaming(true)

    const controller = new AbortController()
    useChatStore.getState().setAbortController(controller)

    // 构建对话历史 - 使用 store 的最新状态
    const currentMessages = useChatStore.getState().messages
    const history: { role: 'user' | 'agent'; content: string; agentName?: string }[] = currentMessages
      .filter((m) => m.role === 'user' || m.role === 'agent')
      .map((m) => ({ role: m.role as 'user' | 'agent', content: m.content, agentName: m.agentName }))

    try {
      const agentId = activeAgentId || 'leader'
      const agent = agentRegistry.get(agentId)
      const config = agentRegistry.getConfig(agentId)

      // Phase 2: 知识库检索
      let knowledgeContext: string | undefined
      try {
        const kb = getKnowledgeBase()
        if (activeFolder.files) {
          if (!kb.isBuiltFor(activeFolder.path)) {
            await kb.buildFromFileTree(activeFolder.files, activeFolder.path)
          }
          knowledgeContext = kb.getRelevantContext(text)
        }
      } catch {
        // KB 未初始化或构建失败，不影响主流程
      }

      // Phase 5: 代码库依赖分析（仅对 code-reviewer 和 file-analyzer）
      let codebaseContext: string | undefined
      const analysisAgentIds = ['code-reviewer', 'file-analyzer']
      if (analysisAgentIds.includes(agentId)) {
        try {
          const analyzer = getDependencyAnalyzer()
          if (activeFolder.files && !analyzer.isBuiltFor(activeFolder.path)) {
            await analyzer.buildFromFileTree(activeFolder.files, activeFolder.path)
          }
          codebaseContext = analyzer.getContextForLLM()
        } catch {
          // 依赖分析失败不影响主流程
        }
      }

      if (agent) {
        // 先添加一个空的 agent 消息占位
        addMessage({ role: 'agent', content: '', agentName: config?.name, agentColor: config?.color })
        // 流式输出
        const result = await agent.execute(
          { folder: activeFolder, userMessage: text, history, signal: controller.signal, knowledgeContext, codebaseContext },
          (token: string) => {
            if (controller.signal.aborted) return
            const state = useChatStore.getState()
            const lastMsg = state.messages[state.messages.length - 1]
            if (lastMsg && lastMsg.role === 'agent') {
              updateLastMessage(lastMsg.content + token)
            }
          }
        )

        if (controller.signal.aborted) return

        // 如果 LeaderAgent 返回了调度指令，创建子 Agent 的新消息气泡
        if (agentId === 'leader') {
          try {
            const dispatch = JSON.parse(result)
            if (dispatch.__dispatch) {
              const subAgent = agentRegistry.get(dispatch.targetAgentId)
              const subConfig = agentRegistry.getConfig(dispatch.targetAgentId)
              if (subAgent) {
                // 创建子 Agent 的消息气泡
                addMessage({ role: 'agent', content: '', agentName: dispatch.agentName, agentColor: dispatch.agentColor })
                // 推送 Leader 调度通知到对话面板
                useChatStore.getState().addAgentConversation({
                  agentName: 'Oliver',
                  agentColor: '#FFD440',
                  content: ` 已将任务分配给 **${dispatch.agentName}**`,
                  isLeader: true,
                })
                const subResult = await subAgent.execute(
                  { folder: activeFolder, userMessage: text, leaderContext: dispatch.leaderContext, history, signal: controller.signal, knowledgeContext, codebaseContext },
                  (token: string) => {
                    if (controller.signal.aborted) return
                    const state = useChatStore.getState()
                    const lastMsg = state.messages[state.messages.length - 1]
                    if (lastMsg && lastMsg.role === 'agent') {
                      updateLastMessage(lastMsg.content + token)
                    }
                  }
                )
                if (controller.signal.aborted) return
                // 子 Agent 完成通知（随机回复）
                useChatStore.getState().addAgentConversation({
                  agentName: dispatch.agentName,
                  agentColor: dispatch.agentColor,
                  content: randomPick(END_REPLIES),
                  isLeader: false,
                })

                // 检测子 Agent 的手交指令（仅限一次，防止循环）
                const handoff = detectHandoff(subResult)
                if (handoff) {
                  const nextAgent = agentRegistry.get(handoff.targetAgentId)
                  const nextConfig = agentRegistry.getConfig(handoff.targetAgentId)
                  if (nextAgent && nextConfig) {
                    // 推送手交通知
                    useChatStore.getState().addAgentConversation({
                      agentName: dispatch.agentName,
                      agentColor: dispatch.agentColor,
                      content: ` 任务已转交给 **${nextConfig.name}**`,
                      isLeader: true,
                    })
                    // 创建被手交 Agent 的消息气泡
                    addMessage({ role: 'agent', content: '', agentName: nextConfig.name, agentColor: nextConfig.color })
                    await nextAgent.execute(
                      { folder: activeFolder, userMessage: text, history, signal: controller.signal, knowledgeContext, codebaseContext },
                      (token: string) => {
                        if (controller.signal.aborted) return
                        const state = useChatStore.getState()
                        const lastMsg = state.messages[state.messages.length - 1]
                        if (lastMsg && lastMsg.role === 'agent') {
                          updateLastMessage(lastMsg.content + token)
                        }
                      }
                    )
                    if (!controller.signal.aborted) {
                      useChatStore.getState().addAgentConversation({
                        agentName: nextConfig.name,
                        agentColor: nextConfig.color,
                        content: randomPick(END_REPLIES),
                        isLeader: false,
                      })
                      // 不再继续检测手交，防止循环
                    }
                  }
                }
              }
            }
          } catch {
            // 不是调度指令，忽略
          }
        } else {
          // 直接调用子 Agent 时，也推送开始和结束回复到对话面板
          useChatStore.getState().addAgentConversation({
            agentName: config?.name || 'Agent',
            agentColor: config?.color || '#FFD440',
            content: randomPick(START_REPLIES),
            isLeader: false,
          })
          useChatStore.getState().addAgentConversation({
            agentName: config?.name || 'Agent',
            agentColor: config?.color || '#FFD440',
            content: randomPick(END_REPLIES),
            isLeader: false,
          })

          // 检测手交指令（仅限一次，防止循环）
          const handoff = detectHandoff(result)
          if (handoff) {
            const nextAgent = agentRegistry.get(handoff.targetAgentId)
            const nextConfig = agentRegistry.getConfig(handoff.targetAgentId)
            if (nextAgent && nextConfig) {
              useChatStore.getState().addAgentConversation({
                agentName: config?.name || 'Agent',
                agentColor: config?.color || '#FFD440',
                content: ` 任务已转交给 **${nextConfig.name}**`,
                isLeader: true,
              })
              addMessage({ role: 'agent', content: '', agentName: nextConfig.name, agentColor: nextConfig.color })
              await nextAgent.execute(
                { folder: activeFolder, userMessage: text, history, signal: controller.signal, knowledgeContext, codebaseContext },
                (token: string) => {
                  if (controller.signal.aborted) return
                  const state = useChatStore.getState()
                  const lastMsg = state.messages[state.messages.length - 1]
                  if (lastMsg && lastMsg.role === 'agent') {
                    updateLastMessage(lastMsg.content + token)
                  }
                }
              )
              if (!controller.signal.aborted) {
                useChatStore.getState().addAgentConversation({
                  agentName: nextConfig.name,
                  agentColor: nextConfig.color,
                  content: randomPick(END_REPLIES),
                  isLeader: false,
                })
              }
            }
          }
        }
      } else {
        addMessage({ role: 'system', content: '未找到对应的 Agent' })
      }

      // Phase 3: 自动记忆 — 分析完成后存储结果摘要
      try {
        const memoryStore = getMemoryStore()
        const currentMessages = useChatStore.getState().messages
        const lastAgentMsg = [...currentMessages].reverse().find((m) => m.role === 'agent')
        if (lastAgentMsg && lastAgentMsg.content && lastAgentMsg.content.length > 100) {
          const summary = lastAgentMsg.content.substring(0, 2000)
          memoryStore.upsert({
            category: 'analysis-result',
            key: `proj:${activeFolder.path.replace(/[/\\:]/g, '-')}:analysis-${Date.now()}`,
            content: summary,
            tags: [activeFolder.path.split(/[/\\]/).pop() || 'project', config?.name || 'agent'],
            projectPath: activeFolder.path,
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 天 TTL
          })
        }
      } catch {
        // 自动记忆失败不影响主流程
      }
    } catch (err: any) {
      if (controller.signal.aborted) {
        addMessage({ role: 'system', content: '已停止生成' })
      } else {
        addMessage({ role: 'system', content: `错误: ${err.message}` })
      }
    } finally {
      useChatStore.getState().setAbortController(null)
      setIsStreaming(false)
    }
  }

  const allAgents = agentRegistry.getAll()
  const quickActions = allAgents.map((a) => ({
    id: a.id,
    label: a.name,
    icon: React.createElement(a.icon, { size: 12 }),
  }))

  return (
    <div className="border-t-2 border-brutal-black bg-white p-3">
      <div className="flex items-center gap-1.5 mb-2">
        {quickActions.map((a) => (
          <button key={a.id}
            onClick={() => { useChatStore.getState().setActiveAgent(a.id) }}
            className={`tab-brutal text-xs flex items-center gap-1.5 ${activeAgentId === a.id ? 'active' : ''}`}>
            {a.icon}{a.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-black/70 font-mono">{activeFolder ? 'Enter 发送' : '请选择文件夹'}</span>
      </div>
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="text" value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="用自然语言描述你的需求..."
          className="input-brutal flex-1 text-sm" disabled={!activeFolder || isStreaming} />
        {isStreaming ? (
          <button onClick={stopGeneration}
            className="btn-brutal bg-brutal-pink text-white p-2.5 flex-shrink-0 hover:bg-brutal-pink/80"
            title="停止生成">
            <Square size={16} fill="white" />
          </button>
        ) : (
          <button onClick={handleSend} disabled={!inputValue.trim() || !activeFolder}
            className="btn-brutal bg-brutal-yellow p-2.5 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
