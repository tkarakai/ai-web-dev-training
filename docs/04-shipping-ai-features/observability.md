# Observability and Monitoring for LLM Systems

Tracing, cost tracking, quality monitoring, and drift detection for AI in production.

## TL;DR

- LLM observability requires **new metrics**: token usage, latency breakdown, quality scores
- Implement **end-to-end tracing**: request → retrieval → model → tools → response
- Monitor **costs by feature and tenant**; set budget alerts
- Track **quality metrics**: success rate, user feedback, escalation rate
- Detect **drift** in model behavior, prompts, and data before users notice

## Core Concepts

### Why LLM Observability Is Different

Traditional observability (logs, metrics, traces) isn't enough for AI systems:

| Traditional | LLM-Specific |
|-------------|--------------|
| Request latency | Time-to-first-token, tokens/second |
| Error rate | Refusal rate, hallucination rate |
| Resource usage | Token consumption, cost per request |
| Service health | Model quality, prompt effectiveness |

### End-to-End Tracing

Trace every step from request to response.

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

interface LLMTrace {
  traceId: string;
  spans: LLMSpan[];
  totalLatencyMs: number;
  totalTokens: number;
  totalCost: number;
}

interface LLMSpan {
  name: string;
  startTime: Date;
  endTime: Date;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

async function tracedGeneration(
  request: GenerationRequest
): Promise<TracedResponse> {
  const tracer = trace.getTracer('llm-service');

  return tracer.startActiveSpan('llm.generation', async (span) => {
    try {
      // Span 1: Input processing
      const processedInput = await tracer.startActiveSpan('input.process', async (inputSpan) => {
        const result = await processInput(request);
        inputSpan.setAttributes({
          'input.length': request.input.length,
          'input.tokens': result.tokenCount,
        });
        inputSpan.end();
        return result;
      });

      // Span 2: Retrieval (if RAG)
      let context: RetrievalResult | undefined;
      if (request.useRetrieval) {
        context = await tracer.startActiveSpan('retrieval', async (retrievalSpan) => {
          const result = await retrieve(processedInput.query);
          retrievalSpan.setAttributes({
            'retrieval.documents': result.documents.length,
            'retrieval.latencyMs': result.latencyMs,
          });
          retrievalSpan.end();
          return result;
        });
      }

      // Span 3: Model call
      const response = await tracer.startActiveSpan('model.call', async (modelSpan) => {
        const result = await callModel(processedInput, context);
        modelSpan.setAttributes({
          'model.name': result.model,
          'model.inputTokens': result.usage.inputTokens,
          'model.outputTokens': result.usage.outputTokens,
          'model.latencyMs': result.latencyMs,
          'model.cost': calculateCost(result.usage, result.model),
        });
        modelSpan.end();
        return result;
      });

      // Span 4: Tool calls (if any)
      if (response.toolCalls?.length) {
        await tracer.startActiveSpan('tools', async (toolsSpan) => {
          for (const toolCall of response.toolCalls) {
            await tracer.startActiveSpan(`tool.${toolCall.name}`, async (toolSpan) => {
              const result = await executeTool(toolCall);
              toolSpan.setAttributes({
                'tool.name': toolCall.name,
                'tool.success': result.success,
                'tool.latencyMs': result.latencyMs,
              });
              toolSpan.end();
            });
          }
          toolsSpan.end();
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return { response, traceId: span.spanContext().traceId };
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### Cost Monitoring

Track costs at multiple granularities.

```typescript
interface CostMetrics {
  byModel: Map<string, number>;
  byFeature: Map<string, number>;
  byTenant: Map<string, number>;
  byUser: Map<string, number>;
  total: number;
  period: { start: Date; end: Date };
}

class CostTracker {
  private metrics: CostMetrics;

  recordUsage(usage: TokenUsage, context: UsageContext): void {
    const cost = this.calculateCost(usage, context.model);

    // Aggregate by dimensions
    this.increment('byModel', context.model, cost);
    this.increment('byFeature', context.feature, cost);
    this.increment('byTenant', context.tenantId, cost);
    this.increment('byUser', context.userId, cost);

    this.metrics.total += cost;

    // Check budget alerts
    this.checkBudgetAlerts(context);
  }

  private async checkBudgetAlerts(context: UsageContext): Promise<void> {
    const tenantBudget = await getBudget(context.tenantId);
    const tenantSpend = this.metrics.byTenant.get(context.tenantId) || 0;

    if (tenantSpend > tenantBudget.alertThreshold) {
      await sendAlert({
        type: 'budget_warning',
        tenantId: context.tenantId,
        spend: tenantSpend,
        budget: tenantBudget.limit,
      });
    }

    if (tenantSpend >= tenantBudget.limit) {
      await sendAlert({
        type: 'budget_exceeded',
        tenantId: context.tenantId,
      });
      // Optionally enforce limit
    }
  }

  private calculateCost(usage: TokenUsage, model: string): number {
    const pricing = MODEL_PRICING[model];
    return (
      (usage.inputTokens / 1_000_000) * pricing.inputPerMillion +
      (usage.outputTokens / 1_000_000) * pricing.outputPerMillion
    );
  }
}
```

### Quality Monitoring

```typescript
interface QualityMetrics {
  successRate: number;           // Requests that completed successfully
  refusalRate: number;           // Requests refused by model
  errorRate: number;             // Technical errors
  avgResponseTime: number;
  p95ResponseTime: number;
  userFeedback: {
    helpful: number;
    notHelpful: number;
    ratio: number;
  };
  escalationRate: number;        // Users who contacted support
}

class QualityMonitor {
  private window: SlidingWindow;

  recordRequest(request: RequestMetrics): void {
    this.window.add({
      timestamp: Date.now(),
      success: request.success,
      refused: request.refused,
      error: request.error,
      responseTimeMs: request.responseTimeMs,
    });
  }

  recordFeedback(feedback: UserFeedback): void {
    this.window.addFeedback(feedback);
  }

  getMetrics(): QualityMetrics {
    const data = this.window.getData();

    const total = data.length;
    const successes = data.filter(d => d.success).length;
    const refusals = data.filter(d => d.refused).length;
    const errors = data.filter(d => d.error).length;

    const responseTimes = data.map(d => d.responseTimeMs).sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);

    const feedback = this.window.getFeedback();

    return {
      successRate: successes / total,
      refusalRate: refusals / total,
      errorRate: errors / total,
      avgResponseTime: average(responseTimes),
      p95ResponseTime: responseTimes[p95Index],
      userFeedback: {
        helpful: feedback.helpful,
        notHelpful: feedback.notHelpful,
        ratio: feedback.helpful / (feedback.helpful + feedback.notHelpful),
      },
      escalationRate: this.window.getEscalationRate(),
    };
  }
}
```

### Drift Detection

Detect changes in behavior before users complain.

```typescript
interface DriftDetector {
  baseline: BaselineMetrics;
  current: CurrentMetrics;
  thresholds: DriftThresholds;
}

// Types of drift to monitor
const driftTypes = {
  // Model behavior changed
  modelDrift: {
    metrics: ['refusalRate', 'avgResponseLength', 'sentimentScore'],
    threshold: 0.2,  // 20% change triggers alert
  },

  // Prompt effectiveness changed
  promptDrift: {
    metrics: ['structuredOutputCompliance', 'instructionFollowing'],
    threshold: 0.15,
  },

  // Data/corpus changed
  dataDrift: {
    metrics: ['retrievalRelevance', 'sourceFreshness'],
    threshold: 0.25,
  },

  // User behavior changed
  userDrift: {
    metrics: ['queryComplexity', 'avgSessionLength', 'featureUsage'],
    threshold: 0.3,
  },
};

async function detectDrift(
  current: MetricsSnapshot,
  baseline: MetricsSnapshot
): Promise<DriftAlert[]> {
  const alerts: DriftAlert[] = [];

  for (const [driftType, config] of Object.entries(driftTypes)) {
    for (const metric of config.metrics) {
      const baselineValue = baseline[metric];
      const currentValue = current[metric];
      const change = Math.abs(currentValue - baselineValue) / baselineValue;

      if (change > config.threshold) {
        alerts.push({
          type: driftType,
          metric,
          baselineValue,
          currentValue,
          changePercent: change * 100,
          severity: change > config.threshold * 2 ? 'high' : 'medium',
        });
      }
    }
  }

  return alerts;
}
```

### Observability Tools

Popular tools for LLM observability:

| Tool | Strength | Open Source |
|------|----------|-------------|
| [Langfuse](https://langfuse.com) | Full-featured, self-hostable | Yes (MIT) |
| [LangSmith](https://smith.langchain.com) | LangChain integration | No |
| [Helicone](https://helicone.ai) | Simple proxy setup, caching | Partial |
| [Arize Phoenix](https://phoenix.arize.com) | ML observability | Yes |
| [OpenLLMetry](https://openllmetry.dev) | OpenTelemetry for LLMs | Yes |

**Langfuse example:**

```typescript
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
});

async function tracedChat(messages: Message[]): Promise<ChatResponse> {
  const trace = langfuse.trace({
    name: 'chat',
    metadata: { feature: 'support-chat' },
  });

  const generation = trace.generation({
    name: 'llm-call',
    model: 'gpt-4o',
    input: messages,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
  });

  generation.end({
    output: response.choices[0].message,
    usage: {
      input: response.usage.prompt_tokens,
      output: response.usage.completion_tokens,
    },
  });

  return response;
}
```

### Dashboards and Alerts

```typescript
// Key dashboards to build
const dashboards = {
  operations: {
    metrics: ['requestRate', 'errorRate', 'p95Latency', 'tokenUsage'],
    refreshInterval: '1m',
  },

  cost: {
    metrics: ['costByModel', 'costByTenant', 'costTrend', 'budgetUtilization'],
    refreshInterval: '5m',
  },

  quality: {
    metrics: ['successRate', 'feedbackRatio', 'escalationRate', 'driftAlerts'],
    refreshInterval: '15m',
  },
};

// Alert rules
const alertRules = [
  {
    name: 'high_error_rate',
    condition: 'errorRate > 0.05',
    severity: 'critical',
    notification: ['pagerduty', 'slack'],
  },
  {
    name: 'cost_spike',
    condition: 'hourly_cost > 2 * avg_hourly_cost',
    severity: 'warning',
    notification: ['slack'],
  },
  {
    name: 'quality_degradation',
    condition: 'feedbackRatio < 0.7 for 1h',
    severity: 'warning',
    notification: ['slack', 'email'],
  },
  {
    name: 'drift_detected',
    condition: 'any drift alert with severity=high',
    severity: 'warning',
    notification: ['slack'],
  },
];
```

## Common Pitfalls

- **Only logging errors.** Success cases contain important signals too.
- **No cost attribution.** You can't optimize what you don't measure.
- **Ignoring qualitative feedback.** User thumbs-down is a leading indicator.
- **Static baselines.** Update baselines as your system evolves.

## Related

- [Model Routing](./model-routing.md) — Cost optimization
- [Deployment and Versioning](./deployment-versioning.md) — Tracking changes

## Previous

- [Security](./security.md)

## Next

- [Evals and CI/CD for AI](./evals-cicd.md)
