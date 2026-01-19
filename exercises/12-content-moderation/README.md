# Exercise 12: Content Moderation

Filter inappropriate content using multiple layers of checks.

## What You'll Learn

1. **Blocklists** - Pattern matching against known bad content
2. **Pattern detection** - Regex patterns for suspicious behavior
3. **Classification** - Categorize content by type/risk
4. **Layered filtering** - Multiple checks in sequence
5. **Rate limiting** - Track violations per user

## Prerequisites

No llama-server needed for this exercise - it's pure TypeScript!

## The Code to Study

```
lib/moderation.ts       <- THE MAIN FILE - blocklists, patterns, pipeline
lib/moderation.test.ts  <- Comprehensive tests
```

## Key Concepts

### Blocklists

```typescript
const BLOCKLISTS = {
  violence: {
    words: ['bomb threat', 'mass shooting', 'terrorist attack'],
    category: 'violence',
  },
  spam: {
    words: ['click here now', 'free money', 'act fast'],
    category: 'spam',
  },
  scam: {
    words: ['send bitcoin', 'wire transfer', 'nigerian prince'],
    category: 'scam',
  },
};

function checkBlocklists(content: string): FilterResult[] {
  const results = [];
  for (const [listName, { words, category }] of Object.entries(BLOCKLISTS)) {
    for (const word of words) {
      if (content.toLowerCase().includes(word)) {
        results.push({ triggered: true, category, score: 1.0 });
      }
    }
  }
  return results;
}
```

### Pattern Detection

```typescript
const PATTERNS = {
  all_caps: {
    pattern: /\b[A-Z]{10,}\b/g,       // SHOUTING
    category: 'harassment',
    score: 0.2,
  },
  repeated_chars: {
    pattern: /(.)\1{5,}/g,            // Helllllllo
    category: 'spam',
    score: 0.4,
  },
  crypto_request: {
    pattern: /send.*(?:bitcoin|btc|eth|crypto)/gi,
    category: 'scam',
    score: 0.8,
  },
};
```

### Content Classifier

```typescript
function classifyContent(content: string): Record<Category, number> {
  const scores = { hate: 0, violence: 0, spam: 0, ... };

  const violenceIndicators = ['kill', 'attack', 'destroy', 'weapon'];
  scores.violence = calculateIndicatorScore(content, violenceIndicators);

  const spamIndicators = ['click', 'subscribe', 'free', '!!!'];
  scores.spam = calculateIndicatorScore(content, spamIndicators);

  return scores;
}
```

### Moderation Pipeline

```typescript
class ContentModerator {
  moderate(content: string): ModerationResult {
    const results = [];

    // Layer 1: Blocklist check
    results.push(...checkBlocklists(content));

    // Layer 2: Pattern check
    results.push(...checkPatterns(content));

    // Layer 3: Classification
    const scores = classifyContent(content);

    // Determine action based on scores
    const maxScore = Math.max(...Object.values(scores));

    if (maxScore >= this.blockThreshold) return { action: 'block', ... };
    if (maxScore >= this.warnThreshold) return { action: 'warn', ... };
    return { action: 'allow', ... };
  }
}
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start the UI
bun dev
```

Open http://localhost:3012 to test content moderation.

## Moderation Actions

| Action | When | Response |
|--------|------|----------|
| `allow` | Content is clean | Process normally |
| `warn` | Borderline content | Show warning, allow with flag |
| `block` | Clearly problematic | Reject content |
| `review` | Uncertain | Queue for human review |

## Code Patterns to Note

### 1. Configurable Thresholds

```typescript
const moderator = new ContentModerator({
  warnThreshold: 0.5,      // Warn at 50% confidence
  blockThreshold: 0.8,     // Block at 80% confidence
  autoBlockCategories: ['violence', 'self_harm'],  // Always block these
});
```

### 2. Violation Tracking

```typescript
class ViolationTracker {
  recordViolation(userId: string) {
    // Count violations in time window
    // Block user temporarily after N violations
    if (violations >= maxViolations) {
      this.cooldownUntil = Date.now() + cooldownMs;
      return { blocked: true };
    }
  }
}
```

### 3. Combined System

```typescript
class ModerationSystem {
  check(content: string, userId: string) {
    // Check if user is blocked
    if (this.violationTracker.isBlocked(userId)) {
      return { action: 'block', reason: 'Too many violations' };
    }

    // Run content moderation
    const result = this.moderator.moderate(content);

    // Track violation if blocked
    if (result.action === 'block') {
      this.violationTracker.recordViolation(userId);
    }

    return result;
  }
}
```

### 4. Custom Filters

```typescript
const moderator = new ContentModerator({
  customFilters: [
    {
      name: 'profanity',
      check: (content) => ({
        triggered: profanityList.some(w => content.includes(w)),
        category: 'harassment',
        score: 0.7,
      }),
    },
  ],
});
```

## Categories

| Category | Description | Default Action |
|----------|-------------|----------------|
| `hate` | Hate speech, discrimination | Block |
| `violence` | Threats, violent content | Auto-block |
| `harassment` | Bullying, personal attacks | Warn/Block |
| `self_harm` | Self-harm content | Auto-block |
| `spam` | Promotional spam | Warn |
| `scam` | Fraud attempts | Block |
| `illegal` | Illegal activities | Auto-block |
| `clean` | No issues detected | Allow |

## Exercises to Try

1. **Add a new blocklist** - Create a blocklist for a specific domain
2. **Implement leetspeak detection** - Detect "h4te" as "hate"
3. **Add ML classification** - Use an LLM to classify content
4. **Build appeal system** - Allow users to appeal moderation decisions

## Limitations

This is a rule-based system for demonstration. Production systems should:

- Use ML models for better accuracy
- Handle adversarial attacks (unicode, leetspeak)
- Include human review workflows
- Support multiple languages
- Update blocklists regularly
- Log all decisions for auditing

## Next Exercise

[Exercise 13: Prompt Injection Defense](../13-prompt-injection) - Protect against prompt manipulation.
