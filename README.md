# Office Agent

基于多 Agent 协作的桌面 AI 助手，支持文件夹分析、代码审查、文档摘要、文件整理等功能。

## 功能特性

- **多 Agent 协作**：Leader Agent 自动分解任务，分配给专业 Agent 并行处理，交叉评审后汇总结果
- **文件夹分析**（Charlotte）：扫描项目结构、技术栈、依赖关系，给出改进建议
- **代码审查**（William）：分析代码质量、安全隐患、性能问题，提供优化方案
- **文档摘要**（Amelia）：提取文档核心内容，生成结构化摘要
- **文件整理**（James）：自动分类、重命名、重组文件夹
- **跨会话记忆**（Memory Agent）：记住用户偏好和历史交互，提供个性化服务
- **多模型支持**：兼容 OpenAI、Ollama、LM Studio 等任意 OpenAI 兼容 API

## 技术栈

- **前端**：React 18 + TypeScript + Tailwind CSS
- **桌面框架**：Neutralinojs
- **状态管理**：Zustand
- **构建工具**：Vite 5

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev          # 启动 Vite 开发服务器
npm run neu:dev      # 启动 Neutralinojs 桌面应用（带调试器）
```

### 构建桌面应用

```bash
npm run neu:build    # 构建并打包 Neutralinojs 应用
```

### 配置 API

启动应用后，点击底部状态栏的 **配置 API Key**，填入你的 API 地址和密钥即可使用。

## 项目结构

```
src/
  main/              # Neutralinojs 主进程（Native API）
  renderer/          # React 渲染进程
    agents/          # Agent 定义与注册
    components/      # UI 组件
    memory/          # 记忆存储
    store/           # Zustand 状态管理
    utils/           # LLM 调用、工具函数
```

## License

MIT
