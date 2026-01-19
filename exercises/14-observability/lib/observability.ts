/**
 * Observability & Tracing
 *
 * Monitor and trace LLM operations for debugging and optimization.
 *
 * KEY CONCEPTS:
 * 1. Spans - Track individual operations with timing and metadata
 * 2. Traces - Group related spans into a single request flow
 * 3. Metrics - Aggregate data like latency, cost, token usage
 * 4. Logging - Structured logs for debugging and analysis
 */

import { LlamaClient, type Message, type LLMConfig } from '../../shared/lib/llama-client';

// =============================================================================
// TYPES
// =============================================================================

export interface Span {
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

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

export interface Trace {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  spans: Span[];
  metadata: Record<string, unknown>;
}

export interface LLMMetrics {
  requestCount: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface CostConfig {
  promptTokenCost: number;  // Cost per 1K prompt tokens
  completionTokenCost: number;  // Cost per 1K completion tokens
}

// =============================================================================
// ID GENERATION
// =============================================================================

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// =============================================================================
// SPAN MANAGEMENT
// =============================================================================

/**
 * Create a new span
 */
export function createSpan(
  name: string,
  traceId: string,
  parentId?: string,
  attributes: Record<string, unknown> = {}
): Span {
  return {
    id: generateId(),
    traceId,
    parentId,
    name,
    startTime: Date.now(),
    status: 'running',
    attributes,
    events: [],
  };
}

/**
 * End a span
 */
export function endSpan(span: Span, status: 'success' | 'error' = 'success'): Span {
  const endTime = Date.now();
  return {
    ...span,
    endTime,
    duration: endTime - span.startTime,
    status,
  };
}

/**
 * Add an event to a span
 */
export function addSpanEvent(
  span: Span,
  name: string,
  attributes?: Record<string, unknown>
): Span {
  return {
    ...span,
    events: [
      ...span.events,
      { name, timestamp: Date.now(), attributes },
    ],
  };
}

// =============================================================================
// TRACE MANAGEMENT
// =============================================================================

/**
 * Create a new trace
 */
export function createTrace(name: string, metadata: Record<string, unknown> = {}): Trace {
  return {
    id: generateId(),
    name,
    startTime: Date.now(),
    spans: [],
    metadata,
  };
}

/**
 * Add a span to a trace
 */
export function addSpanToTrace(trace: Trace, span: Span): Trace {
  return {
    ...trace,
    spans: [...trace.spans, span],
  };
}

/**
 * End a trace
 */
export function endTrace(trace: Trace): Trace {
  return {
    ...trace,
    endTime: Date.now(),
  };
}

// =============================================================================
// METRICS COLLECTOR
// =============================================================================

/**
 * Collect and aggregate LLM metrics
 */
export class MetricsCollector {
  private metrics: LLMMetrics = {
    requestCount: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalCost: 0,
    avgLatencyMs: 0,
    errorCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  private latencies: number[] = [];
  private costConfig: CostConfig;

  constructor(costConfig: CostConfig = { promptTokenCost: 0.001, completionTokenCost: 0.002 }) {
    this.costConfig = costConfig;
  }

  /**
   * Record a successful LLM request
   */
  recordRequest(data: {
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    cached?: boolean;
  }): void {
    this.metrics.requestCount++;
    this.metrics.promptTokens += data.promptTokens;
    this.metrics.completionTokens += data.completionTokens;
    this.metrics.totalTokens += data.promptTokens + data.completionTokens;

    // Calculate cost
    const cost =
      (data.promptTokens / 1000) * this.costConfig.promptTokenCost +
      (data.completionTokens / 1000) * this.costConfig.completionTokenCost;
    this.metrics.totalCost += cost;

    // Track latency
    this.latencies.push(data.latencyMs);
    this.metrics.avgLatencyMs =
      this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;

    // Track cache
    if (data.cached) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  }

  /**
   * Record an error
   */
  recordError(): void {
    this.metrics.errorCount++;
  }

  /**
   * Get current metrics
   */
  getMetrics(): LLMMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics summary
   */
  getSummary(): string {
    const m = this.metrics;
    return [
      `Requests: ${m.requestCount} (${m.errorCount} errors)`,
      `Tokens: ${m.totalTokens} (${m.promptTokens} prompt, ${m.completionTokens} completion)`,
      `Cost: $${m.totalCost.toFixed(4)}`,
      `Avg Latency: ${m.avgLatencyMs.toFixed(0)}ms`,
      `Cache: ${m.cacheHits} hits, ${m.cacheMisses} misses`,
    ].join('\n');
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      requestCount: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
      avgLatencyMs: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    this.latencies = [];
  }
}

// =============================================================================
// TRACE STORE
// =============================================================================

/**
 * Store and query traces
 */
export class TraceStore {
  private traces: Map<string, Trace> = new Map();
  private maxTraces: number;

  constructor(maxTraces: number = 1000) {
    this.maxTraces = maxTraces;
  }

  /**
   * Add a trace
   */
  add(trace: Trace): void {
    // Evict oldest if at capacity
    if (this.traces.size >= this.maxTraces) {
      const oldest = [...this.traces.values()]
        .sort((a, b) => a.startTime - b.startTime)[0];
      if (oldest) {
        this.traces.delete(oldest.id);
      }
    }

    this.traces.set(trace.id, trace);
  }

  /**
   * Get a trace by ID
   */
  get(id: string): Trace | undefined {
    return this.traces.get(id);
  }

  /**
   * Get recent traces
   */
  getRecent(limit: number = 10): Trace[] {
    return [...this.traces.values()]
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Query traces by metadata
   */
  query(filter: (trace: Trace) => boolean): Trace[] {
    return [...this.traces.values()].filter(filter);
  }

  /**
   * Get traces with errors
   */
  getErrors(): Trace[] {
    return this.query((trace) =>
      trace.spans.some((span) => span.status === 'error')
    );
  }

  /**
   * Get slow traces (above threshold)
   */
  getSlow(thresholdMs: number): Trace[] {
    return this.query((trace) => {
      const duration = (trace.endTime || Date.now()) - trace.startTime;
      return duration > thresholdMs;
    });
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.traces.clear();
  }

  /**
   * Get store size
   */
  size(): number {
    return this.traces.size;
  }
}

// =============================================================================
// INSTRUMENTED CLIENT
// =============================================================================

/**
 * LLM client with built-in observability
 */
export class InstrumentedClient {
  private client: LlamaClient;
  private metrics: MetricsCollector;
  private traceStore: TraceStore;
  private currentTrace: Trace | null = null;

  constructor(
    baseUrl: string = 'http://127.0.0.1:8033',
    costConfig?: CostConfig
  ) {
    this.client = new LlamaClient(baseUrl);
    this.metrics = new MetricsCollector(costConfig);
    this.traceStore = new TraceStore();
  }

  /**
   * Start a new trace
   */
  startTrace(name: string, metadata: Record<string, unknown> = {}): string {
    this.currentTrace = createTrace(name, metadata);
    return this.currentTrace.id;
  }

  /**
   * End current trace
   */
  endCurrentTrace(): Trace | null {
    if (!this.currentTrace) return null;

    const trace = endTrace(this.currentTrace);
    this.traceStore.add(trace);
    this.currentTrace = null;
    return trace;
  }

  /**
   * Chat with tracing
   */
  async chat(
    messages: Message[],
    config: Partial<LLMConfig> = {}
  ): Promise<{ response: string; span: Span }> {
    const traceId = this.currentTrace?.id || generateId();

    // Create span
    let span = createSpan('llm.chat', traceId, undefined, {
      model: 'llama',
      messageCount: messages.length,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    span = addSpanEvent(span, 'request_start');

    try {
      const startTime = Date.now();
      const response = await this.client.chat(messages, config);
      const latencyMs = Date.now() - startTime;

      // Estimate tokens (rough approximation)
      const promptTokens = messages.reduce(
        (sum, m) => sum + Math.ceil(m.content.length / 4),
        0
      );
      const completionTokens = Math.ceil(response.length / 4);

      span = addSpanEvent(span, 'response_received', {
        latencyMs,
        promptTokens,
        completionTokens,
      });

      span = endSpan(span, 'success');
      span.attributes.response_length = response.length;

      // Record metrics
      this.metrics.recordRequest({
        latencyMs,
        promptTokens,
        completionTokens,
        cached: false,
      });

      // Add to trace
      if (this.currentTrace) {
        this.currentTrace = addSpanToTrace(this.currentTrace, span);
      }

      return { response, span };
    } catch (error) {
      span = addSpanEvent(span, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      span = endSpan(span, 'error');

      this.metrics.recordError();

      if (this.currentTrace) {
        this.currentTrace = addSpanToTrace(this.currentTrace, span);
      }

      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): LLMMetrics {
    return this.metrics.getMetrics();
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): string {
    return this.metrics.getSummary();
  }

  /**
   * Get recent traces
   */
  getRecentTraces(limit: number = 10): Trace[] {
    return this.traceStore.getRecent(limit);
  }

  /**
   * Get trace by ID
   */
  getTrace(id: string): Trace | undefined {
    return this.traceStore.get(id);
  }

  /**
   * Get error traces
   */
  getErrorTraces(): Trace[] {
    return this.traceStore.getErrors();
  }

  /**
   * Get slow traces
   */
  getSlowTraces(thresholdMs: number = 5000): Trace[] {
    return this.traceStore.getSlow(thresholdMs);
  }

  /**
   * Reset all data
   */
  reset(): void {
    this.metrics.reset();
    this.traceStore.clear();
  }
}

// =============================================================================
// LOGGING
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Structured logger for LLM operations
 */
export class LLMLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number;
  private minLevel: LogLevel;

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(options: { maxLogs?: number; minLevel?: LogLevel } = {}) {
    this.maxLogs = options.maxLogs || 1000;
    this.minLevel = options.minLevel || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private addLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    this.logs.push(entry);

    // Trim if over capacity
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  debug(message: string, attributes?: Record<string, unknown>): void {
    this.addLog({ timestamp: new Date(), level: 'debug', message, attributes });
  }

  info(message: string, attributes?: Record<string, unknown>): void {
    this.addLog({ timestamp: new Date(), level: 'info', message, attributes });
  }

  warn(message: string, attributes?: Record<string, unknown>): void {
    this.addLog({ timestamp: new Date(), level: 'warn', message, attributes });
  }

  error(message: string, attributes?: Record<string, unknown>): void {
    this.addLog({ timestamp: new Date(), level: 'error', message, attributes });
  }

  /**
   * Log with trace context
   */
  logWithTrace(
    level: LogLevel,
    message: string,
    traceId: string,
    spanId?: string,
    attributes?: Record<string, unknown>
  ): void {
    this.addLog({
      timestamp: new Date(),
      level,
      message,
      traceId,
      spanId,
      attributes,
    });
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Get logs for a trace
   */
  getLogsForTrace(traceId: string): LogEntry[] {
    return this.logs.filter((log) => log.traceId === traceId);
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// =============================================================================
// DASHBOARD DATA
// =============================================================================

/**
 * Generate dashboard-ready data
 */
export function generateDashboardData(
  metrics: LLMMetrics,
  traces: Trace[]
): {
  summary: Record<string, string | number>;
  latencyHistogram: { bucket: string; count: number }[];
  errorRate: number;
  throughput: number;
} {
  // Summary stats
  const summary = {
    'Total Requests': metrics.requestCount,
    'Total Tokens': metrics.totalTokens,
    'Total Cost': `$${metrics.totalCost.toFixed(4)}`,
    'Avg Latency': `${metrics.avgLatencyMs.toFixed(0)}ms`,
    'Error Rate': `${((metrics.errorCount / Math.max(metrics.requestCount, 1)) * 100).toFixed(1)}%`,
    'Cache Hit Rate': `${((metrics.cacheHits / Math.max(metrics.cacheHits + metrics.cacheMisses, 1)) * 100).toFixed(1)}%`,
  };

  // Latency histogram
  const latencies = traces
    .flatMap((t) => t.spans)
    .filter((s) => s.duration)
    .map((s) => s.duration!);

  const buckets = [100, 500, 1000, 2000, 5000, 10000];
  const latencyHistogram = buckets.map((bucket, i) => {
    const prevBucket = i === 0 ? 0 : buckets[i - 1];
    const count = latencies.filter((l) => l > prevBucket && l <= bucket).length;
    return { bucket: `${prevBucket}-${bucket}ms`, count };
  });

  // Add overflow bucket
  latencyHistogram.push({
    bucket: `>${buckets[buckets.length - 1]}ms`,
    count: latencies.filter((l) => l > buckets[buckets.length - 1]).length,
  });

  // Error rate
  const errorRate = metrics.errorCount / Math.max(metrics.requestCount, 1);

  // Throughput (requests per second over trace window)
  const traceWindow = traces.length > 0
    ? (Math.max(...traces.map((t) => t.endTime || t.startTime)) -
        Math.min(...traces.map((t) => t.startTime))) / 1000
    : 1;
  const throughput = traces.length / Math.max(traceWindow, 1);

  return { summary, latencyHistogram, errorRate, throughput };
}
