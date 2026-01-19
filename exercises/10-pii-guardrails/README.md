# Exercise 10: PII Detection & Guardrails

Detect and redact personally identifiable information (PII) before sending to LLMs or storing in logs.

## What You'll Learn

1. **Pattern-based detection** - Regex patterns for common PII types
2. **Redaction** - Replace sensitive data with placeholders
3. **Risk classification** - Categorize data by sensitivity level
4. **Guardrails** - Block or warn on high-risk content

## Prerequisites

No llama-server needed for this exercise - it's pure TypeScript!

## The Code to Study

```
lib/pii-guardrails.ts       <- THE MAIN FILE - patterns, scanner, guardrails
lib/pii-guardrails.test.ts  <- Comprehensive detection tests
```

## Key Concepts

### PII Patterns

```typescript
const PII_PATTERNS = {
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    riskLevel: 'medium',
  },
  ssn: {
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    riskLevel: 'critical',
  },
  credit_card: {
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|...)\b/g,
    riskLevel: 'critical',
  },
  api_key: {
    pattern: /\b(?:sk|pk|api)[_-](?:live|test)?[_-]?[A-Za-z0-9]{20,50}\b/g,
    riskLevel: 'critical',
  },
  // ... more patterns
};
```

### PIIScanner

```typescript
class PIIScanner {
  scan(text: string): ScanResult {
    const matches: PIIMatch[] = [];

    for (const [type, { pattern, riskLevel }] of this.patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          type,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          riskLevel,
        });
      }
    }

    return {
      originalText: text,
      redactedText: this.redact(text, matches),
      matches,
      hasHighRisk: matches.some(m => ['critical', 'high'].includes(m.riskLevel)),
      riskSummary: this.summarize(matches),
    };
  }
}
```

### Redaction

```typescript
// Default: [EMAIL:jo***@***.com]
function defaultRedactionFormat(type: PIIType, value: string): string {
  const masked = value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
  return `[${type.toUpperCase()}:${masked}]`;
}

// Alternative formats
const REDACTION_FORMATS = {
  simple: () => '[REDACTED]',
  asterisks: (_, value) => '*'.repeat(value.length),
  typeOnly: (type) => `[${type.toUpperCase()}]`,
  placeholder: (type) => `<PII_${type.toUpperCase()}_1>`,
};
```

### Guardrails

```typescript
function applyGuardrails(text: string, scanner: PIIScanner, config: GuardrailConfig) {
  const scanResult = scanner.scan(text);

  if (config.blockOnCritical && scanResult.riskSummary.critical > 0) {
    return {
      allowed: false,
      reason: 'Contains critical-risk PII',
      scanResult,
    };
  }

  if (config.maxMatches && scanResult.matches.length > config.maxMatches) {
    return {
      allowed: false,
      reason: `Too many PII matches (${scanResult.matches.length})`,
      scanResult,
    };
  }

  return { allowed: true, scanResult };
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

Open http://localhost:3010 to test PII detection.

## Risk Levels

| Level | PII Types | Action |
|-------|-----------|--------|
| Critical | SSN, Credit Card, Bank Account, API Key, Passport | Block by default |
| High | Driver's License | Warn, optionally block |
| Medium | Email, Phone, Address, DOB | Log, allow with redaction |
| Low | IP Address, Names | Allow, optional logging |

## Code Patterns to Note

### 1. Configurable Scanner

```typescript
// Strict: all PII types
const strict = new PIIScanner();

// Moderate: skip low-risk
const moderate = new PIIScanner({
  enabledTypes: ['email', 'phone', 'ssn', 'credit_card'],
});

// Minimal: only critical
const minimal = new PIIScanner({
  enabledTypes: ['ssn', 'credit_card', 'api_key'],
});
```

### 2. Custom Patterns

```typescript
const scanner = new PIIScanner({
  customPatterns: {
    internal_id: {
      pattern: /\bINT-\d{6}\b/g,
      riskLevel: 'medium',
    },
  },
});
```

### 3. Middleware Pattern

```typescript
const withPII = withPIIProtection(scanner, { blockOnCritical: true });

const result = await withPII(userInput, async (sanitizedInput) => {
  return await llm.chat([{ role: 'user', content: sanitizedInput }]);
});

if (result.blocked) {
  return { error: result.blocked };
}
return result.result;
```

### 4. Report Generation

```typescript
const result = scanner.scan(text);
const report = generateReport(result);

// === PII Scan Report ===
// Total matches: 3
// High risk: YES
//
// Risk Summary:
//   critical: 1
//   medium: 2
//
// Matches:
//   [CRITICAL] ssn: "123-45-6789" at 15
//   [MEDIUM] email: "john@test.com" at 42
```

## Exercises to Try

1. **Add a new PII pattern** - Detect passport numbers from other countries
2. **Implement reversible redaction** - Store mapping for later restoration
3. **Add context-aware detection** - "my SSN" vs random 9-digit number
4. **Build a PII audit log** - Track what was detected and when

## When to Use

| Scenario | Recommended Preset |
|----------|-------------------|
| Customer support chat | `moderate` - protect critical data |
| Internal tools | `minimal` - only financial/auth data |
| Healthcare apps | `strict` - all PII matters |
| Logging systems | `strict` with no redaction storage |

## Limitations

These patterns are simplified for demonstration:

- May have false positives (random numbers matching SSN format)
- May have false negatives (international formats)
- Context-unaware (can't distinguish "my SSN" from "order #123-45-6789")

Production systems should:
- Use more comprehensive regex libraries
- Add ML-based detection for context
- Handle international formats
- Include audit logging

## Next Exercise

[Exercise 11: Evaluation Framework](../11-evaluation) - Build a framework to test LLM outputs.
