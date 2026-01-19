# Exercise 04: Streaming Responses

Real-time token-by-token output. Make AI feel responsive by showing content as it's generated.

## What You'll Learn

1. **Server-Sent Events (SSE)** - The protocol for streaming
2. **AsyncGenerator pattern** - Yielding values over time
3. **State accumulation** - Building up content from chunks
4. **Cancellation** - Stopping streams gracefully

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/streaming.ts       <- THE MAIN FILE - SSE parsing, streaming client
lib/streaming.test.ts  <- Tests for accumulator
```

## Key Concepts

### Server-Sent Events (SSE)

SSE is a simple protocol for server-to-client streaming:

```
data: {"content": "Hello"}

data: {"content": " world"}

data: [DONE]
```

Each message is prefixed with `data: ` and separated by blank lines.

### Parsing SSE with AsyncGenerator

```typescript
async function* parseSSE(reader: ReadableStreamDefaultReader): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split('\n\n');
    buffer = messages.pop() ?? '';

    for (const message of messages) {
      if (message.startsWith('data: ')) {
        yield message.slice(6);
      }
    }
  }
}
```

### The Streaming Client

```typescript
async function* streamChat(messages, options): AsyncGenerator<StreamChunk> {
  const response = await fetch(url, {
    body: JSON.stringify({ ...options, stream: true }),
  });

  const reader = response.body.getReader();

  for await (const data of parseSSE(reader)) {
    const parsed = JSON.parse(data);
    yield { content: parsed.choices[0].delta.content, done: false };
  }
}
```

### State Accumulation

```typescript
class StreamAccumulator {
  private content = '';

  addChunk(chunk: StreamChunk): string {
    if (chunk.content) {
      this.content += chunk.content;
    }
    return this.content;
  }
}
```

### React Integration

```typescript
const [content, setContent] = useState('');

for await (const chunk of streamChat(messages)) {
  setContent(prev => prev + chunk.content);
}
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start the UI (requires llama-server)
bun dev
```

Open http://localhost:3004 to compare streaming vs non-streaming.

## Code Patterns to Note

### 1. Cancellation with AbortController

```typescript
const controller = new AbortController();

await fetch(url, { signal: controller.signal });

// Later: stop the stream
controller.abort();
```

### 2. Metrics Tracking

```typescript
class StreamAccumulator {
  private startTime = 0;
  private firstTokenTime = 0;

  start() { this.startTime = Date.now(); }

  addChunk(chunk) {
    if (!this.firstTokenTime) {
      this.firstTokenTime = Date.now();
    }
    // ...
  }

  getMetrics() {
    return {
      firstTokenMs: this.firstTokenTime - this.startTime,
      totalMs: Date.now() - this.startTime,
    };
  }
}
```

### 3. Buffering for Performance

```typescript
async function* withBuffer(stream, bufferMs): AsyncGenerator<StreamChunk> {
  let buffer = '';
  let lastYield = Date.now();

  for await (const chunk of stream) {
    buffer += chunk.content;

    if (Date.now() - lastYield >= bufferMs) {
      yield { content: buffer, done: false };
      buffer = '';
      lastYield = Date.now();
    }
  }
}
```

## Exercises to Try

1. **Add a typing indicator** - Show "..." while waiting for first token
2. **Implement retry on error** - Auto-retry if connection drops
3. **Add token highlighting** - Briefly highlight each new token as it appears
4. **Build a rate limiter** - Limit how fast tokens are displayed (artificial throttle)

## Why Streaming Matters

| Metric | Non-Streaming | Streaming |
|--------|---------------|-----------|
| Time to first content | 5000ms | 200ms |
| Perceived responsiveness | Slow | Instant |
| User can start reading | After completion | Immediately |

**Rule of thumb:** If generation takes >1 second, use streaming.

## Next Exercise

[Exercise 05: Conversation Memory](../05-conversation-memory) - Manage context windows and message history.
