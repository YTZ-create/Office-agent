import { api } from '../api/neutralino'

interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LLMOptions {
  provider: string
  model: string
  messages: LLMMessage[]
  signal?: AbortSignal
  /** 可选：自定义 API Key 获取方式。不传则使用默认的 Neutralino storage */
  apiKeyProvider?: () => Promise<string | null>
  /** 可选：Token 用量回调 */
  onTokenUsage?: (promptTokens: number, completionTokens: number) => void
}

const PROVIDER_CONFIGS: Record<string, { baseURL: string; defaultModel: string }> = {
  openai: { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  anthropic: { baseURL: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-6' },
  google: { baseURL: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.5-flash' },
  deepseek: { baseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  zhipu: { baseURL: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
  qwen: { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
  moonshot: { baseURL: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
}

async function resolveApiKey(opts: LLMOptions): Promise<string> {
  if (opts.apiKeyProvider) {
    return (await opts.apiKeyProvider()) || ''
  }
  return (await api.settings.getApiKey(opts.provider)) || ''
}

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1500

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: any
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      if (attempt < MAX_RETRIES) {
        console.warn(`[LLM] ${label} 第 ${attempt + 1} 次失败，${RETRY_DELAY_MS}ms 后重试:`, err?.message || err)
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      }
    }
  }
  throw lastErr
}

export async function callLLM(opts: LLMOptions): Promise<string> {
  const apiKey = await resolveApiKey(opts)
  if (!apiKey) throw new Error(`未配置 ${opts.provider} 的 API Key，请在设置中填写。`)

  const config = PROVIDER_CONFIGS[opts.provider]
  if (!config) throw new Error(`不支持的模型厂商: ${opts.provider}`)

  const model = opts.model || config.defaultModel

  return withRetry(() => {
    if (opts.provider === 'anthropic') return callAnthropic(apiKey, model, opts)
    if (opts.provider === 'google') return callGoogle(apiKey, model, opts)
    return callOpenAICompatible(config.baseURL, apiKey, model, opts)
  }, `callLLM(${opts.provider}/${model})`)
}

export async function callLLMStream(
  opts: LLMOptions,
  onToken: (token: string) => void,
): Promise<string> {
  const apiKey = await resolveApiKey(opts)
  if (!apiKey) throw new Error(`未配置 ${opts.provider} 的 API Key，请在设置中填写。`)

  const config = PROVIDER_CONFIGS[opts.provider]
  if (!config) throw new Error(`不支持的模型厂商: ${opts.provider}`)

  const model = opts.model || config.defaultModel

  return withRetry(() => {
    if (opts.provider === 'anthropic') return callAnthropicStream(apiKey, model, opts, onToken)
    if (opts.provider === 'google') return callGoogleStream(apiKey, model, opts, onToken)
    return callOpenAICompatibleStream(config.baseURL, apiKey, model, opts, onToken)
  }, `callLLMStream(${opts.provider}/${model})`)
}

async function callOpenAICompatible(baseURL: string, apiKey: string, model: string, opts: LLMOptions): Promise<string> {
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: opts.messages, max_tokens: 4096, temperature: 0.7 }),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`API 调用失败 (${res.status}): ${err}`) }
  const data = await res.json()
  if (opts.onTokenUsage && data.usage) {
    opts.onTokenUsage(data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0)
  }
  return data.choices?.[0]?.message?.content || ''
}

async function callOpenAICompatibleStream(
  baseURL: string, apiKey: string, model: string, opts: LLMOptions,
  onToken: (token: string) => void,
): Promise<string> {
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: opts.messages, max_tokens: 4096, temperature: 0.7, stream: true }),
    signal: opts.signal,
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`API 调用失败 (${res.status}): ${err}`) }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('不支持的响应流')
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return fullText
      try {
        const json = JSON.parse(data)
        const token = json.choices?.[0]?.delta?.content || ''
        if (token) { fullText += token; onToken(token) }
        // OpenAI 兼容格式的 usage 在最后一条消息中
        if (opts.onTokenUsage && json.usage) {
          opts.onTokenUsage(json.usage.prompt_tokens || 0, json.usage.completion_tokens || 0)
        }
      } catch { /* skip */ }
    }
  }
  return fullText
}

async function callAnthropic(apiKey: string, model: string, opts: LLMOptions): Promise<string> {
  const systemMsg = opts.messages.find((m) => m.role === 'system')
  const chatMessages = opts.messages.filter((m) => m.role !== 'system')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      system: systemMsg?.content || '',
      messages: chatMessages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      max_tokens: 4096,
    }),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Anthropic API 调用失败 (${res.status}): ${err}`) }
  const data = await res.json()
  if (opts.onTokenUsage && data.usage) {
    opts.onTokenUsage(data.usage.input_tokens || 0, data.usage.output_tokens || 0)
  }
  return data.content?.[0]?.text || ''
}

async function callAnthropicStream(
  apiKey: string, model: string, opts: LLMOptions,
  onToken: (token: string) => void,
): Promise<string> {
  const systemMsg = opts.messages.find((m) => m.role === 'system')
  const chatMessages = opts.messages.filter((m) => m.role !== 'system')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      system: systemMsg?.content || '',
      messages: chatMessages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      max_tokens: 4096,
      stream: true,
    }),
    signal: opts.signal,
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Anthropic API 调用失败 (${res.status}): ${err}`) }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('不支持的响应流')
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let anthropicInputTokens = 0
  let anthropicOutputTokens = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          const token = json.delta.text || ''
          if (token) { fullText += token; onToken(token) }
        }
        if (json.type === 'message_start' && json.message?.usage) {
          anthropicInputTokens = json.message.usage.input_tokens || 0
        }
        if (json.type === 'message_delta' && json.usage) {
          anthropicOutputTokens = json.usage.output_tokens || 0
        }
      } catch { /* skip */ }
    }
  }
  if (opts.onTokenUsage) {
    opts.onTokenUsage(anthropicInputTokens, anthropicOutputTokens)
  }
  return fullText
}

async function callGoogle(apiKey: string, model: string, opts: LLMOptions): Promise<string> {
  const systemMsg = opts.messages.find((m) => m.role === 'system')
  const contents = opts.messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: systemMsg ? { parts: { text: systemMsg.content } } : undefined,
      contents,
      generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
    }),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Google API 调用失败 (${res.status}): ${err}`) }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callGoogleStream(
  apiKey: string, model: string, opts: LLMOptions,
  onToken: (token: string) => void,
): Promise<string> {
  const systemMsg = opts.messages.find((m) => m.role === 'system')
  const contents = opts.messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: systemMsg ? { parts: { text: systemMsg.content } } : undefined,
      contents,
      generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
    }),
    signal: opts.signal,
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Google API 调用失败 (${res.status}): ${err}`) }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('不支持的响应流')
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      try {
        const json = JSON.parse(data)
        const token = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (token) { fullText += token; onToken(token) }
      } catch { /* skip */ }
    }
  }
  return fullText
}
