# Exercise 14: Observability & Tracing

Monitor and trace LLM operations for debugging and optimization.

## What You'll Learn

1. **Spans** - Track individual operations with timing and metadata
2. **Traces** - Group related spans into request flows
3. **Metrics** - Aggregate data like latency, cost, token usage
4. **Logging** - Structured logs for debugging

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/observability.ts       <- THE MAIN FILE - spans, traces, metrics
lib/observability.test.ts  <- Unit tests
```

## Key Concepts

### Spans

```typescript
interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'success' | 'error';
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

// Create and use spans
let span = createSpan('llm.chat', traceId, undefined, {
  model: 'llama',
  temperature: 0.7,
});

span = addSpanEvent(span, 'request_start');
// ... do work ...
span = addSpanEvent(span, 'response_received', { tokens: 150 });
span = endSpan(span, 'success');
```

### Traces

```typescript
// Create trace for a user request
let trace = createTrace('user-query', { userId: '123' });

// Add spans as operations complete
trace = addSpanToTrace(trace, chatSpan);
trace = addSpanToTrace(trace, processSpan);

// End trace
trace = endTrace(trace);
```

### Metrics Collector

```typescript
const collector = new MetricsCollector({
  promptTokenCost: 0.001,    // per 1K tokens
  completionTokenCost: 0.002,
});

// Record each request
collector.recordRequest({
  latencyMs: 500,
  promptTokens: 100,
  completionTokens: 200,
  cached: false,
});

// Get aggregated metrics
const metrics = collector.getMetrics();
// {
//   requestCount: 1,
//   totalTokens: 300,
//   totalCost: 0.0005,
//   avgLatencyMs: 500,
//   ...
// }
```

### Instrumented Client

```typescript
const client = new InstrumentedClient();

// Start trace
client.startTrace('user-query', { userId: '123' });

// Make requests (automatically creates spans)
const { response, span } = await client.chat(messages);

// End trace
const trace = client.endCurrentTrace();

// Get metrics
console.log(client.getMetricsSummary());
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

Open http://localhost:3014 to see tracing in action.

## Code Patterns to Note

### 1. Trace Store with Queries

```typescript
const store = new TraceStore(1000); // max 1000 traces

// Add traces
store.add(trace);

// Query
const recent = store.getRecent(10);
const errors = store.getErrors();
const slow = store.getSlow(5000); // > 5s
const custom = store.query(t => t.metadata.userId === '123');
```

### 2. Structured Logging

```typescript
const logger = new LLMLogger({ minLevel: 'info' });

// Regular logging
logger.info('Request started', { model: 'llama' });
logger.error('Request failed', { error: 'timeout' });

// With trace context
logger.logWithTrace('info', 'Processing', traceId, spanId);

// Query logs
const errorLogs = logger.getLogsByLevel('error');
const traceLogs = logger.getLogsForTrace(traceId);
```

### 3. Dashboard Data Generation

```typescript
const dashboardData = generateDashboardData(metrics, traces);
// {
//   summary: { 'Total Requests': 100, 'Total Cost': '$0.05', ... },
//   latencyHistogram: [{ bucket: '0-100ms', count: 50 }, ...],
//   errorRate: 0.05,
//   throughput: 2.5,  // requests/sec
// }
```

### 4. Cost Tracking

```typescript
// Configure costs per 1K tokens
const collector = new MetricsCollector({
  promptTokenCost: 0.001,     // $0.001 per 1K prompt tokens
  completionTokenCost: 0.002, // $0.002 per 1K completion tokens
});

// Cost calculated automatically
collector.recordRequest({ promptTokens: 1000, completionTokens: 500, ... });
// Cost = (1000/1000 * 0.001) + (500/1000 * 0.002) = $0.002
```

## Metrics Tracked

| Metric | Description |
|--------|-------------|
| `requestCount` | Total LLM API calls |
| `totalTokens` | Sum of prompt + completion tokens |
| `promptTokens` | Input tokens |
| `completionTokens` | Output tokens |
| `totalCost` | Calculated cost based on token prices |
| `avgLatencyMs` | Average request latency |
| `errorCount` | Failed requests |
| `cacheHits` | Requests served from cache |
| `cacheMisses` | Requests that hit the LLM |

## Exercises to Try

1. **Add span hierarchy** - Support parent-child relationships
2. **Implement sampling** - Only trace X% of requests
3. **Build alerting** - Alert when error rate exceeds threshold
4. **Export to external systems** - Send traces to Jaeger/Zipkin format

## Next Exercise

[Exercise 15: RAG Pipeline](../15-rag) - Build retrieval-augmented generation.
