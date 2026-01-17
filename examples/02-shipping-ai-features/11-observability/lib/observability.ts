/**
 * Observability utilities for LLM systems
 * - End-to-end tracing with spans
 * - Cost tracking by model/feature/tenant
 * - Quality metrics monitoring
 * - Drift detection
 */

import { generateId } from '@examples/shared/lib/utils';

// Types
export interface Span {
  id: string;
  name: string;
  parentId?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attributes: Record<string, unknown>;
  status: 'running' | 'ok' | 'error';
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
  totalDurationMs?: number;
  totalTokens: number;
  totalCost: number;
  status: 'running' | 'ok' | 'error';
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostMetrics {
  byModel: Record<string, number>;
  byFeature: Record<string, number>;
  byTenant: Record<string, number>;
  total: number;
  periodStart: number;
  periodEnd: number;
}

export interface QualityMetrics {
  successRate: number;
  errorRate: number;
  refusalRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalRequests: number;
  feedback: {
    helpful: number;
    notHelpful: number;
    ratio: number;
  };
}

export interface DriftAlert {
  id: string;
  type: 'model' | 'prompt' | 'data' | 'user';
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface RequestLog {
  id: string;
  timestamp: number;
  feature: string;
  model: string;
  tenantId: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cost: number;
  success: boolean;
  refused: boolean;
  error?: string;
  feedback?: 'helpful' | 'not_helpful';
}

// Model pricing (per million tokens)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'llama-3.2-3b': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
};

// Calculate cost from token usage
export function calculateCost(usage: TokenUsage, model: string): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['llama-3.2-3b'];
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

// Tracer class for creating traces and spans
export class Tracer {
  private traces: Map<string, Trace> = new Map();
  private activeSpans: Map<string, Span> = new Map();

  createTrace(name: string): Trace {
    const trace: Trace = {
      id: generateId('trace'),
      name,
      startTime: Date.now(),
      spans: [],
      totalTokens: 0,
      totalCost: 0,
      status: 'running',
    };
    this.traces.set(trace.id, trace);
    return trace;
  }

  startSpan(traceId: string, name: string, parentId?: string): Span {
    const span: Span = {
      id: generateId('span'),
      name,
      parentId,
      startTime: Date.now(),
      attributes: {},
      status: 'running',
      events: [],
    };

    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.push(span);
    }
    this.activeSpans.set(span.id, span);
    return span;
  }

  setSpanAttributes(spanId: string, attributes: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.attributes = { ...span.attributes, ...attributes };
    }
  }

  addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.events.push({ name, timestamp: Date.now(), attributes });
    }
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok'): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.durationMs = span.endTime - span.startTime;
      span.status = status;
      this.activeSpans.delete(spanId);
    }
  }

  endTrace(traceId: string, tokenUsage?: TokenUsage, model?: string): Trace | undefined {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.endTime = Date.now();
      trace.totalDurationMs = trace.endTime - trace.startTime;

      if (tokenUsage) {
        trace.totalTokens = tokenUsage.totalTokens;
        if (model) {
          trace.totalCost = calculateCost(tokenUsage, model);
        }
      }

      const hasErrors = trace.spans.some(s => s.status === 'error');
      trace.status = hasErrors ? 'error' : 'ok';
    }
    return trace;
  }

  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }
}

// Cost tracker for aggregating costs
export class CostTracker {
  private logs: RequestLog[] = [];
  private budgets: Map<string, { limit: number; alertThreshold: number }> = new Map();
  private alerts: Array<{ type: string; message: string; timestamp: number }> = [];

  setBudget(tenantId: string, limit: number, alertThreshold: number = 0.8): void {
    this.budgets.set(tenantId, { limit, alertThreshold: limit * alertThreshold });
  }

  recordRequest(log: RequestLog): { budgetAlert?: string } {
    this.logs.push(log);

    // Check budget
    const budget = this.budgets.get(log.tenantId);
    if (budget) {
      const tenantSpend = this.getTenantSpend(log.tenantId);

      if (tenantSpend >= budget.limit) {
        const alert = {
          type: 'budget_exceeded',
          message: `Tenant ${log.tenantId} exceeded budget: $${tenantSpend.toFixed(4)} / $${budget.limit.toFixed(4)}`,
          timestamp: Date.now(),
        };
        this.alerts.push(alert);
        return { budgetAlert: alert.message };
      } else if (tenantSpend >= budget.alertThreshold) {
        const alert = {
          type: 'budget_warning',
          message: `Tenant ${log.tenantId} approaching budget: $${tenantSpend.toFixed(4)} / $${budget.limit.toFixed(4)}`,
          timestamp: Date.now(),
        };
        this.alerts.push(alert);
        return { budgetAlert: alert.message };
      }
    }

    return {};
  }

  getTenantSpend(tenantId: string): number {
    return this.logs
      .filter(l => l.tenantId === tenantId)
      .reduce((sum, l) => sum + l.cost, 0);
  }

  getMetrics(since?: number): CostMetrics {
    const startTime = since || (Date.now() - 3600000); // Default: last hour
    const filtered = this.logs.filter(l => l.timestamp >= startTime);

    const byModel: Record<string, number> = {};
    const byFeature: Record<string, number> = {};
    const byTenant: Record<string, number> = {};
    let total = 0;

    for (const log of filtered) {
      byModel[log.model] = (byModel[log.model] || 0) + log.cost;
      byFeature[log.feature] = (byFeature[log.feature] || 0) + log.cost;
      byTenant[log.tenantId] = (byTenant[log.tenantId] || 0) + log.cost;
      total += log.cost;
    }

    return {
      byModel,
      byFeature,
      byTenant,
      total,
      periodStart: startTime,
      periodEnd: Date.now(),
    };
  }

  getAlerts(): Array<{ type: string; message: string; timestamp: number }> {
    return [...this.alerts];
  }

  getLogs(): RequestLog[] {
    return [...this.logs];
  }
}

// Quality monitor
export class QualityMonitor {
  private logs: RequestLog[] = [];

  recordRequest(log: RequestLog): void {
    this.logs.push(log);
  }

  recordFeedback(logId: string, feedback: 'helpful' | 'not_helpful'): void {
    const log = this.logs.find(l => l.id === logId);
    if (log) {
      log.feedback = feedback;
    }
  }

  getMetrics(since?: number): QualityMetrics {
    const startTime = since || (Date.now() - 3600000);
    const filtered = this.logs.filter(l => l.timestamp >= startTime);

    if (filtered.length === 0) {
      return {
        successRate: 0,
        errorRate: 0,
        refusalRate: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        totalRequests: 0,
        feedback: { helpful: 0, notHelpful: 0, ratio: 0 },
      };
    }

    const total = filtered.length;
    const successes = filtered.filter(l => l.success && !l.refused).length;
    const errors = filtered.filter(l => !l.success).length;
    const refusals = filtered.filter(l => l.refused).length;

    const latencies = filtered.map(l => l.latencyMs).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Index = Math.floor(latencies.length * 0.95);

    const withFeedback = filtered.filter(l => l.feedback);
    const helpful = withFeedback.filter(l => l.feedback === 'helpful').length;
    const notHelpful = withFeedback.filter(l => l.feedback === 'not_helpful').length;

    return {
      successRate: successes / total,
      errorRate: errors / total,
      refusalRate: refusals / total,
      avgLatencyMs: avgLatency,
      p95LatencyMs: latencies[p95Index] || avgLatency,
      totalRequests: total,
      feedback: {
        helpful,
        notHelpful,
        ratio: withFeedback.length > 0 ? helpful / withFeedback.length : 0,
      },
    };
  }
}

// Drift detector
export interface BaselineMetrics {
  avgLatencyMs: number;
  avgResponseLength: number;
  successRate: number;
  refusalRate: number;
  avgInputTokens: number;
  avgOutputTokens: number;
}

const DRIFT_THRESHOLDS: Record<string, { metrics: string[]; threshold: number }> = {
  model: {
    metrics: ['refusalRate', 'avgResponseLength', 'avgOutputTokens'],
    threshold: 0.2,
  },
  prompt: {
    metrics: ['successRate', 'avgLatencyMs'],
    threshold: 0.15,
  },
  data: {
    metrics: ['avgInputTokens'],
    threshold: 0.25,
  },
  user: {
    metrics: ['avgInputTokens', 'avgOutputTokens'],
    threshold: 0.3,
  },
};

export function detectDrift(
  current: BaselineMetrics,
  baseline: BaselineMetrics
): DriftAlert[] {
  const alerts: DriftAlert[] = [];

  for (const [driftType, config] of Object.entries(DRIFT_THRESHOLDS)) {
    for (const metric of config.metrics) {
      const baselineValue = baseline[metric as keyof BaselineMetrics];
      const currentValue = current[metric as keyof BaselineMetrics];

      if (baselineValue === 0) continue;

      const change = Math.abs(currentValue - baselineValue) / baselineValue;

      if (change > config.threshold) {
        alerts.push({
          id: generateId('drift'),
          type: driftType as 'model' | 'prompt' | 'data' | 'user',
          metric,
          baselineValue,
          currentValue,
          changePercent: change * 100,
          severity: change > config.threshold * 2 ? 'high' : change > config.threshold * 1.5 ? 'medium' : 'low',
          timestamp: Date.now(),
        });
      }
    }
  }

  return alerts;
}

// Simulate generating trace data for demo
export function simulateTrace(feature: string): Trace {
  const tracer = new Tracer();
  const trace = tracer.createTrace(`${feature}-request`);

  // Simulate input processing span
  const inputSpan = tracer.startSpan(trace.id, 'input.process');
  tracer.setSpanAttributes(inputSpan.id, {
    'input.length': Math.floor(Math.random() * 500) + 50,
    'input.tokens': Math.floor(Math.random() * 200) + 20,
  });
  tracer.addSpanEvent(inputSpan.id, 'tokenization_complete');
  tracer.endSpan(inputSpan.id);

  // Simulate model call span
  const modelSpan = tracer.startSpan(trace.id, 'model.call', inputSpan.id);
  const inputTokens = Math.floor(Math.random() * 500) + 100;
  const outputTokens = Math.floor(Math.random() * 300) + 50;
  tracer.setSpanAttributes(modelSpan.id, {
    'model.name': 'llama-3.2-3b',
    'model.inputTokens': inputTokens,
    'model.outputTokens': outputTokens,
    'model.latencyMs': Math.floor(Math.random() * 2000) + 500,
  });
  tracer.addSpanEvent(modelSpan.id, 'first_token_received');
  tracer.addSpanEvent(modelSpan.id, 'generation_complete');
  tracer.endSpan(modelSpan.id);

  // Simulate tool call span (sometimes)
  if (Math.random() > 0.5) {
    const toolSpan = tracer.startSpan(trace.id, 'tool.search', modelSpan.id);
    tracer.setSpanAttributes(toolSpan.id, {
      'tool.name': 'web_search',
      'tool.success': true,
      'tool.results': Math.floor(Math.random() * 5) + 1,
    });
    tracer.endSpan(toolSpan.id);
  }

  // Simulate output processing span
  const outputSpan = tracer.startSpan(trace.id, 'output.process', modelSpan.id);
  tracer.setSpanAttributes(outputSpan.id, {
    'output.length': outputTokens * 4,
    'output.filtered': false,
  });
  tracer.endSpan(outputSpan.id);

  // End trace with token usage
  tracer.endTrace(trace.id, {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }, 'llama-3.2-3b');

  return tracer.getTrace(trace.id)!;
}

// Sample baseline for drift comparison
export const sampleBaseline: BaselineMetrics = {
  avgLatencyMs: 850,
  avgResponseLength: 450,
  successRate: 0.95,
  refusalRate: 0.02,
  avgInputTokens: 150,
  avgOutputTokens: 200,
};

// Sample features for demo
export const sampleFeatures = [
  { id: 'chat', name: 'Customer Chat', model: 'llama-3.2-3b' },
  { id: 'search', name: 'Semantic Search', model: 'gpt-4o-mini' },
  { id: 'analysis', name: 'Document Analysis', model: 'claude-3-sonnet' },
  { id: 'summary', name: 'Text Summary', model: 'gpt-4o' },
];

// Sample tenants for demo
export const sampleTenants = [
  { id: 'acme', name: 'Acme Corp', budget: 0.10 },
  { id: 'globex', name: 'Globex Inc', budget: 0.05 },
  { id: 'initech', name: 'Initech Ltd', budget: 0.08 },
];

// Span colors for visualization
export const spanColors: Record<string, string> = {
  'input.process': 'bg-blue-100 border-blue-300',
  'model.call': 'bg-purple-100 border-purple-300',
  'tool.search': 'bg-orange-100 border-orange-300',
  'tool.execute': 'bg-orange-100 border-orange-300',
  'output.process': 'bg-green-100 border-green-300',
  'retrieval': 'bg-yellow-100 border-yellow-300',
};

// Severity colors for alerts
export const severityColors: Record<string, string> = {
  low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  medium: 'bg-orange-100 text-orange-800 border-orange-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};
