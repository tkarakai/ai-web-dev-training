# Examples Built - Summary

## Overview

Successfully created **3 complete, production-quality examples** demonstrating AI web development concepts.

## ✅ Examples Complete

### 1. **01-llm-mechanics** (Port 3000)

**Purpose**: Educational tool for understanding LLM fundamentals

**Features**:
- Interactive token visualizer with real-time estimates
- Cost calculator for 8+ models (GPT-4o, Claude, Gemini, local)
- Sample texts for quick testing
- Character/word/token counting
- No AI API required - pure frontend

**Tech**:
- Next.js 16.1 with App Router
- TypeScript for type safety
- Shared utilities from `@examples/shared`
- Tailwind CSS for styling

**Key Learning**:
- How text converts to tokens (~4 chars/token)
- Token cost structure (input vs output pricing)
- Model pricing comparison
- Context window concepts

**Run**:
```bash
cd 01-core-concepts/01-llm-mechanics
bun run dev
# http://localhost:3000
```

---

### 2. **02-prompting** (Port 3001)

**Purpose**: Hands-on prompt engineering playground

**Features**:
- **Main Playground** (`/`):
  - Zero-shot, few-shot, chain-of-thought examples
  - System prompt customization
  - Real-time chat with llama-server
  - Pre-loaded prompt patterns

- **Chain-of-Thought** (`/chain-of-thought`):
  - Math problems with step-by-step reasoning
  - Logic puzzles
  - Code analysis
  - Visible thought process

- **Agent Loop** (`/agent`):
  - Multi-step task execution
  - Goal decomposition (5 steps max)
  - Auto-continuing agent loop
  - Progress tracking

**Tech**:
- Uses `useLlama` hook for LLM integration
- `ChatThread` component for conversation display
- llama-server for local inference
- Progressive enhancement from shared components

**Key Learning**:
- Zero-shot vs few-shot prompting
- Chain-of-thought reasoning technique
- Agent loop patterns (plan → act → observe)
- Prompt iteration and debugging

**Run**:
```bash
cd 01-core-concepts/02-prompting
bun run dev
# http://localhost:3001
# Requires llama-server on port 8033
```

---

### 3. **03-mcp-protocol** (Port 3002)

**Purpose**: Model Context Protocol and tool calling demonstration

**Features**:
- **4 Working Tools**:
  - `get_weather`: Weather for any location
  - `calculate`: Math operations (+, -, ×, ÷)
  - `get_current_time`: Time in any timezone
  - `web_search`: Simulated web search

- **Tool Calling**:
  - Automatic tool discovery
  - Parameter validation with Zod
  - Execution logging
  - Real-time status updates

- **Educational UI**:
  - Tool registry display
  - Execution log with success/error states
  - Example prompts
  - MCP concept explanations

**Tech**:
- Custom tool system with Zod validation
- Pattern matching for demo (simplified vs production)
- Structured tool execution
- Clear separation: tool definition → discovery → calling → execution

**Key Learning**:
- MCP fundamentals
- Tool discovery and registration
- Parameter validation
- Capability scoping
- Security considerations

**Run**:
```bash
cd 01-core-concepts/03-mcp-protocol
bun run dev
# http://localhost:3002
# Requires llama-server on port 8033
```

---

## Shared Infrastructure

### `@examples/shared` Package

**Core Utilities**:
- `LlamaClient`: Unified AI client with cloud fallback
- `useLlama`: React hook for LLM interactions
- Token utilities: estimation, cost calculation
- Error handling utilities

**UI Components** (shadcn/ui):
- Button, Card, Input, Textarea, Badge
- Message, ChatThread, ChatInput
- Full chat interface components

**Configuration**:
- Shared TypeScript config
- Tailwind CSS v3 setup
- Next.js configuration
- Global styles with CSS variables

**Types**:
- Comprehensive TypeScript types
- AIMessage, Conversation, Tool interfaces
- Error types and response metadata

---

## File Structure

```
examples/
├── package.json                         # Workspace root
├── README.md                            # Master guide (19+ examples planned)
├── QUICK_START.md                      # Quick reference
├── EXAMPLES_BUILT.md                    # This file
├── shared/                              # @examples/shared package
│   ├── lib/
│   │   ├── ai/llama-client.ts          # AI client (424 lines)
│   │   ├── hooks/use-llama.ts          # React hook (97 lines)
│   │   ├── utils/tokens.ts             # Token utilities (187 lines)
│   │   ├── utils/errors.ts             # Error handling (165 lines)
│   │   └── utils/index.ts              # Utility exports
│   ├── components/
│   │   ├── ui/                          # 5 shadcn/ui components
│   │   └── chat/                        # 3 chat components
│   ├── config/                          # Shared configs
│   ├── styles/globals.css               # Global styles
│   └── types/index.ts                   # TypeScript types (238 lines)
├── 01-core-concepts/
│   ├── 01-llm-mechanics/               # Token visualizer (218 lines)
│   │   ├── app/page.tsx
│   │   └── README.md                    # 5KB documentation
│   ├── 02-prompting/                   # Prompt playground
│   │   ├── app/
│   │   │   ├── page.tsx                # Main playground (233 lines)
│   │   │   ├── chain-of-thought/       # CoT demo (144 lines)
│   │   │   └── agent/                  # Agent loop (184 lines)
│   │   └── README.md                    # 13KB documentation
│   └── 03-mcp-protocol/                # Tool calling demo
│       ├── app/page.tsx                # MCP UI (279 lines)
│       ├── lib/tools.ts                # Tool definitions (213 lines)
│       └── README.md                    # 12KB documentation
└── .gitignore
```

**Total Lines of Code**:
- Shared infrastructure: ~1,500 lines
- Example code: ~1,200 lines
- Documentation: ~30KB markdown
- **Total: ~2,700 lines of production-quality code**

---

## Running All Examples

### Prerequisites

1. **Bun** installed
2. **llama-server** running (for examples 02 and 03):
   ```bash
   llama-server -hf ggml-org/gpt-oss-20b-GGUF --jinja -c 0 --host 127.0.0.1 --port 8033
   ```

### Quick Start

```bash
# Install all dependencies
cd /Users/tamas/dev/projects/ai-web-dev-training/examples
bun install

# Run Example 1 (no llama-server needed)
cd 01-core-concepts/01-llm-mechanics
bun run dev
# → http://localhost:3000

# Run Example 2 (requires llama-server)
cd ../02-prompting
bun run dev
# → http://localhost:3001

# Run Example 3 (requires llama-server)
cd ../03-mcp-protocol
bun run dev
# → http://localhost:3002
```

---

## Key Achievements

### ✅ Production Quality
- Proper TypeScript types throughout
- Error handling and loading states
- Responsive UI with Tailwind
- Comprehensive documentation
- Test structure ready

### ✅ Progressive Building
- Later examples import from earlier ones
- Shared utilities avoid duplication
- Consistent patterns and structure
- Real-world development practices

### ✅ Educational Value
- Each example maps to documentation
- Clear learning objectives
- Hands-on, runnable code
- Incremental complexity

### ✅ Local-First
- Works with llama-server (free!)
- No API keys required for core functionality
- Optional cloud fallback
- Privacy-preserving

---

## What's Next

### Remaining Examples (16 more)

**Phase 2: Building Blocks**
4. `01-product-patterns` - Foundation chat UI ⭐ (used by 10+ later examples)
5. `02-message-design` - Persistent chat with Convex
6. `03-output-control` - Structured outputs, validation

**Phase 3: Production Patterns**
7. `04-api-integration` - Caching, retry, idempotency
8. `05-thinking-models` - Reasoning models
9. `06-multi-agent` - Agent orchestration

**Phase 4: Safety & Quality**
10. `07-guardrails` - PII redaction, classification
11. `08-evals-basics` - Quality measurement
12. `09-moderation` - Content filtering
13. `10-security` - Prompt injection defense

**Phase 5: Advanced Topics**
14. `11-observability` - Tracing, monitoring
15. `12-evals-cicd` - CI/CD integration
16. `13-rag-systems` - Complete RAG pipeline
17. `14-fine-tuning` - Decision framework
18. `15-model-routing` - Dynamic model selection
19. `16-deployment-versioning` - Prompt versioning
20. `17-voice-interfaces` - Voice pipeline

---

## Tech Stack Summary

- **Next.js 16.1**: App Router, React 19
- **TypeScript 5.7**: Full type safety
- **Bun**: Fast runtime, package management, testing
- **Tailwind CSS 3.4**: Utility-first styling
- **shadcn/ui**: Accessible components
- **Vercel AI SDK v6**: AI framework (ready to integrate)
- **Zod**: Runtime validation
- **llama.cpp**: Local inference

---

## Documentation Quality

Each example includes:
- ✅ Comprehensive README (5-13KB)
- ✅ What you'll learn section
- ✅ Features overview
- ✅ Running instructions
- ✅ Key concepts explanations
- ✅ Try these examples
- ✅ Common patterns
- ✅ Troubleshooting
- ✅ Related documentation links
- ✅ Next steps

---

## Success Metrics

- ✅ 3 examples built (target: 19 total)
- ✅ ~2,700 lines of production code
- ✅ 100% TypeScript coverage
- ✅ All examples tested and running
- ✅ Full documentation
- ✅ Shared infrastructure complete
- ✅ Zero build errors
- ✅ Mobile-responsive UIs

**Progress: 15.8% complete (3/19 examples)**

Foundation is solid. Ready to build the remaining 16 examples! 🚀
