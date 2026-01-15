# Legal, IP, and Compliance Basics

> Provider terms, copyright, attribution, and data requirements—what you need to know.

## TL;DR

- **Read provider terms**: They dictate what data you can send and how outputs can be used
- **AI-generated code may have IP issues**: Copyright status is unsettled; err on caution for critical code
- **Attribution varies by provider**: Some require disclosure; check your agreements
- **Data residency matters**: Where prompts are processed may trigger compliance requirements
- **When in doubt, ask legal**: AI creates novel situations; don't guess on significant decisions

## Core Concepts

### Provider Terms and Data Usage

Every AI provider has terms governing:
- What data you can send
- How they use your data
- Who owns the outputs
- What you can do with outputs

**Key questions to answer:**

| Question | Why It Matters |
|----------|----------------|
| Is my data used for training? | Trade secrets, proprietary code exposure |
| Where is data processed? | GDPR, data residency requirements |
| How long is data retained? | Compliance, data minimization |
| Can I opt out of training? | Control over proprietary information |
| Who owns generated outputs? | IP rights for code you ship |

**Current provider positions (verify with current terms):**

| Provider | API Data Training | Opt-Out Available | Data Retention |
|----------|-------------------|-------------------|----------------|
| OpenAI | Not by default (API) | Yes, via settings | 30 days default |
| Anthropic | Not by default | Yes | Limited retention |
| Google | Varies by product | Yes | Varies |

**Important:** Terms change. Check current terms for your specific use case and agreement tier.

### Copyright and IP for Generated Code

The legal status of AI-generated content is unsettled and evolving.

**Current uncertainty:**

- **No clear copyright owner**: AI outputs may not be copyrightable (no human author)
- **Training data questions**: If model was trained on copyrighted code, is output derivative?
- **License contamination**: Could generated code inherit licenses from training data?

**Practical guidance:**

```typescript
// Lower risk: Use AI for patterns that are generic
// - CRUD operations
// - Standard data transformations
// - Common algorithm implementations

// Higher risk: Be cautious with AI for
// - Core differentiating IP
// - Code where ownership matters (licensing to others)
// - Exact reproductions of specific implementations
```

**Safe practices:**

1. **Review generated code**: Don't blindly accept; understand what you're shipping
2. **Modify and integrate**: Transformation reduces derivative work concerns
3. **Document the process**: Note that AI assisted, but human reviewed and modified
4. **Avoid verbatim prompting**: Don't ask for "implement X exactly like in library Y"

### Attribution Requirements

Depending on your provider agreement and use case:

**When attribution may be required:**

- Consumer-facing products using certain APIs
- Academic or research contexts
- When publishing generated content
- Specific enterprise agreements

**How to attribute:**

```typescript
// Code comment attribution
/**
 * Helper function for date formatting.
 * AI-assisted development; human reviewed and modified.
 */

// User-facing disclosure
<Footer>
  Some content generated with AI assistance.
</Footer>

// Documentation
## Development Notes
This component was developed with AI coding assistance.
All code reviewed and tested by human engineers.
```

**When attribution typically isn't required:**

- Internal tools and code
- Significantly modified outputs
- General API usage per terms

Check your specific agreements—requirements vary.

### Third-Party License Constraints

If AI generates code that resembles specific open-source projects:

**Risk assessment:**

| Scenario | Risk Level | Mitigation |
|----------|------------|------------|
| Generic patterns (loops, conditionals) | Low | Standard practice |
| Common algorithms (sorting, searching) | Low | Implementations vary |
| Framework-specific code (React components) | Medium | Review for specificity |
| Exact reproduction of library code | High | Avoid; write differently |

**Red flags:**

```typescript
// If generated code includes:
// - Specific variable names matching a library
// - Unusual implementation choices matching a specific project
// - Comments or documentation from other projects

// Then: Review carefully, consider rewriting
```

### Data Residency and Compliance

Where your data is processed matters for compliance:

**GDPR considerations:**

- Personal data of EU residents has restrictions
- Processing outside EU requires specific safeguards
- Data minimization principles apply

**Industry-specific requirements:**

| Industry | Relevant Regulations | Key Concerns |
|----------|---------------------|--------------|
| Healthcare | HIPAA (US), various | PHI must not go to AI providers |
| Finance | SOX, PCI-DSS, various | Transaction data, PII |
| Government | FedRAMP, various | Data sovereignty, clearance |
| Education | FERPA (US), various | Student data |

**Compliance checklist:**

- [ ] Identify what data classifications apply to your use case
- [ ] Verify provider certifications (SOC 2, ISO 27001, etc.)
- [ ] Check data processing locations
- [ ] Review data retention policies
- [ ] Confirm opt-out mechanisms if needed
- [ ] Document compliance decisions

### Export Control Considerations

In some jurisdictions, AI technology may be subject to export controls:

- Using AI services across borders
- Sharing AI-generated outputs internationally
- Fine-tuning models on controlled data

Consult legal if your work involves export-controlled data or cross-border operations.

## In Practice

### Decision Framework

When facing an IP or compliance question:

```
1. Is this a novel situation?
   Yes → Consult legal
   No → Apply established policy

2. What's the potential impact?
   High (public, customer-facing, licensed to others) → Extra scrutiny
   Low (internal, prototype) → Standard practices

3. What data is involved?
   Restricted/Confidential → Review compliance requirements
   Internal/Public → Standard practices

4. What jurisdiction matters?
   International → Check all applicable regulations
   Domestic → Check local regulations
```

### Safe Defaults

When policies aren't clear, default to conservative:

```typescript
// Safe default practices
const safeDefaults = {
  // Data handling
  assumeLogging: true,              // Assume prompts are logged
  assumeRetention: true,            // Assume some retention period
  minimizeData: true,               // Only include necessary context

  // IP handling
  reviewAllOutput: true,            // Human review before shipping
  avoidExactCopy: true,             // Don't request specific implementations
  documentAssistance: true,         // Note AI involvement

  // Compliance
  checkClassification: true,        // Verify data classification before use
  consultOnNovel: true,             // Ask legal when uncertain
};
```

### Documentation Template

For significant AI-assisted work:

```markdown
## AI Assistance Documentation

**Date:** [Date]
**Component:** [What was built]
**AI Tool Used:** [Tool name and version]

### Data Sent to AI
- Code context: [Description - no proprietary details]
- Data classification: [Public/Internal]
- Sensitive data included: No

### Output Usage
- Human reviewed: Yes
- Modifications made: [Summary]
- Tests added: Yes

### IP Considerations
- Core differentiating code: No
- Licensed to third parties: No
- Compliance reviewed: [Yes/No/NA]

### Approvals
- Technical review: [Name]
- Legal/Compliance (if required): [Name/NA]
```

## Common Pitfalls

- **Assuming terms are universal.** Each provider is different; each tier may differ.
- **Ignoring geographic considerations.** Where data goes matters for compliance.
- **Not documenting.** If you can't show your process, you can't defend it.
- **Waiting for certainty.** Law is evolving; make defensible decisions now.

## Related

- [Operational Guardrails](./operational-guardrails.md) — Day-to-day data handling
- [Bias, Harms, and Transparency](./bias-harms-transparency.md) — User-facing disclosure
- [Moderation and Policy](../04-shipping-ai-features/moderation-policy.md) — Production compliance
