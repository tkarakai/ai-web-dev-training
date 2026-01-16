# Model Routing and Cost/Latency Engineering

Choosing models dynamically, optimizing costs, and building robust fallbacks.

## TL;DR

- **Route by task**: use expensive models only where quality matters
- **Caching** at multiple levels can reduce costs 50-90%
- Build **fallbacks and degraded modes**—providers have outages
- **Batch async work** for ~50% cost savings
- **Local-first routing**: privacy/cost locally, quality escalation to cloud

## Core Concepts

### Task-Based Routing

Not every request needs GPT-4.

```typescript
interface RoutingDecision {
  model: string;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
}

interface TaskClassification {
  complexity: 'simple' | 'moderate' | 'complex';
  requiresReasoning: boolean;
  requiresCreativity: boolean;
  tokensEstimate: number;
  qualitySensitivity: 'low' | 'medium' | 'high';
}

function routeByTask(task: TaskClassification): RoutingDecision {
  // Simple tasks: Use smallest effective model
  if (task.complexity === 'simple' && task.qualitySensitivity === 'low') {
    return {
      model: 'gpt-4o-mini',
      reason: 'simple_task',
      estimatedCost: 0.0001,
      estimatedLatency: 200,
    };
  }

  // Moderate tasks: Balance cost and quality
  if (task.complexity === 'moderate' || task.qualitySensitivity === 'medium') {
    return {
      model: 'claude-3-5-sonnet',
      reason: 'moderate_complexity',
      estimatedCost: 0.003,
      estimatedLatency: 500,
    };
  }

  // Complex tasks: Use best available
  if (task.requiresReasoning || task.qualitySensitivity === 'high') {
    return {
      model: 'claude-3-5-opus',
      reason: 'high_complexity',
      estimatedCost: 0.015,
      estimatedLatency: 1000,
    };
  }

  // Default
  return {
    model: 'gpt-4o',
    reason: 'default',
    estimatedCost: 0.005,
    estimatedLatency: 600,
  };
}
```

### Dynamic Routing Signals

Route based on runtime signals.

```typescript
interface RoutingContext {
  userId: string;
  tier: 'free' | 'pro' | 'enterprise';
  taskType: string;
  inputLength: number;
  urgency: 'realtime' | 'background';
  previousAttempt?: {
    model: string;
    failed: boolean;
    reason?: string;
  };
}

async function dynamicRoute(
  request: Request,
  context: RoutingContext
): Promise<RoutingDecision> {
  // User tier affects model access
  const tierModels = {
    free: ['gpt-4o-mini', 'claude-3-haiku'],
    pro: ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet'],
    enterprise: ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet', 'claude-3-5-opus'],
  };

  const availableModels = tierModels[context.tier];

  // Check provider health
  const healthyModels = await filterHealthyModels(availableModels);

  // Check budget
  const withinBudget = await filterByBudget(healthyModels, context.userId);

  // Select based on task
  const taskClassification = classifyTask(request);
  const preferredModel = selectModel(taskClassification, withinBudget);

  // If previous attempt failed, try different model
  if (context.previousAttempt?.failed) {
    return selectFallback(preferredModel, withinBudget, context.previousAttempt);
  }

  return preferredModel;
}
```

### Caching Strategies

**Response caching:**

```typescript
interface CacheConfig {
  exactMatch: {
    enabled: boolean;
    ttl: number;
  };
  semanticCache: {
    enabled: boolean;
    similarityThreshold: number;
    ttl: number;
  };
}

async function cachedGeneration(
  request: GenerationRequest,
  config: CacheConfig
): Promise<GenerationResponse> {
  // Level 1: Exact match
  if (config.exactMatch.enabled) {
    const exactKey = hashRequest(request);
    const cached = await cache.get(exactKey);
    if (cached) {
      return { ...cached, cacheHit: 'exact' };
    }
  }

  // Level 2: Semantic match
  if (config.semanticCache.enabled) {
    const embedding = await embed(request.prompt);
    const similar = await vectorCache.searchSimilar(embedding, {
      threshold: config.semanticCache.similarityThreshold,
    });

    if (similar) {
      return { ...similar.response, cacheHit: 'semantic' };
    }
  }

  // Generate fresh response
  const response = await generate(request);

  // Store in caches
  if (config.exactMatch.enabled) {
    await cache.set(hashRequest(request), response, config.exactMatch.ttl);
  }
  if (config.semanticCache.enabled) {
    await vectorCache.store(embedding, response, config.semanticCache.ttl);
  }

  return { ...response, cacheHit: 'none' };
}
```

**Retrieval caching:**

```typescript
// Cache RAG results separately from LLM responses
async function cachedRetrieval(
  query: string,
  config: RetrievalCacheConfig
): Promise<RetrievalResult> {
  const cacheKey = `retrieval:${hashQuery(query)}`;

  const cached = await cache.get(cacheKey);
  if (cached && !isStale(cached, config.maxAge)) {
    return cached;
  }

  const fresh = await retriever.search(query);
  await cache.set(cacheKey, fresh, config.ttl);

  return fresh;
}
```

### Fallbacks and Degraded Modes

```typescript
interface FallbackChain {
  primary: ModelConfig;
  fallbacks: ModelConfig[];
  degradedMode: DegradedModeConfig;
}

async function resilientGeneration(
  request: Request,
  chain: FallbackChain
): Promise<Response> {
  // Try primary
  try {
    return await generateWithTimeout(request, chain.primary);
  } catch (error) {
    logger.warn('Primary model failed', { model: chain.primary.id, error });
  }

  // Try fallbacks in order
  for (const fallback of chain.fallbacks) {
    try {
      return await generateWithTimeout(request, fallback);
    } catch (error) {
      logger.warn('Fallback failed', { model: fallback.id, error });
    }
  }

  // Enter degraded mode
  return handleDegradedMode(request, chain.degradedMode);
}

interface DegradedModeConfig {
  type: 'cached_response' | 'static_response' | 'human_handoff' | 'error';
  config: Record<string, unknown>;
}

async function handleDegradedMode(
  request: Request,
  config: DegradedModeConfig
): Promise<Response> {
  switch (config.type) {
    case 'cached_response':
      // Return most similar cached response
      return findSimilarCachedResponse(request);

    case 'static_response':
      // Return pre-defined response
      return {
        content: config.config.message as string,
        degraded: true,
      };

    case 'human_handoff':
      // Queue for human response
      await queueForHuman(request);
      return {
        content: "I'm having trouble right now. A human will respond shortly.",
        degraded: true,
      };

    case 'error':
    default:
      throw new ServiceUnavailableError('All models unavailable');
  }
}
```

### Batch Processing

```typescript
interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  priority: 'cost' | 'latency';
}

class BatchProcessor {
  private queue: BatchItem[] = [];
  private timer: NodeJS.Timeout | null = null;

  async add(request: Request): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });

      if (this.queue.length >= this.config.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.config.maxWaitTime);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const batch = this.queue.splice(0, this.config.maxBatchSize);
    if (batch.length === 0) return;

    try {
      // Use batch API for ~50% cost savings
      const responses = await openai.batches.create({
        requests: batch.map(item => ({
          custom_id: item.request.id,
          method: 'POST',
          url: '/v1/chat/completions',
          body: item.request.body,
        })),
      });

      // Resolve individual promises
      for (const item of batch) {
        const response = responses.find(r => r.custom_id === item.request.id);
        if (response?.response) {
          item.resolve(response.response);
        } else {
          item.reject(new Error('No response in batch'));
        }
      }
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
  }
}
```

### Local-First Routing

```typescript
interface LocalFirstConfig {
  localModel: LocalModelConfig;
  cloudModel: CloudModelConfig;
  escalationThreshold: number;  // Complexity score 0-1
}

async function localFirstRoute(
  request: Request,
  config: LocalFirstConfig
): Promise<Response> {
  const complexity = await estimateComplexity(request);

  // Simple requests: Use local model
  if (complexity < config.escalationThreshold) {
    try {
      const response = await generateLocal(request, config.localModel);

      // Validate quality
      const quality = await quickQualityCheck(response);
      if (quality.acceptable) {
        return { ...response, model: 'local', cost: 0 };
      }

      // Quality too low, escalate
      logger.info('Local response quality too low, escalating');
    } catch (error) {
      logger.warn('Local model failed, escalating', { error });
    }
  }

  // Complex requests or failed local: Use cloud
  return generateCloud(request, config.cloudModel);
}

async function estimateComplexity(request: Request): Promise<number> {
  const signals = {
    inputLength: request.prompt.length / 10000,  // Longer = more complex
    questionWords: countQuestionWords(request.prompt) / 10,
    technicalTerms: countTechnicalTerms(request.prompt) / 20,
    multiStep: detectMultiStepRequest(request.prompt) ? 0.3 : 0,
  };

  return Math.min(1, Object.values(signals).reduce((a, b) => a + b, 0));
}
```

### Cost Optimization Summary

| Strategy | Savings | Effort | Trade-off |
|----------|---------|--------|-----------|
| Task-based routing | 30-50% | Low | Some quality variance |
| Response caching | 50-90% | Medium | Staleness risk |
| Batch processing | ~50% | Medium | Higher latency |
| Smaller models | 70-90% | Low | Lower quality |
| Local models | 80-100% | High | Hardware costs |

## Common Pitfalls

- **One model for everything.** Route appropriately to save 50%+ on costs.
- **No fallbacks.** Providers fail; have backup plans.
- **Ignoring latency.** Cost-optimized isn't always user-optimized.
- **Over-caching.** Stale responses hurt more than costs saved.

## Related

- [API Integration Patterns](./api-integration.md) — Request handling
- [Observability](./observability.md) — Cost monitoring

## Previous

- [Fine-Tuning Strategy](./fine-tuning.md)

## Next

- [Deployment and Versioning](./deployment-versioning.md)
