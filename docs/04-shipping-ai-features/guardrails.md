# Operational Guardrails

Practical day-to-day policies for safe AI usage in development.

## TL;DR

- **Classify your data** before it goes into any prompt—some things should never be shared
- Secrets, credentials, and customer PII are **never acceptable** in prompts
- Know when AI **increases risk** more than it helps—missing tests, unclear requirements, time pressure
- Local models provide **privacy, not correctness**—the same verification requirements apply
- Create **team-level defaults** so safe practices are automatic, not heroic

## Core Concepts

### Data Classification for Prompts

Everything you put in a prompt may be:
- Logged by the provider
- Used for model improvement (unless opted out)
- Subject to data retention policies
- Potentially exposed through prompt injection

**Classification framework:**

| Classification | Can Use in Prompts? | Examples |
|----------------|---------------------|----------|
| **Public** | Yes | Open-source code, public docs, published APIs |
| **Internal** | Check policy | Proprietary code, internal docs, architecture |
| **Confidential** | Usually no | Customer data, business metrics, contracts |
| **Restricted** | Never | Secrets, credentials, PII, health/financial data |

### What Never Goes in Prompts

**1. Secrets and credentials**

```typescript
// NEVER do this
const prompt = `Debug this code:
const apiKey = "sk-live-abc123...";
const dbPassword = "production_password";
`;

// Instead, redact before prompting
const sanitizedCode = redactSecrets(code);
const prompt = `Debug this code:\n${sanitizedCode}`;
```

**2. Personal Identifiable Information (PII)**

```typescript
// NEVER do this
const prompt = `Help me write an email to John Smith at john@example.com
about his account balance of $45,230`;

// Instead, use placeholders
const prompt = `Help me write an email to [CUSTOMER_NAME] at [EMAIL]
about their account balance of [AMOUNT]`;
```

**3. Customer data**

```typescript
// NEVER do this
const prompt = `Analyze this customer record: ${JSON.stringify(customerData)}`;

// Instead, use synthetic or anonymized data
const prompt = `Analyze a customer record with this structure: ${schema}`;
```

**4. Proprietary algorithms or business logic**

If competitive advantage depends on keeping something secret, don't share it with AI providers.

### Safe Handling Patterns

**Redaction utilities:**

```typescript
function redactForLLM(content: string): string {
  return content
    // API keys and secrets
    .replace(
      /(['"]?)(?:api[_-]?key|secret|password|token|credential)(['"]?)\s*[:=]\s*(['"])[^'"]{8,}['"]/gi,
      '$1$2$3: "[REDACTED]"'
    )
    // Environment variable values
    .replace(
      /process\.env\.(\w+)/g,
      (match, name) => `process.env.${name} /* value redacted */`
    )
    // Common secret patterns
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[API_KEY_REDACTED]')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[GITHUB_TOKEN_REDACTED]')
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // Credit card numbers
    .replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '[CARD_NUMBER]');
}
```

**Before sending:**

```typescript
async function safeLLMCall(prompt: string): Promise<string> {
  // Check for obvious leaks
  const leakPatterns = [
    /sk-[a-zA-Z0-9]{20,}/,  // OpenAI keys
    /ghp_[a-zA-Z0-9]{36}/,  // GitHub tokens
    /-----BEGIN.*PRIVATE KEY-----/,
    /password\s*[:=]\s*['"][^'"]+['"]/i,
  ];

  for (const pattern of leakPatterns) {
    if (pattern.test(prompt)) {
      throw new Error('Potential secret detected in prompt. Refusing to send.');
    }
  }

  return await llm.complete(prompt);
}
```

### When to Avoid AI

AI increases risk more than it helps in certain situations:

**1. Missing tests**

If you can't verify AI output, you can't trust it.

```typescript
// Risky: No tests exist
"Add caching to the user service"
// AI generates plausible code, but you can't verify correctness
// Bugs hide until production

// Better: Write tests first
"Here are the tests for user service caching. Implement the cache to pass them."
```

**2. Unclear requirements**

Ambiguity leads to AI guessing—and guessing wrong.

```typescript
// Risky: Vague requirement
"Improve the performance"
// AI makes arbitrary optimization choices

// Better: Specific requirement
"Reduce the /api/users endpoint response time from 800ms to under 200ms.
Current bottleneck is the N+1 query in getUserWithOrders."
```

**3. Security-critical areas**

The cost of AI mistakes in security code is too high.

```typescript
// Higher scrutiny areas:
// - Authentication and authorization
// - Input validation and sanitization
// - Cryptographic operations
// - Payment processing
// - PII handling
```

**4. Time pressure**

When rushed, the temptation to accept unverified output increases.

```typescript
// Red flag scenario:
// - Production is down
// - AI suggests a quick fix
// - You apply it without testing
// - It makes things worse
```

**5. Unfamiliar domain**

You can't review what you don't understand.

```typescript
// If you've never written Kubernetes configs, you can't verify AI-generated ones
// If you don't know GraphQL, you can't spot AI mistakes in resolvers
// Use AI to learn, but verify with documentation and experts
```

### Local Models: Privacy vs. Correctness

Running models locally provides data privacy—your prompts never leave your machine. But:

- **Privacy ≠ correctness.** Local models hallucinate just like cloud models.
- **Privacy ≠ security.** Generated code still needs security review.
- **Smaller models = more errors.** Local models are typically smaller, with lower accuracy.

```typescript
// Same verification requirements apply
const localResponse = await ollama.generate(prompt);

// Still need to:
// - Validate the output
// - Run tests
// - Review for security
// - Check for hallucinations
```

### Browsing-Enabled Tools

If your AI tools can browse the web:

**Trust considerations:**

| Source Type | Trust Level | Action |
|-------------|-------------|--------|
| Official documentation | High | Generally reliable, but verify versions |
| Stack Overflow | Medium | May be outdated or incorrect |
| Random blogs | Low | Cross-reference with official docs |
| Unknown domains | Very low | Verify independently |

**Citation requirements:**

```typescript
// Require sources for factual claims
const prompt = `Answer this question with citations:
${question}

Format each claim as:
- [Claim] (Source: [URL])`;
```

**Security risks:**

- Prompt injection via web content
- Malicious code in web examples
- Outdated/vulnerable code patterns

## In Practice

### Team Policy Template

```markdown
## AI Usage Policy

### Approved Tools
- IDE: [List approved copilots/extensions]
- Chat: [List approved services]
- CLI: [List approved agents]

### Data Rules
- Never include: secrets, credentials, PII, customer data
- Allowed with caution: internal code, architecture docs
- Freely allowed: public code, general questions

### Review Requirements
- Security-sensitive code: Mandatory senior review
- Database changes: Mandatory review + DBA sign-off
- API changes: Mandatory review + API owner sign-off
- Other code: Standard review process

### Disclosure
- Note significant AI assistance in PR descriptions
- Don't claim AI-generated work as solely your own
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for potential secrets in staged files
SECRETS_PATTERN='(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|password\s*=\s*['\''"][^'\''"]+['\''"])'

if git diff --cached | grep -E "$SECRETS_PATTERN"; then
  echo "ERROR: Potential secret detected in commit."
  echo "Review your changes and remove secrets before committing."
  exit 1
fi
```

### Safe Defaults Checklist

- [ ] API keys are in environment variables, not code
- [ ] CI/CD checks for secret patterns in commits
- [ ] AI tools configured to not log prompts (where possible)
- [ ] Team trained on data classification
- [ ] Incident response plan for accidental exposure

## Common Pitfalls

- **"It's just for local testing."** Habits formed in dev carry to production.
- **"The AI won't remember it."** But logs, training data, and breaches might.
- **"I'll review it later."** Later never comes under deadline pressure.
- **"Our internal code isn't sensitive."** Attackers find value you don't expect.

## Related

- [Orientation](../02-governance/orientation.md) — AI failure modes and risk assessment
- [Legal, IP, and Compliance](../02-governance/legal-ip-compliance.md) — Regulatory requirements
- [Security](./security.md) — Prompt injection and tool abuse

## Previous

- [Multi-Agent Systems and Orchestration](./multi-agent-orchestration.md)

## Next

- [Evals Basics](./evals-basics.md)
