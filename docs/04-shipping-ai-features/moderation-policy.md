# Moderation, Rate Limits, and Policy Enforcement

> Preventing abuse, enforcing policies, and building user reporting workflows.

## TL;DR

- Use **layered moderation**: pre-generation filters, model-level, post-generation checks
- Implement **rate limits** at multiple levels: per-user, per-tenant, adaptive
- Build clear **user reporting and escalation** paths
- Log for safety review **without exposing sensitive content**
- Balance security with UX—false positives erode trust

## Core Concepts

### Layered Moderation Architecture

No single layer catches everything. Use defense in depth.

```typescript
interface ModerationPipeline {
  preGeneration: PreFilter[];    // Before calling LLM
  modelLevel: ModelConfig;        // Model's built-in safety
  postGeneration: PostFilter[];   // After receiving response
}

async function moderatedGeneration(
  input: UserInput,
  pipeline: ModerationPipeline
): Promise<ModerationResult> {
  // Layer 1: Pre-generation filters
  for (const filter of pipeline.preGeneration) {
    const result = await filter.check(input);
    if (result.blocked) {
      return { blocked: true, reason: result.reason, layer: 'pre' };
    }
  }

  // Layer 2: Model generation (with safety settings)
  const response = await generateWithSafetySettings(input, pipeline.modelLevel);

  // Layer 3: Post-generation filters
  for (const filter of pipeline.postGeneration) {
    const result = await filter.check(response);
    if (result.blocked) {
      return { blocked: true, reason: result.reason, layer: 'post' };
    }
  }

  return { blocked: false, content: response };
}
```

### Pre-Generation Filters

Check input before spending tokens.

```typescript
// Keyword/pattern blocklist
const keywordFilter: PreFilter = {
  name: 'keyword_blocklist',
  check: async (input: UserInput) => {
    const blockedPatterns = [
      /how to (make|create|build) (a )?(bomb|weapon|explosive)/i,
      /child (porn|abuse|exploitation)/i,
      // ... other patterns
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(input.text)) {
        return { blocked: true, reason: 'content_policy_violation' };
      }
    }

    return { blocked: false };
  },
};

// Classification model filter
const classifierFilter: PreFilter = {
  name: 'content_classifier',
  check: async (input: UserInput) => {
    const classification = await moderationAPI.classify(input.text);

    const thresholds = {
      hate: 0.7,
      violence: 0.8,
      sexual: 0.8,
      self_harm: 0.6,
    };

    for (const [category, score] of Object.entries(classification.scores)) {
      if (score > thresholds[category]) {
        return {
          blocked: true,
          reason: `${category}_content`,
          confidence: score,
        };
      }
    }

    return { blocked: false };
  },
};
```

### Model-Level Safety

Configure model safety settings.

```typescript
// OpenAI moderation endpoint
async function checkWithOpenAIModeration(text: string): Promise<ModerationResult> {
  const response = await openai.moderations.create({ input: text });

  const result = response.results[0];
  if (result.flagged) {
    const categories = Object.entries(result.categories)
      .filter(([_, flagged]) => flagged)
      .map(([category]) => category);

    return {
      blocked: true,
      reason: 'content_flagged',
      categories,
      scores: result.category_scores,
    };
  }

  return { blocked: false };
}

// Anthropic's built-in safety
const anthropicConfig = {
  // Claude has built-in safety; configure via system prompt
  systemPrompt: `You are a helpful assistant.

Safety guidelines:
- Do not provide instructions for illegal activities
- Do not generate explicit sexual content
- Do not help with harassment or threats
- If asked to do something unsafe, politely decline and explain why`,
};
```

### Post-Generation Filters

Catch issues the model didn't prevent.

```typescript
// Output content checker
const outputFilter: PostFilter = {
  name: 'output_checker',
  check: async (response: string) => {
    // Check for PII leakage
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/,  // SSN
      /\b\d{16}\b/,             // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    ];

    for (const pattern of piiPatterns) {
      if (pattern.test(response)) {
        return {
          blocked: true,
          reason: 'pii_detected',
          action: 'redact_and_return', // Or block entirely
        };
      }
    }

    // Check for jailbreak indicators
    const jailbreakIndicators = [
      /ignore (?:my |the )?(?:previous )?instructions/i,
      /DAN mode/i,
      /as an AI without restrictions/i,
    ];

    for (const pattern of jailbreakIndicators) {
      if (pattern.test(response)) {
        return { blocked: true, reason: 'potential_jailbreak' };
      }
    }

    return { blocked: false };
  },
};
```

### Rate Limiting

**Per-user limits:**

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({ url: process.env.REDIS_URL, token: process.env.REDIS_TOKEN });

// Different limits for different tiers
const rateLimiters = {
  free: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),  // 10 per minute
    prefix: 'ratelimit:free',
  }),
  pro: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 per minute
    prefix: 'ratelimit:pro',
  }),
  enterprise: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 m'), // 1000 per minute
    prefix: 'ratelimit:enterprise',
  }),
};

async function checkRateLimit(
  userId: string,
  tier: 'free' | 'pro' | 'enterprise'
): Promise<RateLimitResult> {
  const limiter = rateLimiters[tier];
  const { success, limit, remaining, reset } = await limiter.limit(userId);

  return {
    allowed: success,
    limit,
    remaining,
    resetAt: new Date(reset),
  };
}
```

**Adaptive rate limiting:**

```typescript
// Adjust limits based on behavior
interface AdaptiveLimit {
  userId: string;
  baseLimit: number;
  currentMultiplier: number;
  trustScore: number;
}

async function getAdaptiveLimit(userId: string): Promise<number> {
  const userData = await getUserData(userId);

  // Factors that increase limit
  const positiveFactors = [
    userData.accountAge > 30 ? 1.2 : 1,           // Older accounts
    userData.verifiedEmail ? 1.1 : 1,             // Verified
    userData.payingCustomer ? 1.5 : 1,            // Paying
    userData.violationCount === 0 ? 1.2 : 1,      // Clean history
  ];

  // Factors that decrease limit
  const negativeFactors = [
    userData.recentViolations > 0 ? 0.5 : 1,      // Recent issues
    userData.flaggedContent > 5 ? 0.7 : 1,        // Flagged history
  ];

  const multiplier = positiveFactors.reduce((a, b) => a * b, 1) *
                     negativeFactors.reduce((a, b) => a * b, 1);

  return Math.floor(userData.baseLimit * multiplier);
}
```

### User Reporting Workflows

```typescript
interface ContentReport {
  id: string;
  reporterId: string;
  contentId: string;
  contentType: 'message' | 'response' | 'user';
  reason: ReportReason;
  description?: string;
  timestamp: Date;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
}

type ReportReason =
  | 'harmful_content'
  | 'misinformation'
  | 'harassment'
  | 'spam'
  | 'privacy_violation'
  | 'other';

// Report submission
async function submitReport(
  report: Omit<ContentReport, 'id' | 'timestamp' | 'status'>
): Promise<ContentReport> {
  const fullReport: ContentReport = {
    ...report,
    id: crypto.randomUUID(),
    timestamp: new Date(),
    status: 'pending',
  };

  await db.reports.create({ data: fullReport });

  // Auto-escalate high-priority reports
  if (isHighPriority(report)) {
    await escalateToReviewQueue(fullReport);
  }

  // Notify reporter
  await notifyReporter(fullReport);

  return fullReport;
}

// Review queue
async function getReviewQueue(options: QueueOptions): Promise<ContentReport[]> {
  return db.reports.findMany({
    where: { status: 'pending' },
    orderBy: [
      { priority: 'desc' },
      { timestamp: 'asc' },
    ],
    take: options.limit,
  });
}
```

### Policy Enforcement Actions

```typescript
type EnforcementAction =
  | { type: 'warning'; message: string }
  | { type: 'content_removal'; contentId: string }
  | { type: 'rate_limit_reduction'; newLimit: number; duration: string }
  | { type: 'temporary_ban'; duration: string }
  | { type: 'permanent_ban' };

async function enforcePolicy(
  userId: string,
  violation: Violation,
  history: ViolationHistory
): Promise<EnforcementAction> {
  // Escalating enforcement based on history
  const violationCount = history.totalViolations;
  const severity = violation.severity;

  if (severity === 'critical') {
    return { type: 'permanent_ban' };
  }

  if (violationCount === 0) {
    return { type: 'warning', message: getWarningMessage(violation) };
  }

  if (violationCount < 3) {
    return {
      type: 'rate_limit_reduction',
      newLimit: Math.floor(history.baseLimit * 0.5),
      duration: '7d',
    };
  }

  if (violationCount < 5) {
    return { type: 'temporary_ban', duration: '30d' };
  }

  return { type: 'permanent_ban' };
}
```

### Safety Logging

Log for review without exposing sensitive content.

```typescript
interface SafetyLog {
  id: string;
  timestamp: Date;
  userId: string;  // Hashed for privacy
  action: 'blocked' | 'flagged' | 'allowed';
  reason?: string;
  category?: string;
  contentHash: string;  // Hash, not content
  metadata: {
    inputLength: number;
    outputLength?: number;
    modelUsed: string;
    latencyMs: number;
  };
}

function createSafetyLog(
  event: ModerationEvent,
  content: string
): SafetyLog {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    userId: hashUserId(event.userId),
    action: event.action,
    reason: event.reason,
    category: event.category,
    contentHash: crypto.createHash('sha256').update(content).digest('hex'),
    metadata: {
      inputLength: event.inputLength,
      outputLength: event.outputLength,
      modelUsed: event.model,
      latencyMs: event.latencyMs,
    },
  };
}

// Separate secure storage for actual content (if needed for appeals)
async function storeForAppeal(
  logId: string,
  content: string,
  expiresIn: string = '30d'
): Promise<void> {
  const encrypted = await encrypt(content, CONTENT_ENCRYPTION_KEY);
  await secureStorage.set(`appeal:${logId}`, encrypted, { ex: parseDuration(expiresIn) });
}
```

## Common Pitfalls

- **Single-layer moderation.** Any single filter has gaps; layer them.
- **Blocking without explanation.** Users need to understand what went wrong.
- **No appeal process.** False positives happen; provide recourse.
- **Logging raw content.** Privacy risk; use hashes and secure storage.

## Related

- [Security](./security.md) — Prompt injection defenses
- [Product Patterns and UX](./product-patterns-ux.md) — User-facing error handling
- [Observability](./observability.md) — Monitoring moderation effectiveness
