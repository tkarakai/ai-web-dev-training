/**
 * Tests for Observability & Tracing
 *
 * Run: bun test lib/observability.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  createSpan,
  endSpan,
  addSpanEvent,
  createTrace,
  addSpanToTrace,
  endTrace,
  MetricsCollector,
  TraceStore,
  LLMLogger,
  generateDashboardData,
} from './observability';

describe('Span Management', () => {
  it('creates a span with correct fields', () => {
    const span = createSpan('test-span', 'trace-1', undefined, { key: 'value' });

    expect(span.id).toBeTruthy();
    expect(span.traceId).toBe('trace-1');
    expect(span.name).toBe('test-span');
    expect(span.status).toBe('running');
    expect(span.attributes.key).toBe('value');
    expect(span.startTime).toBeGreaterThan(0);
  });

  it('ends a span with duration', () => {
    const span = createSpan('test-span', 'trace-1');

    // Simulate some time passing
    const ended = endSpan(span, 'success');

    expect(ended.status).toBe('success');
    expect(ended.endTime).toBeGreaterThanOrEqual(ended.startTime);
    expect(ended.duration).toBeDefined();
    expect(ended.duration).toBeGreaterThanOrEqual(0);
  });

  it('adds events to span', () => {
    let span = createSpan('test-span', 'trace-1');
    span = addSpanEvent(span, 'event-1', { data: 'test' });
    span = addSpanEvent(span, 'event-2');

    expect(span.events.length).toBe(2);
    expect(span.events[0].name).toBe('event-1');
    expect(span.events[0].attributes?.data).toBe('test');
    expect(span.events[1].name).toBe('event-2');
  });
});

describe('Trace Management', () => {
  it('creates a trace', () => {
    const trace = createTrace('test-trace', { userId: '123' });

    expect(trace.id).toBeTruthy();
    expect(trace.name).toBe('test-trace');
    expect(trace.metadata.userId).toBe('123');
    expect(trace.spans).toEqual([]);
  });

  it('adds spans to trace', () => {
    let trace = createTrace('test-trace');
    const span1 = createSpan('span-1', trace.id);
    const span2 = createSpan('span-2', trace.id);

    trace = addSpanToTrace(trace, span1);
    trace = addSpanToTrace(trace, span2);

    expect(trace.spans.length).toBe(2);
    expect(trace.spans[0].name).toBe('span-1');
    expect(trace.spans[1].name).toBe('span-2');
  });

  it('ends a trace', () => {
    let trace = createTrace('test-trace');
    trace = endTrace(trace);

    expect(trace.endTime).toBeDefined();
    expect(trace.endTime).toBeGreaterThanOrEqual(trace.startTime);
  });
});

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({ promptTokenCost: 0.001, completionTokenCost: 0.002 });
  });

  it('records requests', () => {
    collector.recordRequest({
      latencyMs: 100,
      promptTokens: 50,
      completionTokens: 100,
    });

    const metrics = collector.getMetrics();
    expect(metrics.requestCount).toBe(1);
    expect(metrics.promptTokens).toBe(50);
    expect(metrics.completionTokens).toBe(100);
    expect(metrics.totalTokens).toBe(150);
  });

  it('calculates cost correctly', () => {
    collector.recordRequest({
      latencyMs: 100,
      promptTokens: 1000,
      completionTokens: 500,
    });

    const metrics = collector.getMetrics();
    // Cost = (1000/1000 * 0.001) + (500/1000 * 0.002) = 0.001 + 0.001 = 0.002
    expect(metrics.totalCost).toBeCloseTo(0.002, 4);
  });

  it('calculates average latency', () => {
    collector.recordRequest({ latencyMs: 100, promptTokens: 10, completionTokens: 10 });
    collector.recordRequest({ latencyMs: 200, promptTokens: 10, completionTokens: 10 });
    collector.recordRequest({ latencyMs: 300, promptTokens: 10, completionTokens: 10 });

    const metrics = collector.getMetrics();
    expect(metrics.avgLatencyMs).toBe(200);
  });

  it('tracks cache hits and misses', () => {
    collector.recordRequest({ latencyMs: 100, promptTokens: 10, completionTokens: 10, cached: true });
    collector.recordRequest({ latencyMs: 100, promptTokens: 10, completionTokens: 10, cached: false });
    collector.recordRequest({ latencyMs: 100, promptTokens: 10, completionTokens: 10, cached: true });

    const metrics = collector.getMetrics();
    expect(metrics.cacheHits).toBe(2);
    expect(metrics.cacheMisses).toBe(1);
  });

  it('records errors', () => {
    collector.recordError();
    collector.recordError();

    const metrics = collector.getMetrics();
    expect(metrics.errorCount).toBe(2);
  });

  it('resets metrics', () => {
    collector.recordRequest({ latencyMs: 100, promptTokens: 10, completionTokens: 10 });
    collector.recordError();
    collector.reset();

    const metrics = collector.getMetrics();
    expect(metrics.requestCount).toBe(0);
    expect(metrics.errorCount).toBe(0);
    expect(metrics.totalTokens).toBe(0);
  });

  it('generates summary string', () => {
    collector.recordRequest({ latencyMs: 100, promptTokens: 50, completionTokens: 100 });

    const summary = collector.getSummary();
    expect(summary).toContain('Requests: 1');
    expect(summary).toContain('Tokens: 150');
  });
});

describe('TraceStore', () => {
  let store: TraceStore;

  beforeEach(() => {
    store = new TraceStore(100);
  });

  it('adds and retrieves traces', () => {
    const trace = endTrace(createTrace('test-trace'));
    store.add(trace);

    const retrieved = store.get(trace.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('test-trace');
  });

  it('returns recent traces in order', () => {
    const trace1 = endTrace(createTrace('trace-1'));
    const trace2 = endTrace(createTrace('trace-2'));
    const trace3 = endTrace(createTrace('trace-3'));

    store.add(trace1);
    store.add(trace2);
    store.add(trace3);

    const recent = store.getRecent(2);
    expect(recent.length).toBe(2);
    // Most recent first
    expect(recent[0].name).toBe('trace-3');
    expect(recent[1].name).toBe('trace-2');
  });

  it('evicts oldest when at capacity', () => {
    const smallStore = new TraceStore(2);

    const trace1 = endTrace(createTrace('trace-1'));
    const trace2 = endTrace(createTrace('trace-2'));
    const trace3 = endTrace(createTrace('trace-3'));

    smallStore.add(trace1);
    smallStore.add(trace2);
    smallStore.add(trace3);

    expect(smallStore.size()).toBe(2);
    expect(smallStore.get(trace1.id)).toBeUndefined();
    expect(smallStore.get(trace2.id)).toBeDefined();
    expect(smallStore.get(trace3.id)).toBeDefined();
  });

  it('queries traces by filter', () => {
    let trace1 = createTrace('trace-1', { type: 'chat' });
    let trace2 = createTrace('trace-2', { type: 'completion' });

    store.add(endTrace(trace1));
    store.add(endTrace(trace2));

    const chatTraces = store.query((t) => t.metadata.type === 'chat');
    expect(chatTraces.length).toBe(1);
    expect(chatTraces[0].name).toBe('trace-1');
  });

  it('finds error traces', () => {
    let trace1 = createTrace('trace-1');
    let trace2 = createTrace('trace-2');

    const successSpan = endSpan(createSpan('span', trace1.id), 'success');
    const errorSpan = endSpan(createSpan('span', trace2.id), 'error');

    trace1 = addSpanToTrace(trace1, successSpan);
    trace2 = addSpanToTrace(trace2, errorSpan);

    store.add(endTrace(trace1));
    store.add(endTrace(trace2));

    const errors = store.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].name).toBe('trace-2');
  });

  it('finds slow traces', () => {
    const trace1 = createTrace('trace-1');
    const trace2 = createTrace('trace-2');

    // Make trace2 "slow" by setting endTime far in future
    const endedTrace1 = { ...endTrace(trace1), endTime: trace1.startTime + 100 };
    const endedTrace2 = { ...endTrace(trace2), endTime: trace2.startTime + 10000 };

    store.add(endedTrace1);
    store.add(endedTrace2);

    const slow = store.getSlow(5000);
    expect(slow.length).toBe(1);
    expect(slow[0].name).toBe('trace-2');
  });
});

describe('LLMLogger', () => {
  let logger: LLMLogger;

  beforeEach(() => {
    logger = new LLMLogger({ minLevel: 'debug' });
  });

  it('logs at different levels', () => {
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    const logs = logger.getLogs();
    expect(logs.length).toBe(4);
    expect(logs[0].level).toBe('debug');
    expect(logs[1].level).toBe('info');
    expect(logs[2].level).toBe('warn');
    expect(logs[3].level).toBe('error');
  });

  it('respects minimum log level', () => {
    const warnLogger = new LLMLogger({ minLevel: 'warn' });

    warnLogger.debug('debug');
    warnLogger.info('info');
    warnLogger.warn('warn');
    warnLogger.error('error');

    const logs = warnLogger.getLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].level).toBe('warn');
    expect(logs[1].level).toBe('error');
  });

  it('logs with trace context', () => {
    logger.logWithTrace('info', 'message', 'trace-123', 'span-456', { key: 'value' });

    const logs = logger.getLogs();
    expect(logs[0].traceId).toBe('trace-123');
    expect(logs[0].spanId).toBe('span-456');
  });

  it('filters logs by level', () => {
    logger.info('info');
    logger.error('error');
    logger.info('info2');

    const errors = logger.getLogsByLevel('error');
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe('error');
  });

  it('filters logs by trace', () => {
    logger.logWithTrace('info', 'msg1', 'trace-1');
    logger.logWithTrace('info', 'msg2', 'trace-2');
    logger.logWithTrace('info', 'msg3', 'trace-1');

    const traceLogs = logger.getLogsForTrace('trace-1');
    expect(traceLogs.length).toBe(2);
  });

  it('exports to JSON', () => {
    logger.info('test message');

    const json = logger.exportJSON();
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].message).toBe('test message');
  });

  it('trims logs when over capacity', () => {
    const smallLogger = new LLMLogger({ maxLogs: 3, minLevel: 'debug' });

    smallLogger.info('1');
    smallLogger.info('2');
    smallLogger.info('3');
    smallLogger.info('4');

    const logs = smallLogger.getLogs();
    expect(logs.length).toBe(3);
    // Oldest should be removed
    expect(logs[0].message).toBe('2');
  });
});

describe('generateDashboardData', () => {
  it('generates summary data', () => {
    const metrics = {
      requestCount: 100,
      totalTokens: 10000,
      promptTokens: 4000,
      completionTokens: 6000,
      totalCost: 0.05,
      avgLatencyMs: 500,
      errorCount: 5,
      cacheHits: 20,
      cacheMisses: 80,
    };

    const traces: any[] = [];

    const data = generateDashboardData(metrics, traces);

    expect(data.summary['Total Requests']).toBe(100);
    expect(data.summary['Total Tokens']).toBe(10000);
    expect(data.summary['Total Cost']).toBe('$0.0500');
    expect(data.summary['Error Rate']).toBe('5.0%');
    expect(data.summary['Cache Hit Rate']).toBe('20.0%');
  });

  it('generates latency histogram', () => {
    const metrics = {
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

    // Create traces with varying latencies
    const traces = [
      {
        id: '1',
        name: 'test',
        startTime: 0,
        endTime: 100,
        spans: [{ duration: 50 }, { duration: 150 }, { duration: 600 }],
        metadata: {},
      },
    ] as any[];

    const data = generateDashboardData(metrics, traces);

    expect(data.latencyHistogram.length).toBeGreaterThan(0);
    expect(data.latencyHistogram[0]).toHaveProperty('bucket');
    expect(data.latencyHistogram[0]).toHaveProperty('count');
  });
});
