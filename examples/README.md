# AI Web Development - Practice Examples

Production-quality, runnable code examples demonstrating AI web development concepts from the [training documentation](../docs). Each example is a complete Next.js application that you can run, modify, and learn from.

## Overview

This repository contains **19+ runnable applications** covering Core Concepts and Shipping AI Features. Examples are designed as **progressive building blocks** — later examples import and extend earlier ones, creating a cohesive learning path that mirrors real-world development.

### Tech Stack

- **TypeScript** - Type safety across all examples
- **Next.js 16.1** - App Router for modern React patterns
- **Bun** - Fast runtime, package management, and testing
- **Tailwind CSS v3** - Utility-first styling (v3.4.17 for stability)
- **shadcn/ui** - Beautiful, accessible components (React 19)
- **Vercel AI SDK v6** - Unified AI framework with agents, tools, and streaming
- **Convex** - Local backend for data persistence (when needed)
- **llama.cpp** - Local inference for privacy and zero API costs

## Quick Start

### Prerequisites

1. **Install Bun** (if not already installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Install llama.cpp** (for local AI inference):
   ```bash
   # macOS
   brew install llama.cpp

   # Or download from: https://github.com/ggerganov/llama.cpp
   ```

3. **Start llama-server** (required for most examples):
   ```bash
   llama-server -hf ggml-org/gpt-oss-20b-GGUF --jinja -c 0 --host 127.0.0.1 --port 8033
   ```

   Leave this running in a terminal. Examples will automatically connect to it.

### Running Examples

```bash
# Install dependencies (from examples root)
cd examples
bun install

# Run any example
cd 01-core-concepts/01-llm-mechanics
bun run dev

# Open browser to http://localhost:3000
```

For examples that use Convex (message-design, observability, rag-systems):

```bash
cd examples/02-shipping-ai-features/02-message-design

# Terminal 1: Start Convex backend
bunx convex dev

# Terminal 2: Start Next.js
bun run dev
```

## Learning Path

Examples are organized in a recommended progression from foundational concepts to production patterns:

### Phase 1: Core Concepts (Foundations)

Start here to understand the mechanics of LLMs and how to interact with them.

#### 01-llm-mechanics
**Interactive token visualizer, context window simulator, cost calculator**

- Visualize how text is tokenized
- Explore context window limits
- Understand sampling parameters (temperature, top-p)
- Calculate API costs for different models
- **No AI calls** — pure educational tools

📖 **Docs**: [LLM Mechanics](../docs/01-core-concepts/llm-mechanics.md)

#### 02-prompting
**Prompt playground, few-shot examples, agent loops**

- Experiment with prompt engineering
- Compare few-shot vs zero-shot
- Implement chain-of-thought reasoning
- Build a basic agent loop
- **First llama-server integration**

📖 **Docs**: [Prompting and Interaction Patterns](../docs/01-core-concepts/prompting.md)

#### 03-mcp-protocol
**MCP server explorer, tool calling demos**

- Connect to MCP servers (filesystem, weather)
- Implement tool-based AI workflows
- Explore capability scoping
- Understand tool-use patterns

📖 **Docs**: [MCP Protocol Overview](../docs/01-core-concepts/mcp-protocol.md)

---

### Phase 2: Building Blocks (Basic AI Features)

Learn to build production UIs and manage state.

#### 01-product-patterns
**Foundation chat UI, streaming responses, citations**

- Build a complete chat interface
- Implement streaming responses
- Add confidence indicators
- Show source citations
- **Exports reusable chat components for later examples**

📖 **Docs**: [Product Patterns and UX](../docs/04-shipping-ai-features/product-patterns-ux.md)

#### 02-message-design
**Persistent chat with memory, conversation management**

- Add conversation persistence with Convex
- Implement message threading
- Manage conversation context
- **Imports chat UI from product-patterns**

📖 **Docs**: [Message Design and State](../docs/04-shipping-ai-features/message-design-state.md)

#### 03-output-control
**Structured outputs, Zod validation, repair strategies**

- Generate structured JSON
- Validate with Zod schemas
- Implement repair loops
- Stream structured data
- **Exports validation utilities**

📖 **Docs**: [Output Control and Reliability](../docs/04-shipping-ai-features/output-control.md)

---

### Phase 3: Production Patterns (Reliability)

Build robust, production-ready AI features.

#### 04-api-integration
**Multi-level caching, retry logic, idempotency**

- Implement caching strategies
- Add exponential backoff retry
- Handle rate limits gracefully
- Ensure idempotent operations

📖 **Docs**: [API Integration Patterns](../docs/04-shipping-ai-features/api-integration.md)

#### 05-thinking-models
**Reasoning model comparison**

- Compare standard vs reasoning models
- Visualize reasoning traces
- Understand when to use extended thinking
- Manage cost vs quality trade-offs

📖 **Docs**: [Native Thinking Models](../docs/04-shipping-ai-features/thinking-models.md)

#### 06-multi-agent
**Agent orchestration patterns**

- Sequential pipelines
- Parallel fan-out/fan-in
- Maker-checker workflows
- **Uses AI SDK v6 agents**

📖 **Docs**: [Multi-Agent Orchestration](../docs/04-shipping-ai-features/multi-agent-orchestration.md)

---

### Phase 4: Safety & Quality (Operational Excellence)

Implement guardrails, testing, and security.

#### 07-guardrails
**PII redaction, data classification**

- Detect and redact sensitive information
- Classify data sensitivity
- Implement safe defaults
- Prevent data leakage

📖 **Docs**: [Operational Guardrails](../docs/04-shipping-ai-features/guardrails.md)

#### 08-evals-basics
**Evaluation harness, golden test sets**

- Define success criteria
- Create golden test cases
- Run offline evaluations
- Measure quality metrics

📖 **Docs**: [Evals Basics](../docs/04-shipping-ai-features/evals-basics.md)

#### 09-moderation
**Content filtering, rate limiting**

- Layer moderation strategies
- Implement rate limiters
- Handle abuse patterns
- User reporting flows

📖 **Docs**: [Moderation and Policy Enforcement](../docs/04-shipping-ai-features/moderation-policy.md)

#### 10-security
**Prompt injection defense**

- Demonstrate attack vectors
- Implement defense-in-depth
- Sandbox tool execution
- Input validation layers

📖 **Docs**: [Security](../docs/04-shipping-ai-features/security.md)

---

### Phase 5: Advanced Topics (Scaling to Production)

Master advanced patterns for production systems.

#### 11-observability
**Tracing, monitoring dashboards**

- Implement OpenTelemetry tracing
- Track costs in real-time
- Monitor quality drift
- Store traces in Convex

📖 **Docs**: [Observability and Monitoring](../docs/04-shipping-ai-features/observability.md)

#### 12-evals-cicd
**CI/CD integration for evals**

- GitHub Actions workflow
- Automated quality gates
- Regression detection
- CI results visualization

📖 **Docs**: [Repeatable Evals and CI/CD](../docs/04-shipping-ai-features/evals-cicd.md)

#### 13-rag-systems
**Complete RAG pipeline**

- Document chunking strategies
- Vector embeddings and indexing
- Hybrid search (semantic + keyword)
- Reranking and grounding
- **Uses Convex for document storage**

📖 **Docs**: [RAG Systems](../docs/04-shipping-ai-features/rag-systems.md)

#### 14-fine-tuning
**Decision framework, data preparation**

- When to fine-tune vs prompt/RAG
- Data preparation pipelines
- Evaluation strategies
- Lifecycle management

📖 **Docs**: [Fine-Tuning Strategy](../docs/04-shipping-ai-features/fine-tuning.md)

#### 15-model-routing
**Dynamic model selection**

- Route requests by complexity
- Implement fallback chains
- Optimize cost vs quality
- Cache routing decisions

📖 **Docs**: [Model Routing and Cost Engineering](../docs/04-shipping-ai-features/model-routing.md)

#### 16-deployment-versioning
**Prompt version management**

- Version control for prompts
- A/B testing strategies
- Rollback mechanisms
- **Uses Convex for version storage**

📖 **Docs**: [Deployment and Versioning](../docs/04-shipping-ai-features/deployment-versioning.md)

#### 17-voice-interfaces
**Voice pipeline demo**

- Speech-to-text (STT)
- LLM processing
- Text-to-speech (TTS)
- Voice activity detection
- Latency optimization

📖 **Docs**: [Voice Interfaces](../docs/04-shipping-ai-features/voice-interfaces.md)

---

## Architecture

### Monorepo Structure

```
examples/
├── package.json           # Workspace root
├── shared/                # Shared utilities (@examples/shared)
│   ├── lib/
│   │   ├── ai/            # AI client, streaming
│   │   ├── hooks/         # React hooks
│   │   ├── utils/         # Token estimation, errors
│   │   └── testing/       # Mocks, fixtures
│   ├── components/
│   │   ├── ui/            # shadcn/ui components
│   │   └── chat/          # Chat UI (Message, Thread, Input)
│   ├── config/            # Tailwind, TypeScript, Next.js
│   └── types/             # Shared TypeScript types
├── 01-core-concepts/      # 3 examples
└── 02-shipping-ai-features/ # 16 examples
```

### Progressive Building

Later examples import from earlier ones:

```typescript
// Early example exports components
// 01-product-patterns/components/chat-interface.tsx
export function ChatInterface() { ... }

// Later example imports them
// 13-rag-systems/app/page.tsx
import { ChatInterface } from '@examples/product-patterns/components';
```

This mirrors real-world development where you build reusable components and extend them over time.

## Shared Package

The `@examples/shared` package provides the foundation for all examples:

### AI Client

Unified interface for llama-server with cloud fallback:

```typescript
import { LlamaClient } from '@examples/shared/lib/ai/llama-client';

const client = new LlamaClient();
const response = await client.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### React Hooks

Common patterns as reusable hooks:

```typescript
import { useLlama, useStreaming } from '@examples/shared/lib/hooks';
```

### UI Components

Pre-built components following best practices:

```typescript
import { Message, ChatThread, ChatInput } from '@examples/shared/components/chat';
import { Button, Card, Badge } from '@examples/shared/components/ui';
```

### Utilities

Token estimation, error handling, and more:

```typescript
import { estimateTokens, formatCost, withRetry } from '@examples/shared/lib/utils';
```

## Testing

Each example includes tests at multiple levels:

### Unit Tests

```bash
cd examples/01-core-concepts/01-llm-mechanics
bun test
```

### Integration Tests

```bash
bun test --filter integration
```

### E2E Tests (select examples)

```bash
bun test:e2e
```

### Eval Tests (AI behavior)

```bash
bun test evals/
```

## Cloud Provider Fallback (Optional)

While examples work with local llama-server, you can configure cloud fallback:

```typescript
// .env.local
OPENAI_API_KEY=sk-...

// Usage
const client = new LlamaClient({
  fallbackProvider: {
    name: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  },
});
```

## Troubleshooting

### llama-server connection fails

**Problem**: Examples can't connect to llama-server

**Solutions**:
1. Ensure llama-server is running: `llama-server -hf ggml-org/gpt-oss-20b-GGUF --jinja -c 0 --host 127.0.0.1 --port 8033`
2. Check that port 8033 is not blocked
3. Configure cloud fallback (see above)

### Convex initialization fails

**Problem**: `bunx convex dev` fails to start

**Solutions**:
1. Ensure you're in the correct example directory
2. Run `bunx convex dev` again (it may need to create initial schema)
3. Check Convex logs for specific errors

### Module not found errors

**Problem**: Can't import from `@examples/shared`

**Solutions**:
1. Run `bun install` from the `/examples` root
2. Ensure you're using Bun workspaces (check root package.json)
3. Try `bun install --force`

### TypeScript errors

**Problem**: Type errors when importing shared code

**Solutions**:
1. Run `bun run typecheck` to see all errors
2. Ensure `@examples/shared` is installed in example's package.json
3. Check that paths in tsconfig.json are correct

## Contributing

When adding new examples:

1. Follow the existing structure (app/, lib/, __tests__/)
2. Import from `@examples/shared` where possible
3. Add a comprehensive README.md
4. Include tests for core functionality
5. Update this master README

## Resources

- [Documentation](../docs) - Conceptual guides
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Local inference engine
- [Vercel AI SDK](https://ai-sdk.dev/) - AI framework documentation
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Convex](https://docs.convex.dev/) - Backend platform

## License

Same license as the parent repository.
