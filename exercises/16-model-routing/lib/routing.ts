/**
 * Model Routing
 *
 * Route requests to different models based on complexity and cost.
 *
 * KEY CONCEPTS:
 * 1. Complexity classification - Determine query difficulty
 * 2. Cost-based routing - Balance quality vs cost
 * 3. Fallback chains - Try cheaper models first
 * 4. Custom routing rules - Domain-specific routing
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ModelConfig {
  id: string;
  name: string;
  endpoint: string;
  costPer1kTokens: number;
  maxTokens: number;
  latencyMs: number; // Typical latency
  capabilities: ModelCapability[];
}

export type ModelCapability =
  | 'chat'
  | 'code'
  | 'reasoning'
  | 'math'
  | 'creative'
  | 'fast'
  | 'multilingual';

export interface RoutingDecision {
  model: ModelConfig;
  reason: string;
  complexity: ComplexityLevel;
  confidence: number;
}

export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

export interface RoutingRule {
  name: string;
  condition: (input: string, context?: RoutingContext) => boolean;
  targetModel: string;
  priority: number;
}

export interface RoutingContext {
  userId?: string;
  conversationLength?: number;
  domain?: string;
  previousModels?: string[];
  budget?: number;
}

export interface RoutingResult {
  response: string;
  modelUsed: ModelConfig;
  decision: RoutingDecision;
  latencyMs: number;
  tokenCount: number;
  cost: number;
}

// =============================================================================
// MODEL REGISTRY
// =============================================================================

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'small',
    name: 'Small Model (0.5B)',
    endpoint: 'http://127.0.0.1:8033',
    costPer1kTokens: 0.0001,
    maxTokens: 2048,
    latencyMs: 100,
    capabilities: ['chat', 'fast'],
  },
  {
    id: 'medium',
    name: 'Medium Model (3B)',
    endpoint: 'http://127.0.0.1:8034',
    costPer1kTokens: 0.0005,
    maxTokens: 4096,
    latencyMs: 300,
    capabilities: ['chat', 'code', 'reasoning'],
  },
  {
    id: 'large',
    name: 'Large Model (7B+)',
    endpoint: 'http://127.0.0.1:8035',
    costPer1kTokens: 0.002,
    maxTokens: 8192,
    latencyMs: 800,
    capabilities: ['chat', 'code', 'reasoning', 'math', 'creative', 'multilingual'],
  },
];

export class ModelRegistry {
  private models: Map<string, ModelConfig> = new Map();

  constructor(models: ModelConfig[] = DEFAULT_MODELS) {
    for (const model of models) {
      this.models.set(model.id, model);
    }
  }

  get(id: string): ModelConfig | undefined {
    return this.models.get(id);
  }

  getAll(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  getByCapability(capability: ModelCapability): ModelConfig[] {
    return this.getAll().filter((m) => m.capabilities.includes(capability));
  }

  getCheapest(): ModelConfig {
    return this.getAll().reduce((cheapest, model) =>
      model.costPer1kTokens < cheapest.costPer1kTokens ? model : cheapest
    );
  }

  getMostCapable(): ModelConfig {
    return this.getAll().reduce((best, model) =>
      model.capabilities.length > best.capabilities.length ? model : best
    );
  }
}

// =============================================================================
// COMPLEXITY CLASSIFICATION
// =============================================================================

export interface ComplexitySignals {
  wordCount: number;
  sentenceCount: number;
  hasCode: boolean;
  hasMath: boolean;
  hasMultiStep: boolean;
  technicalTermCount: number;
  questionCount: number;
  reasoningIndicators: number;
}

/**
 * Analyze input complexity signals
 */
export function analyzeComplexity(input: string): ComplexitySignals {
  const words = input.split(/\s+/).filter((w) => w.length > 0);
  const sentences = input.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  // Code detection
  const codePatterns = [
    /```/,
    /function\s+\w+/,
    /const\s+\w+/,
    /let\s+\w+/,
    /class\s+\w+/,
    /import\s+/,
    /export\s+/,
    /=>/,
    /\{\s*\}/,
  ];
  const hasCode = codePatterns.some((p) => p.test(input));

  // Math detection
  const mathPatterns = [
    /\d+\s*[\+\-\*\/\^]\s*\d+/,
    /calculate/i,
    /compute/i,
    /solve/i,
    /equation/i,
    /formula/i,
    /derivative/i,
    /integral/i,
    /probability/i,
  ];
  const hasMath = mathPatterns.some((p) => p.test(input));

  // Multi-step detection
  const multiStepPatterns = [
    /first.*then/i,
    /step\s*\d/i,
    /\d+\.\s+/,
    /and then/i,
    /after that/i,
    /finally/i,
    /multi-?step/i,
  ];
  const hasMultiStep = multiStepPatterns.some((p) => p.test(input));

  // Technical terms
  const technicalTerms = [
    'algorithm',
    'architecture',
    'database',
    'api',
    'framework',
    'protocol',
    'encryption',
    'authentication',
    'optimization',
    'concurrency',
    'asynchronous',
    'recursive',
    'polymorphism',
    'abstraction',
  ];
  const lowerInput = input.toLowerCase();
  const technicalTermCount = technicalTerms.filter((t) =>
    lowerInput.includes(t)
  ).length;

  // Question count
  const questionCount = (input.match(/\?/g) || []).length;

  // Reasoning indicators
  const reasoningPatterns = [
    /why\s/i,
    /how\s/i,
    /explain/i,
    /compare/i,
    /analyze/i,
    /evaluate/i,
    /what if/i,
    /pros and cons/i,
    /trade-?off/i,
  ];
  const reasoningIndicators = reasoningPatterns.filter((p) =>
    p.test(input)
  ).length;

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    hasCode,
    hasMath,
    hasMultiStep,
    technicalTermCount,
    questionCount,
    reasoningIndicators,
  };
}

/**
 * Classify complexity level from signals
 */
export function classifyComplexity(signals: ComplexitySignals): {
  level: ComplexityLevel;
  confidence: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  // Length-based scoring
  if (signals.wordCount > 100) {
    score += 2;
    reasons.push('Long input');
  } else if (signals.wordCount > 50) {
    score += 1;
    reasons.push('Medium-length input');
  }

  // Code
  if (signals.hasCode) {
    score += 2;
    reasons.push('Contains code');
  }

  // Math
  if (signals.hasMath) {
    score += 2;
    reasons.push('Mathematical content');
  }

  // Multi-step
  if (signals.hasMultiStep) {
    score += 2;
    reasons.push('Multi-step task');
  }

  // Technical
  if (signals.technicalTermCount >= 3) {
    score += 2;
    reasons.push('Highly technical');
  } else if (signals.technicalTermCount >= 1) {
    score += 1;
    reasons.push('Some technical terms');
  }

  // Multiple questions
  if (signals.questionCount > 2) {
    score += 2;
    reasons.push('Multiple questions');
  } else if (signals.questionCount > 1) {
    score += 1;
    reasons.push('Compound question');
  }

  // Reasoning
  if (signals.reasoningIndicators >= 2) {
    score += 2;
    reasons.push('Requires reasoning');
  } else if (signals.reasoningIndicators >= 1) {
    score += 1;
    reasons.push('Some analysis needed');
  }

  // Determine level and confidence
  let level: ComplexityLevel;
  let confidence: number;

  if (score >= 6) {
    level = 'complex';
    confidence = Math.min(0.95, 0.7 + score * 0.03);
  } else if (score >= 3) {
    level = 'moderate';
    confidence = 0.7 + Math.abs(score - 4.5) * 0.05;
  } else {
    level = 'simple';
    confidence = Math.min(0.95, 0.8 + (3 - score) * 0.05);
  }

  if (reasons.length === 0) {
    reasons.push('Straightforward query');
  }

  return { level, confidence, reasons };
}

// =============================================================================
// ROUTER
// =============================================================================

export interface RouterConfig {
  registry: ModelRegistry;
  defaultModel: string;
  rules?: RoutingRule[];
  costWeight?: number; // 0-1, higher = prefer cheaper
  latencyWeight?: number; // 0-1, higher = prefer faster
}

export class ModelRouter {
  private registry: ModelRegistry;
  private defaultModel: string;
  private rules: RoutingRule[];
  private costWeight: number;
  private latencyWeight: number;

  constructor(config: RouterConfig) {
    this.registry = config.registry;
    this.defaultModel = config.defaultModel;
    this.rules = config.rules || [];
    this.costWeight = config.costWeight ?? 0.3;
    this.latencyWeight = config.latencyWeight ?? 0.2;
  }

  /**
   * Route to best model for input
   */
  route(input: string, context?: RoutingContext): RoutingDecision {
    // Check custom rules first (sorted by priority)
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
    for (const rule of sortedRules) {
      if (rule.condition(input, context)) {
        const model = this.registry.get(rule.targetModel);
        if (model) {
          return {
            model,
            reason: `Rule: ${rule.name}`,
            complexity: 'moderate', // Rules override complexity
            confidence: 0.95,
          };
        }
      }
    }

    // Analyze complexity
    const signals = analyzeComplexity(input);
    const { level, confidence, reasons } = classifyComplexity(signals);

    // Get candidate models
    const models = this.registry.getAll();

    // Score each model
    const scoredModels = models.map((model) => {
      let score = 0;

      // Capability match
      if (signals.hasCode && model.capabilities.includes('code')) {
        score += 20;
      }
      if (signals.hasMath && model.capabilities.includes('math')) {
        score += 20;
      }
      if (signals.reasoningIndicators > 0 && model.capabilities.includes('reasoning')) {
        score += 15;
      }

      // Complexity match
      if (level === 'complex') {
        // Prefer larger models
        score += model.capabilities.length * 5;
        score += model.maxTokens / 1000;
      } else if (level === 'simple') {
        // Prefer smaller/faster models
        score += (1 - model.costPer1kTokens / 0.01) * 10;
        score += (1 - model.latencyMs / 1000) * 10;
      }

      // Cost penalty
      score -= model.costPer1kTokens * 1000 * this.costWeight * 10;

      // Latency penalty
      score -= (model.latencyMs / 100) * this.latencyWeight;

      // Budget constraint
      if (context?.budget !== undefined) {
        const estimatedCost = (signals.wordCount * 1.5) / 1000 * model.costPer1kTokens;
        if (estimatedCost > context.budget) {
          score -= 100; // Strong penalty for over-budget
        }
      }

      return { model, score };
    });

    // Sort by score
    scoredModels.sort((a, b) => b.score - a.score);
    const bestModel = scoredModels[0]?.model || this.registry.get(this.defaultModel)!;

    return {
      model: bestModel,
      reason: reasons.join(', '),
      complexity: level,
      confidence,
    };
  }

  /**
   * Add a routing rule
   */
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a rule by name
   */
  removeRule(name: string): boolean {
    const index = this.rules.findIndex((r) => r.name === name);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }
}

// =============================================================================
// FALLBACK CHAIN
// =============================================================================

export interface FallbackConfig {
  models: string[]; // Model IDs in order of preference (cheapest first)
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Try models in order until one succeeds
 */
export class FallbackChain {
  private registry: ModelRegistry;
  private config: FallbackConfig;

  constructor(registry: ModelRegistry, config: Partial<FallbackConfig> = {}) {
    this.registry = registry;
    this.config = {
      models: config.models || ['small', 'medium', 'large'],
      maxRetries: config.maxRetries ?? 1,
      retryDelayMs: config.retryDelayMs ?? 500,
    };
  }

  /**
   * Execute with fallback
   */
  async execute(
    fn: (model: ModelConfig) => Promise<string>
  ): Promise<{ result: string; modelUsed: ModelConfig; attempts: number }> {
    let lastError: Error | null = null;
    let attempts = 0;

    for (const modelId of this.config.models) {
      const model = this.registry.get(modelId);
      if (!model) continue;

      for (let retry = 0; retry <= this.config.maxRetries; retry++) {
        attempts++;
        try {
          const result = await fn(model);
          return { result, modelUsed: model, attempts };
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (retry < this.config.maxRetries) {
            await new Promise((r) => setTimeout(r, this.config.retryDelayMs));
          }
        }
      }
    }

    throw lastError || new Error('All models failed');
  }
}

// =============================================================================
// EXAMPLE RULES
// =============================================================================

export const EXAMPLE_RULES: RoutingRule[] = [
  {
    name: 'code-generation',
    condition: (input) =>
      /write|create|implement|build|code|function|class/i.test(input) &&
      /code|program|script|function|class|module/i.test(input),
    targetModel: 'medium',
    priority: 10,
  },
  {
    name: 'simple-greeting',
    condition: (input) =>
      input.length < 50 && /^(hi|hello|hey|thanks|bye)/i.test(input.trim()),
    targetModel: 'small',
    priority: 20,
  },
  {
    name: 'complex-analysis',
    condition: (input) =>
      /analyze|compare|evaluate|pros and cons|trade-?off/i.test(input) &&
      input.length > 100,
    targetModel: 'large',
    priority: 15,
  },
  {
    name: 'math-problem',
    condition: (input) =>
      /solve|calculate|compute|equation|formula|derivative|integral/i.test(input),
    targetModel: 'large',
    priority: 15,
  },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost for a request
 */
export function calculateCost(
  model: ModelConfig,
  promptTokens: number,
  completionTokens: number
): number {
  return ((promptTokens + completionTokens) / 1000) * model.costPer1kTokens;
}

/**
 * Format cost as string
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(4)}c`;
  }
  return `$${cost.toFixed(4)}`;
}

// =============================================================================
// FULL ROUTING CLIENT
// =============================================================================

export interface RoutingClientConfig {
  models?: ModelConfig[];
  defaultModel?: string;
  rules?: RoutingRule[];
  costWeight?: number;
  latencyWeight?: number;
}

/**
 * Complete routing client with fallback
 */
export class RoutingClient {
  private registry: ModelRegistry;
  private router: ModelRouter;
  private fallback: FallbackChain;

  constructor(config: RoutingClientConfig = {}) {
    this.registry = new ModelRegistry(config.models);
    this.router = new ModelRouter({
      registry: this.registry,
      defaultModel: config.defaultModel || 'medium',
      rules: config.rules,
      costWeight: config.costWeight,
      latencyWeight: config.latencyWeight,
    });
    this.fallback = new FallbackChain(this.registry);
  }

  /**
   * Route and execute a chat request
   */
  async chat(
    messages: Array<{ role: string; content: string }>,
    context?: RoutingContext
  ): Promise<RoutingResult> {
    const input = messages.map((m) => m.content).join(' ');
    const decision = this.router.route(input, context);

    const startTime = Date.now();
    let tokenCount = 0;

    const { result, modelUsed, attempts } = await this.fallback.execute(
      async (model) => {
        const res = await fetch(`${model.endpoint}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        if (!res.ok) {
          throw new Error(`Request failed: ${res.statusText}`);
        }

        const data = await res.json();
        tokenCount =
          (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
        return data.choices?.[0]?.message?.content || '';
      }
    );

    const latencyMs = Date.now() - startTime;
    const cost = calculateCost(modelUsed, tokenCount * 0.7, tokenCount * 0.3);

    return {
      response: result,
      modelUsed,
      decision: { ...decision, model: modelUsed },
      latencyMs,
      tokenCount,
      cost,
    };
  }

  /**
   * Get routing decision without executing
   */
  preview(input: string, context?: RoutingContext): RoutingDecision {
    return this.router.route(input, context);
  }

  /**
   * Add a custom routing rule
   */
  addRule(rule: RoutingRule): void {
    this.router.addRule(rule);
  }
}
