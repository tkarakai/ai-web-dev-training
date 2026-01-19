# Exercise 05: Conversation Memory

Managing context windows and message history. Learn how to handle long conversations that exceed model limits.

## What You'll Learn

1. **Context window limits** - Why they exist and how to work with them
2. **Sliding window strategy** - Keep recent messages, drop old ones
3. **Importance-based pruning** - Keep high-value messages
4. **Summarization** - Compress old messages into summaries

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/memory.ts       <- THE MAIN FILE - pruning strategies, conversation manager
lib/memory.test.ts  <- Tests for memory management
```

## Key Concepts

### The Context Window Problem

LLMs have limited memory (context window):
- GPT-4o: 128K tokens
- Local models: Often 4K-32K tokens

When conversation exceeds the limit, you must drop messages.

### Strategy 1: Sliding Window

Keep the most recent messages:

```typescript
function applySlidingWindow(messages, maxTokens, reserveForOutput) {
  const available = maxTokens - reserveForOutput;
  const result = [];

  // Always keep system message
  const systemMessage = messages.find(m => m.role === 'system');
  if (systemMessage) {
    result.push(systemMessage);
  }

  // Add from most recent, working backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    if (totalTokens + messageTokens <= available) {
      result.unshift(messages[i]);
    }
  }

  return result;
}
```

**Pros:** Simple, predictable
**Cons:** May lose important early context

### Strategy 2: Importance-Based

Score messages and keep highest-scoring:

```typescript
function calculateImportanceScore(message, index, total) {
  let score = 0;

  // Recency
  score += (index / total) * 40;

  // Questions are important
  if (message.content.includes('?')) score += 15;

  // First user message often has the main task
  if (message.role === 'user' && index <= 1) score += 30;

  return score;
}
```

**Pros:** Better context preservation
**Cons:** More complex, may be unpredictable

### Strategy 3: Summarization

Compress old messages:

```typescript
function applySummarization(messages, summary, keepRecent) {
  return [
    systemMessage,
    { role: 'system', content: `[Previous summary]\n${summary}` },
    ...messages.slice(-keepRecent),
  ];
}
```

**Pros:** Preserves all context in compressed form
**Cons:** Lossy, requires additional LLM call

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start the UI (requires llama-server)
bun dev
```

Open http://localhost:3005 to experiment with memory strategies.

## Code Patterns to Note

### 1. Token Estimation

```typescript
function estimateMessageTokens(message) {
  const roleTokens = 4;
  const contentTokens = Math.ceil(message.content.length / 4);
  return roleTokens + contentTokens;
}
```

### 2. Conversation Manager Pattern

```typescript
class ConversationManager {
  private conversations = new Map<string, Conversation>();
  private config: MemoryConfig;

  addMessage(convId, role, content) { ... }
  getContextWindow(convId) { ... }  // Returns pruned messages
  getStats(convId) { ... }
}
```

### 3. Always Reserve for Output

```typescript
const available = maxTokens - reserveForOutput;
// Never use 100% of context for input!
```

## Exercises to Try

1. **Implement auto-summarization** - Trigger summarization when usage exceeds threshold
2. **Add message pinning** - Let users pin important messages that won't be pruned
3. **Build conversation export** - Export full history as JSON
4. **Add persistence** - Save conversations to localStorage

## When to Use Each Strategy

| Strategy | Best For | Complexity |
|----------|----------|------------|
| Sliding Window | Short conversations, recent context matters most | Low |
| Importance | Task-based conversations with key instructions | Medium |
| Summarization | Long conversations, full history needed | High |

## Next Exercise

[Exercise 06: Structured Outputs](../06-structured-outputs) - Force LLM outputs to match TypeScript types.
