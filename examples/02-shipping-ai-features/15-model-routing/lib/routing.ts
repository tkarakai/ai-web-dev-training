/**
 * Model routing utilities
 * - Task-based routing
 * - Dynamic routing signals
 * - Caching strategies
 * - Fallback chains
 * - Cost optimization
 */

import { generateId } from '@examples/shared/lib/utils';

// Types
export type Complexity = 'simple' | 'moderate' | 'complex';
export type UserTier = 'free' | 'pro' | 'enterprise';
export type Urgency = 'realtime' | 'background';
export type CacheHit = 'exact' | 'semantic' | 'none';
export type ModelHealth = 'healthy' | 'degraded' | 'down';

export interface Model {
  id: string;
  name: string;
  provider: string;
  costPer1kTokens: number;
  avgLatencyMs: number;
  quality: number; // 1-10
  capabilities: string[];
  health: ModelHealth;
}

export interface TaskClassification {
  complexity: Complexity;
  requiresReasoning: boolean;
  requiresCreativity: boolean;
  tokensEstimate: number;
  qualitySensitivity: 'low' | 'medium' | 'high';
}

export interface RoutingDecision {
  model: Model;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
  cacheHit: CacheHit;
  fallbackUsed: boolean;
}

export interface RoutingContext {
  userId: string;
  tier: UserTier;
  taskType: string;
  inputLength: number;
  urgency: Urgency;
  previousAttempt?: {
    model: string;
    failed: boolean;
    reason?: string;
  };
}

export interface CacheEntry {
  id: string;
  prompt: string;
  response: string;
  model: string;
  createdAt: Date;
  hitCount: number;
}

export interface CostMetrics {
  totalRequests: number;
  totalCost: number;
  cacheHitRate: number;
  avgCostPerRequest: number;
  savingsFromCache: number;
  savingsFromRouting: number;
  byModel: Record<string, { requests: number; cost: number }>;
}

// Available models
export const models: Model[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    costPer1kTokens: 0.00015,
    avgLatencyMs: 200,
    quality: 6,
    capabilities: ['chat', 'simple-reasoning'],
    health: 'healthy',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    costPer1kTokens: 0.005,
    avgLatencyMs: 600,
    quality: 8,
    capabilities: ['chat', 'reasoning', 'creativity', 'code'],
    health: 'healthy',
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    costPer1kTokens: 0.00025,
    avgLatencyMs: 180,
    quality: 6,
    capabilities: ['chat', 'simple-reasoning'],
    health: 'healthy',
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    costPer1kTokens: 0.003,
    avgLatencyMs: 500,
    quality: 9,
    capabilities: ['chat', 'reasoning', 'creativity', 'code', 'analysis'],
    health: 'healthy',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3.5 Opus',
    provider: 'Anthropic',
    costPer1kTokens: 0.015,
    avgLatencyMs: 1000,
    quality: 10,
    capabilities: ['chat', 'reasoning', 'creativity', 'code', 'analysis', 'complex-tasks'],
    health: 'healthy',
  },
  {
    id: 'llama-local',
    name: 'Llama 3.2 (Local)',
    provider: 'Local',
    costPer1kTokens: 0,
    avgLatencyMs: 100,
    quality: 5,
    capabilities: ['chat', 'simple-reasoning'],
    health: 'healthy',
  },
];

// Tier-based model access
export const tierModels: Record<UserTier, string[]> = {
  free: ['gpt-4o-mini', 'claude-3-haiku', 'llama-local'],
  pro: ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku', 'claude-3-sonnet', 'llama-local'],
  enterprise: ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus', 'llama-local'],
};

// Classify task complexity
export function classifyTask(prompt: string): TaskClassification {
  const wordCount = prompt.split(/\s+/).length;
  const hasQuestionWords = /\b(why|how|what|explain|analyze|compare|evaluate)\b/i.test(prompt);
  const hasComplexTerms = /\b(algorithm|architecture|optimize|design|implement|strategy)\b/i.test(prompt);
  const isMultiStep = /\b(then|after|next|finally|first|second)\b/i.test(prompt) ||
    prompt.includes('\n') && prompt.split('\n').length > 3;

  let complexity: Complexity = 'simple';
  if (isMultiStep || hasComplexTerms) {
    complexity = 'complex';
  } else if (hasQuestionWords || wordCount > 50) {
    complexity = 'moderate';
  }

  const requiresReasoning = hasQuestionWords || hasComplexTerms;
  const requiresCreativity = /\b(write|create|generate|story|poem|creative)\b/i.test(prompt);

  let qualitySensitivity: 'low' | 'medium' | 'high' = 'low';
  if (hasComplexTerms || isMultiStep) {
    qualitySensitivity = 'high';
  } else if (requiresReasoning || requiresCreativity) {
    qualitySensitivity = 'medium';
  }

  return {
    complexity,
    requiresReasoning,
    requiresCreativity,
    tokensEstimate: Math.ceil(wordCount * 1.3),
    qualitySensitivity,
  };
}

// Route by task classification
export function routeByTask(
  task: TaskClassification,
  availableModels: Model[]
): RoutingDecision {
  let selectedModel: Model;
  let reason: string;

  // Simple tasks: Use smallest effective model
  if (task.complexity === 'simple' && task.qualitySensitivity === 'low') {
    selectedModel = availableModels.find(m => m.id === 'llama-local') ||
      availableModels.find(m => m.id === 'gpt-4o-mini') ||
      availableModels[0];
    reason = 'simple_task_cheap_model';
  }
  // Moderate tasks: Balance cost and quality
  else if (task.complexity === 'moderate' || task.qualitySensitivity === 'medium') {
    selectedModel = availableModels.find(m => m.id === 'claude-3-sonnet') ||
      availableModels.find(m => m.id === 'gpt-4o') ||
      availableModels[0];
    reason = 'moderate_complexity_balanced';
  }
  // Complex tasks: Use best available
  else if (task.requiresReasoning || task.qualitySensitivity === 'high') {
    selectedModel = availableModels.find(m => m.id === 'claude-3-opus') ||
      availableModels.find(m => m.id === 'claude-3-sonnet') ||
      availableModels.find(m => m.id === 'gpt-4o') ||
      availableModels[0];
    reason = 'high_complexity_best_quality';
  }
  // Default
  else {
    selectedModel = availableModels.find(m => m.id === 'gpt-4o') ||
      availableModels[0];
    reason = 'default_selection';
  }

  const estimatedCost = (task.tokensEstimate / 1000) * selectedModel.costPer1kTokens * 2; // Input + output

  return {
    model: selectedModel,
    reason,
    estimatedCost,
    estimatedLatency: selectedModel.avgLatencyMs,
    cacheHit: 'none',
    fallbackUsed: false,
  };
}

// Get available models for tier with health filtering
export function getAvailableModels(tier: UserTier, filterHealth: boolean = true): Model[] {
  const allowedIds = tierModels[tier];
  return models.filter(m =>
    allowedIds.includes(m.id) &&
    (!filterHealth || m.health !== 'down')
  );
}

// Simple cache simulation
export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private semanticIndex: Map<string, string[]> = new Map(); // keyword -> cache keys

  set(prompt: string, response: string, model: string): void {
    const key = this.hashPrompt(prompt);
    const entry: CacheEntry = {
      id: key,
      prompt,
      response,
      model,
      createdAt: new Date(),
      hitCount: 0,
    };
    this.cache.set(key, entry);

    // Index for semantic search
    const keywords = this.extractKeywords(prompt);
    for (const keyword of keywords) {
      const existing = this.semanticIndex.get(keyword) || [];
      if (!existing.includes(key)) {
        this.semanticIndex.set(keyword, [...existing, key]);
      }
    }
  }

  getExact(prompt: string): CacheEntry | null {
    const key = this.hashPrompt(prompt);
    const entry = this.cache.get(key);
    if (entry) {
      entry.hitCount++;
      return entry;
    }
    return null;
  }

  getSemantic(prompt: string, threshold: number = 0.6): CacheEntry | null {
    const keywords = this.extractKeywords(prompt);
    const candidates: Map<string, number> = new Map();

    for (const keyword of keywords) {
      const keys = this.semanticIndex.get(keyword) || [];
      for (const key of keys) {
        candidates.set(key, (candidates.get(key) || 0) + 1);
      }
    }

    // Find best match
    let bestKey: string | null = null;
    let bestScore = 0;

    for (const [key, matchCount] of candidates.entries()) {
      const entry = this.cache.get(key);
      if (entry) {
        const entryKeywords = this.extractKeywords(entry.prompt);
        const score = matchCount / Math.max(keywords.length, entryKeywords.length);
        if (score > threshold && score > bestScore) {
          bestScore = score;
          bestKey = key;
        }
      }
    }

    if (bestKey) {
      const entry = this.cache.get(bestKey)!;
      entry.hitCount++;
      return entry;
    }

    return null;
  }

  getStats(): { size: number; totalHits: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }
    return { size: this.cache.size, totalHits };
  }

  private hashPrompt(prompt: string): string {
    // Simple hash for demo
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      hash = ((hash << 5) - hash) + prompt.charCodeAt(i);
      hash |= 0;
    }
    return `cache-${Math.abs(hash).toString(16)}`;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'or', 'and', 'if', 'then', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'that', 'this', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'you', 'your', 'we', 'our', 'they', 'their']);
    return text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }
}

// Fallback chain
export interface FallbackChain {
  primary: Model;
  fallbacks: Model[];
  degradedMessage: string;
}

export function createFallbackChain(tier: UserTier): FallbackChain {
  const available = getAvailableModels(tier);

  // Sort by quality descending
  const sorted = [...available].sort((a, b) => b.quality - a.quality);

  return {
    primary: sorted[0],
    fallbacks: sorted.slice(1),
    degradedMessage: "I'm having trouble connecting to AI services. Please try again in a moment.",
  };
}

// Simulate model failure
export function simulateModelHealth(): void {
  for (const model of models) {
    const rand = Math.random();
    if (rand < 0.05) {
      model.health = 'down';
    } else if (rand < 0.15) {
      model.health = 'degraded';
    } else {
      model.health = 'healthy';
    }
  }
}

// Cost optimization strategies
export const costStrategies = [
  {
    name: 'Task-based routing',
    savings: '30-50%',
    effort: 'Low',
    tradeoff: 'Some quality variance',
    description: 'Route simple tasks to cheaper models',
  },
  {
    name: 'Response caching',
    savings: '50-90%',
    effort: 'Medium',
    tradeoff: 'Staleness risk',
    description: 'Cache responses for repeated queries',
  },
  {
    name: 'Batch processing',
    savings: '~50%',
    effort: 'Medium',
    tradeoff: 'Higher latency',
    description: 'Batch async work for discounts',
  },
  {
    name: 'Smaller models',
    savings: '70-90%',
    effort: 'Low',
    tradeoff: 'Lower quality',
    description: 'Use mini/haiku for simple tasks',
  },
  {
    name: 'Local models',
    savings: '80-100%',
    effort: 'High',
    tradeoff: 'Hardware costs',
    description: 'Run models locally for privacy/cost',
  },
];

// Sample prompts for demo
export const samplePrompts = [
  { text: 'Hello!', expectedComplexity: 'simple' as Complexity },
  { text: 'What time is it?', expectedComplexity: 'simple' as Complexity },
  { text: 'Explain how photosynthesis works', expectedComplexity: 'moderate' as Complexity },
  { text: 'Write a short poem about autumn', expectedComplexity: 'moderate' as Complexity },
  { text: 'Design a microservices architecture for an e-commerce platform with recommendations', expectedComplexity: 'complex' as Complexity },
  { text: 'Analyze the trade-offs between consistency and availability in distributed systems', expectedComplexity: 'complex' as Complexity },
];

// Health status colors
export const healthColors: Record<ModelHealth, string> = {
  healthy: 'bg-green-100 text-green-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  down: 'bg-red-100 text-red-800',
};

// Complexity colors
export const complexityColors: Record<Complexity, string> = {
  simple: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  complex: 'bg-red-100 text-red-800',
};
