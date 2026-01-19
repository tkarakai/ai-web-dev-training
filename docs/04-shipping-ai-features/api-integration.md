# API Integration Patterns and Architecture

Building reliable, cost-effective AI integrations with proper error handling and caching.

## TL;DR

- Choose **chat vs completion vs agentic** APIs based on your use case
- Implement **caching** at multiple levels—prompt, semantic, response
- Handle **retries and idempotency** for resilient integrations
- Control **side effects** in tool-using agents—sandbox when possible
- Use **MCP** for standardized tool integration in production

## Core Concepts

### API Types and When to Use Them

#### Provider SDK Versions: What They Mean

The AI ecosystem has multiple versioning schemes that can be confusing. Here's what they mean:

**OpenAI API interface “generations:**
- Legacy Completions (`/v1/completions`): prompt → text (marked Legacy)  ￼
- Chat Completions (`/v1/chat/completions`): messages format; prior default for text generation  ￼
- Responses (`/v1/responses`): current recommended generation endpoint (migration path from Chat Completions) 

The Vercel AI SDK “spec versions” describe the SDK’s provider abstraction layer, which can call OpenAI endpoints (e.g., Chat Completions or Responses) underneath.

**Vercel AI SDK Language Model Specification versions:**
- **V1** (Legacy): baseline provider contract; simpler text + streaming expectations
- **V2**: (AI **SDK 5**) “V2 Specifications”: standardized tool calling + streaming parts across providers
- **V3**: (AI **SDK 6**) “v3 Language Model Specification”: expanded model capabilities + more structured/consistent streaming + provider parity improvements

**Provider Packages:**
- **@ai-sdk/openai** (v3.x): For official OpenAI APIs (GPT-4o, o1, etc.)
- **@ai-sdk/openai-compatible** (v2.x): For OpenAI-compatible servers (llama.cpp, vLLM, Ollama, etc.)
- **@ai-sdk/anthropic**, **@ai-sdk/google**, etc.: Provider-specific packages

#### When to Use Each Provider Package

**Use `@ai-sdk/openai` for:**
```typescript
import { createOpenAI } from '@ai-sdk/openai';

// Official OpenAI APIs
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');
```

**Use `@ai-sdk/openai-compatible` for:**
```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// llama.cpp, vLLM, Ollama, or other OpenAI-compatible servers
const llama = createOpenAICompatible({
  name: 'llama.cpp',
  baseURL: 'http://127.0.0.1:8033/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

const model = llama.chatModel('gpt-oss-20b');
```

**Why the distinction matters:**
- `@ai-sdk/openai` includes OpenAI-specific defaults and features (e.g., response_format, seed)
- `@ai-sdk/openai-compatible` is more generic and won't assume features the server might not support
- Using the wrong package can cause errors like `Unsupported model version v1`

#### Chat/Completion APIs: Request → Response

```typescript
// Best for: Single-turn queries, stateless operations
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuery },
  ],
});
```

**Agentic APIs**: Request → [Tool Calls...] → Response

```typescript
// Best for: Multi-step tasks, external data needs
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages,
  tools,
  tool_choice: 'auto',
});

// Handle tool calls in a loop
while (response.choices[0].finish_reason === 'tool_calls') {
  const toolResults = await executeToolCalls(response.choices[0].message.tool_calls);
  messages.push(response.choices[0].message);
  messages.push(...toolResults);
  response = await openai.chat.completions.create({ model: 'gpt-4o', messages, tools });
}
```

**Batch APIs**: Bulk processing

```typescript
// Best for: Offline processing, cost optimization
const batch = await openai.batches.create({
  input_file_id: fileId,
  endpoint: '/v1/chat/completions',
  completion_window: '24h',
});
```

### Latency and Cost Tradeoffs

| Optimization | Latency Impact | Cost Impact | When to Use |
|--------------|----------------|-------------|-------------|
| Smaller model | ↓ Lower | ↓ Lower | Simple tasks |
| Streaming | ↓ Perceived | → Same | User-facing |
| Caching | ↓ Much lower | ↓ Much lower | Repeated queries |
| Batching | ↑ Higher | ↓ ~50% lower | Background jobs |
| Prompt compression | ↓ Lower | ↓ Lower | Large contexts |

### Multi-Level Caching

**1. Exact prompt cache:**

```typescript
import { Redis } from 'ioredis';

const redis = new Redis();

async function cachedCompletion(
  messages: Message[],
  options: CompletionOptions
): Promise<CompletionResponse> {
  // Create deterministic cache key
  const cacheKey = createCacheKey(messages, options);

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Generate
  const response = await openai.chat.completions.create({
    ...options,
    messages,
  });

  // Cache with TTL
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(response));

  return response;
}

function createCacheKey(messages: Message[], options: CompletionOptions): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify({ messages, model: options.model, temperature: options.temperature }));
  return `llm:${hash.digest('hex')}`;
}
```

**2. Semantic cache:**

```typescript
// Cache based on meaning, not exact text
async function semanticCachedCompletion(
  query: string,
  context: CompletionContext
): Promise<CompletionResponse> {
  // Embed the query
  const queryEmbedding = await embed(query);

  // Find similar cached queries
  const similar = await vectorStore.search(queryEmbedding, {
    threshold: 0.95,  // High similarity required
    collection: 'query_cache',
  });

  if (similar.length > 0) {
    const cached = await redis.get(`response:${similar[0].id}`);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  // Generate new response
  const response = await generateCompletion(query, context);

  // Store for future semantic matches
  const id = crypto.randomUUID();
  await vectorStore.insert({
    id,
    embedding: queryEmbedding,
    collection: 'query_cache',
  });
  await redis.setex(`response:${id}`, CACHE_TTL_SECONDS, JSON.stringify(response));

  return response;
}
```

**3. Provider-level caching:**

```typescript
// OpenAI's prompt caching (automatic for long prompts)
// Cached prompts cost ~10% of regular price

// Anthropic's extended caching (beta)
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  messages,
  // Request extended caching (up to 1 hour)
  betas: ['prompt-caching-2024-07-31'],
});
```

### Retry and Error Handling

```typescript
import { retry } from 'ts-retry-promise';

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

async function resilientCompletion(
  messages: Message[],
  options: CompletionOptions,
  retryConfig = defaultRetryConfig
): Promise<CompletionResponse> {
  return retry(
    async () => {
      try {
        return await openai.chat.completions.create({ ...options, messages });
      } catch (error) {
        if (error.status === 429) {
          // Rate limited—extract retry-after header
          const retryAfter = error.headers?.['retry-after'];
          if (retryAfter) {
            await sleep(parseInt(retryAfter) * 1000);
          }
        }
        throw error;
      }
    },
    {
      retries: retryConfig.maxAttempts,
      delay: retryConfig.baseDelayMs,
      backoff: 'EXPONENTIAL',
      maxBackOff: retryConfig.maxDelayMs,
      retryIf: (error) => retryConfig.retryableStatuses.includes(error.status),
    }
  );
}
```

### Idempotency and Deduplication

For operations with side effects:

```typescript
interface IdempotentRequest {
  idempotencyKey: string;
  request: CompletionRequest;
}

async function idempotentCompletion(
  req: IdempotentRequest
): Promise<CompletionResponse> {
  const { idempotencyKey, request } = req;

  // Check if already processed
  const existing = await redis.get(`idempotent:${idempotencyKey}`);
  if (existing) {
    return JSON.parse(existing);
  }

  // Lock to prevent concurrent execution
  const lockKey = `lock:${idempotencyKey}`;
  const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 60);

  if (!acquired) {
    // Another request is processing—wait and return result
    await waitForResult(idempotencyKey);
    const result = await redis.get(`idempotent:${idempotencyKey}`);
    return JSON.parse(result!);
  }

  try {
    const response = await generateCompletion(request);

    // Store result
    await redis.setex(
      `idempotent:${idempotencyKey}`,
      IDEMPOTENCY_TTL_SECONDS,
      JSON.stringify(response)
    );

    return response;
  } finally {
    await redis.del(lockKey);
  }
}
```

### Side Effect Control

When AI can invoke tools with side effects:

```typescript
interface ToolExecution {
  tool: string;
  args: Record<string, unknown>;
  sideEffects: 'none' | 'read' | 'write' | 'external';
}

// Classify tools by side effect type
const toolSideEffects: Record<string, ToolExecution['sideEffects']> = {
  search_docs: 'read',
  get_user: 'read',
  update_user: 'write',
  send_email: 'external',
  calculate: 'none',
};

// Gate execution based on side effects
async function safeToolExecution(
  toolCall: ToolCall,
  context: ExecutionContext
): Promise<ToolResult> {
  const sideEffect = toolSideEffects[toolCall.function.name];

  switch (sideEffect) {
    case 'none':
    case 'read':
      return executeTool(toolCall);

    case 'write':
      if (!context.allowWrites) {
        return { error: 'Write operations require explicit approval' };
      }
      return executeTool(toolCall);

    case 'external':
      // Always require approval for external effects
      const approved = await requestApproval(toolCall, context.userId);
      if (!approved) {
        return { error: 'User declined external action' };
      }
      return executeTool(toolCall);

    default:
      return { error: `Unknown tool: ${toolCall.function.name}` };
  }
}
```

### Sandboxed Execution

For code execution or file operations:

```typescript
// Use containers for isolation
import Docker from 'dockerode';

async function sandboxedExecution(
  code: string,
  language: 'javascript' | 'python'
): Promise<ExecutionResult> {
  const docker = new Docker();

  const container = await docker.createContainer({
    Image: `sandbox-${language}:latest`,
    Cmd: getExecutionCommand(code, language),
    NetworkDisabled: true,  // No network access
    HostConfig: {
      Memory: 256 * 1024 * 1024,  // 256MB limit
      CpuPeriod: 100000,
      CpuQuota: 50000,  // 50% CPU
      ReadonlyRootfs: true,
    },
  });

  await container.start();

  const timeout = setTimeout(() => container.kill(), 30000);

  try {
    const result = await container.wait();
    const logs = await container.logs({ stdout: true, stderr: true });
    return parseExecutionResult(logs, result.StatusCode);
  } finally {
    clearTimeout(timeout);
    await container.remove();
  }
}
```

### MCP in Production

Use MCP for standardized tool integration:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';

// Initialize MCP client
const mcpClient = new Client({
  name: 'my-app',
  version: '1.0.0',
});

// Connect to server
await mcpClient.connect(transport);

// List available tools
const tools = await mcpClient.listTools();

// Convert to OpenAI format
const openAITools = tools.tools.map(tool => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  },
}));

// Call tool via MCP
async function callMCPTool(name: string, args: unknown): Promise<unknown> {
  const result = await mcpClient.callTool({ name, arguments: args });
  return result.content;
}
```

### Backpressure and Rate Limiting

```typescript
import Bottleneck from 'bottleneck';

// Client-side rate limiting
const limiter = new Bottleneck({
  maxConcurrent: 5,      // Max parallel requests
  minTime: 100,          // Min ms between requests
  reservoir: 100,        // Requests per period
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 60 * 1000,  // Per minute
});

async function rateLimitedCompletion(
  messages: Message[]
): Promise<CompletionResponse> {
  return limiter.schedule(() =>
    openai.chat.completions.create({ model: 'gpt-4o', messages })
  );
}

// Queue with priority
const priorityLimiter = new Bottleneck({
  maxConcurrent: 10,
  minTime: 50,
});

async function prioritizedCompletion(
  messages: Message[],
  priority: number  // Lower = higher priority
): Promise<CompletionResponse> {
  return priorityLimiter.schedule({ priority }, () =>
    openai.chat.completions.create({ model: 'gpt-4o', messages })
  );
}
```

## Common Pitfalls

- **No caching.** Repeated identical queries cost money and time.
- **No retry logic.** APIs fail; handle it gracefully.
- **Unbounded side effects.** Tools need permission and sandboxing.
- **Ignoring rate limits.** Build client-side limiting, don't rely on 429s.

## Related

- [Multi-Agent Orchestration](./multi-agent-orchestration.md) — Complex agent patterns
- [Model Routing](./model-routing.md) — Choosing models dynamically

## Previous

- [Output Control and Reliability](./output-control.md)

## Next

- [Native Thinking Models](./thinking-models.md)
