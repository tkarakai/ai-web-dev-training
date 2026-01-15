# How to use AI for Web Development

This guide is a practical map for using generative AI in web engineering. It's organized into four sections:

- **Core Concepts:** how LLMs work, prompting, context management, and protocols.
- **Governance:** policies, risks, ethics, and compliance.
- **AI-Assisted Development:** using AI to build software faster and safer.
- **Shipping AI Features:** shipping embedded AI features with production-grade reliability.

**Scope note:** This document focuses on generative AI for text and voice (LLMs, STT/TTS, tool-using agents). It excludes Computer Vision, image/audio generation, and non-generative ML unless explicitly noted.


## How to Use This Document

This page serves as the **index and summary**. Each topic links to a detailed guide in the corresponding section folder.

**New to AI-assisted development?**
Start with [Core Concepts](./01-core-concepts/) (all sections), then [Governance](./02-governance/), then [AI-Assisted Development](./03-ai-assisted-development/).

**Already using AI tools, now shipping AI features?**
Skim Core Concepts and Governance for shared vocabulary, then focus on [Shipping AI Features](./04-shipping-ai-features/).

**Quick reference?**
Jump directly to the topic you need using the links below. Each detailed guide has TL;DR, Core Concepts, Common Pitfalls, and Related sections.


## Core Concepts

> Detailed guides: [01-core-concepts/](./01-core-concepts/)

### [LLM Mechanics](./01-core-concepts/llm-mechanics.md)

**Topics**
- Tokens / cost / latency / truncation
- Context windows and sampling controls
- **Context management**: what goes in context, the relevance principle, context degradation
- Determinism, reproducibility, and why "close enough" is dangerous in prod
- **Open-source vs. proprietary LLMs**
  - Trade-offs: quality, cost, control, privacy, and operational overhead
  - Running models locally:
    - Model size vs. RAM/VRAM requirements
    - CPU vs GPU inference
    - CUDA (NVIDIA) vs non-CUDA (Metal/macOS, ROCm/Linux, CPU-only) considerations
  - Practical ecosystem:
    - Hugging Face (model discovery/weights)
    - GGUF + llama.cpp (local inference with quantization)

**Enables you to**
- Choose a model/serving approach based on latency, cost, and privacy constraints
- Understand why prompt length and context strategy dominate cost/perf
- Provide relevant context while avoiding overload and confusion
- Predict and mitigate truncation and nondeterminism issues

### [Prompting and Interaction Patterns](./01-core-concepts/prompting.md)

**Topics**
- Instruction hierarchy, constraints, examples, output formats
- Prompt debugging and iteration discipline
- "Trust but verify" habits: tests, repros, diffs
- **Agent loops & agentic workflows (intro)**
  - When to use single-shot prompting vs plan→act→observe loops
  - Stop conditions: step limits, budget limits, timeouts
  - Tool-using prompting patterns (e.g., ReAct-style separation of reasoning/action)

**Enables you to**
- Write prompts that produce structured, reviewable outputs
- Iteratively debug prompts by controlling variables and tightening constraints
- Design "safe prompts" that include verification steps (tests, validators)

### [MCP Protocol Overview](./01-core-concepts/mcp-protocol.md)

**Topics**
- What MCP is: a standard protocol for tool and context interfaces
- Core primitives: servers, tools, resources, prompts
- Local vs remote servers; transport and auth patterns
- Capability scoping, auditability, and least privilege
- Versioning and schema stability for tool contracts

**Enables you to**
- Explain when to use MCP vs direct API integrations
- Scope MCP servers safely and assess risk
- Map MCP usage to developer tooling (AI-Assisted Development) and product architecture (Shipping AI Features)


## Governance

> Detailed guides: [02-governance/](./02-governance/)

### [Orientation](./02-governance/orientation.md)

**Topics**
- What AI changes in web engineering (SDLC + product outcomes)
- Typical failure modes and how to recognize them early
- Policies: data handling, approved tools, review expectations

**Enables you to**
- Decide when to use AI vs. avoid it (risk-based)
- Recognize hallucinations, drift, and "confidently wrong" outputs
- Apply internal policy constraints consistently

### [Bias, Harms, and Transparency](./02-governance/bias-harms-transparency.md)

**Topics**
- Common bias and harm patterns in generated outputs
- Human impact assessment for user-facing AI features
- User transparency: disclosures, citations, and limitations
- Safeguards for sensitive or high-stakes domains

**Enables you to**
- Spot and mitigate biased or harmful outputs early
- Set expectations and disclosures appropriate to risk level
- Decide when not to use AI for a given user workflow

### [Operational Usage Guardrails](./02-governance/operational-guardrails.md)

**Topics**
- What can/can't go into prompts (data classification)
- Secure handling of secrets and customer data
- When to avoid AI (high-risk changes, unclear requirements, missing tests)
- Guardrails for local models too (privacy ≠ correctness)
- Rules for browsing-enabled tools (if permitted): source trust + citations

**Enables you to**
- Avoid accidental policy violations and data leaks
- Know when AI increases risk more than it helps
- Create team-level "safe defaults" for AI usage

### [Evals Basics](./02-governance/evals-basics.md)

**Topics**
- Define success criteria: what "good" means for the task
- Build small eval sets (golden cases, edge cases, regressions)
- Baselines and diffs: compare prompts/models/configs over time
- Human review gates and when to require them

**Enables you to**
- Create a minimal eval harness that catches obvious regressions
- Compare changes objectively before shipping or adopting new prompts
- Decide when human review is required vs optional

**See also:** For production-grade eval pipelines and CI/CD integration, see [Repeatable Evals and CI/CD for AI Behavior](./04-shipping-ai-features/evals-cicd.md) in Shipping AI Features.

### [Legal, IP, and Compliance Basics](./02-governance/legal-ip-compliance.md)

**Topics**
- Provider terms and data usage restrictions (what may be trained on, stored, or shared)
- IP/copyright considerations for generated outputs
- Attribution expectations and third-party license constraints
- Data residency and export/compliance requirements (as applicable)

**Enables you to**
- Avoid accidental policy or licensing violations
- Know when to consult legal/compliance before use
- Apply "safe defaults" for external sharing and publishing


## AI-Assisted Development (Using AI to Build Software Faster)

> Detailed guides: [03-ai-assisted-development/](./03-ai-assisted-development/)

### [Tooling Ecosystem and Setup](./03-ai-assisted-development/tooling-ecosystem.md)

**Topics**
- IDE copilots vs editor chat vs CLI agents
- Repo indexing/search tools; local vs hosted models
- Standard setups for full-stack roles (frontend/backend/platform)
- **Tool selection strategy**
  - Inline autocomplete tools: best for pattern-based coding, boilerplate, flow-state work
  - Project-aware IDE agents: best for multi-file edits, refactors requiring cross-file context
  - CLI/terminal agents: best for delegation, large autonomous tasks, repo-wide changes
  - Know the trade-offs: studies show perceived speed gains don't always translate to actual time savings once debugging is included—verify, don't just accept
- **Local open models deep dive**
  - Model selection: size, context length, quantization, quality/perf trade-offs
  - CPU-only vs GPU workflows; CUDA vs non-CUDA guidance
  - llama.cpp + GGUF basics; Hugging Face model discovery
- **MCP for developer tooling**
  - Using MCP servers locally for:
    - docs retrieval,
    - repo search,
    - ticketing/runbooks/internal APIs (where permitted)
  - Security considerations:
    - treat MCP servers as privileged; add auth/ACL if not strictly localhost
    - scope tools by least privilege and audit usage

**Enables you to**
- Build a personal "AI toolbelt" that's safe and consistent
- Choose the right tool for the task (autocomplete vs agent vs CLI)
- Configure local model fallback for privacy or offline use
- Use retrieval/indexing to supply better context than copy/paste

### [Day-to-Day Workflows](./03-ai-assisted-development/day-to-day-workflows.md)

**Topics**
- Scaffolding with architectural constraints
- Refactoring at scale: slicing strategy, safe checkpoints
- Debugging: minimal repro, hypothesis loops, targeted instrumentation
- Reading unfamiliar repos: architecture extraction, dependency maps
- Migration assistance (framework upgrades, API versioning, DB migrations)
- **Vibe coding**
  - When it's useful (rapid prototyping, exploring solution space)
  - When it's risky (security-critical changes, ambiguous requirements)
  - Diminishing returns: often useful for first ~70% of a task, increasingly risky for the last 30% where edge cases and correctness matter
  - How to "graduate" to disciplined engineering: spec→checkpoints→tests→review
- **Spec-driven development (SDD)**
  - Core idea: define acceptance criteria and constraints before generating code
  - Best practices:
    - acceptance criteria as executable intent
    - freeze constraints early (APIs, invariants, performance budgets)
    - plan/task breakdown before code
    - verify with tests and diffs at each checkpoint

**Enables you to**
- Run safe, incremental AI-assisted refactors with rollback options
- Use SDD to reduce "AI thrash" and improve consistency
- Convert vague ideas into testable specs and implementation plans

### [Testing and Quality with AI](./03-ai-assisted-development/testing-quality.md)

**Topics**
- Generating tests responsibly (assertion-first prompting)
- Property-based tests, fuzzing assistance, contract tests
- Using AI to strengthen reviews (risk surfacing, invariants, edge cases)
- Spec→tests workflows (from acceptance criteria to test scaffolds)
- Mutation-inspired prompting: ask AI to propose changes that tests should catch

**Enables you to**
- Increase coverage *without* false confidence
- Generate tests that fail meaningfully when behavior is wrong
- Use AI to uncover edge cases you didn't think of

### [AI-Assisted Technical Writing](./03-ai-assisted-development/technical-writing.md)

**Topics**
- RFCs/ADRs and tradeoff capture
- API docs, runbooks, release notes
- Spec → checklist → tests workflows
- Operational constraints and "safe usage" guidance in docs

**Enables you to**
- Produce clear docs faster without losing accuracy
- Convert design intent into actionable checklists and tests
- Improve operational readiness (runbooks, incident response steps)

### [Code Review and Governance Practices](./03-ai-assisted-development/code-review-governance.md)

**Topics**
- Rubric-driven review prompts (security/correctness/perf/maintainability)
- Standards for accepting AI-generated changes
- Prompt packs and workflow templates as shared team assets
- **Agent steering via repo conventions**
  - Use a standardized agent instruction file (e.g., AGENTS.md) as the repo-level source of truth—this pattern is becoming the de facto standard across tools
  - Use tool-specific config files as shims/redirects to the canonical file when needed
  - What goes in the agent instruction file:
    - repo map and architecture notes
    - build/test commands
    - code style rules
    - "safe areas" vs "danger zones"
    - review checklist + invariants

**Enables you to**
- Make AI usage repeatable across the team (not heroics)
- Reduce review burden by standardizing constraints and verification
- Ensure AI-generated changes are held to the same quality bar


## Shipping AI Features (System Design + Platform)

> Detailed guides: [04-shipping-ai-features/](./04-shipping-ai-features/)

### [Product Patterns and UX for AI Features](./04-shipping-ai-features/product-patterns-ux.md)

**Topics**
- Chat/copilot UX, citations/provenance, revision workflows
- Failure-state UX: "I don't know", partial answers, escalations
- Agent workflows: approvals, audit logs, recoverability
- **Voice modality (intro)**
  - voice UX basics: turn-taking, barge-in, confirmations for risky actions
  - latency targets and why voice is unforgiving

**Enables you to**
- Design internal AI UX that handles uncertainty gracefully
- Make agent actions auditable and reversible
- Decide when voice adds value vs complexity

### [Message Design and Application State](./04-shipping-ai-features/message-design-state.md)

**Topics**
- System/developer/user message separation in production
- Template versioning and change control
- State management: session memory vs durable memory vs user preferences
- Preventing instruction drift and injection via state
- **Memory and persistence**
  - What to store: decisions, user preferences, task context
  - Summarization strategies for long-running conversations
  - When to forget: privacy requirements, staleness, irrelevance
  - Cross-session continuity: patterns for agents that "remember" previous work

**Enables you to**
- Prevent prompt injection via state contamination
- Version prompts and state transitions like APIs
- Build predictable multi-turn behaviors
- Design agents with useful memory without unbounded context growth

### [Output Control and Reliability](./04-shipping-ai-features/output-control.md)

**Topics**
- Structured outputs with schemas + validators + repair loops
- Tool/function calling contracts and invariants
- Streaming + partial parsing + UI implications
- Reproducibility strategies and behavioral regression testing

**Enables you to**
- Make AI outputs parseable and safe to consume
- Reduce flakiness with validation and repair loops
- Test behavior changes like code changes

### [API Integration Patterns and Architecture](./04-shipping-ai-features/api-integration.md)

**Topics**
- Chat vs agentic APIs; tool-based designs
- Latency/cost tradeoffs, caching layers, backpressure
- Idempotency, retries, dedupe; side-effect control
- Sandboxing and constrained tool environments
- **Programmatic tool calling**
  - Pattern: model writes code that orchestrates multiple tools, rather than one tool call per API round-trip
  - Benefits: reduced latency, better control over what enters context
- **MCP in product architecture**
  - using MCP servers as standardized tool/context backends
  - stable schemas, scoped capabilities, safe defaults
  - security: authn/authz, tool scoping, audit logging

**Enables you to**
- Build safe tool-using agents that handle retries and side effects
- Integrate tools without turning the model into a privileged backdoor
- Use MCP where it improves maintainability and interoperability

### [Multi-Agent Systems and Orchestration](./04-shipping-ai-features/multi-agent-orchestration.md)

**Topics**
- When to use single-agent vs multi-agent architectures
  - Single agent: well-scoped tasks, predictable workflows
  - Multi-agent: complex/open-ended problems, specialized sub-tasks, tasks requiring different tool sets
- **Orchestration patterns**
  - Sequential: agents hand off to each other in defined order
  - Parallel: multiple agents work simultaneously, results aggregated
  - Hierarchical: orchestrator agent delegates to specialist agents
  - Maker-checker: one agent proposes, another critiques/validates, iterate
- **Key challenges**
  - Inter-agent communication protocols
  - State management across agent boundaries
  - Conflict resolution when agents disagree
  - Cost/latency multiplication (more agents = more API calls)
- **Governance for multi-agent systems**
  - Clear ownership: which agent is responsible for what
  - Human-in-the-loop checkpoints for high-stakes decisions
  - Audit trails across agent boundaries

**Enables you to**
- Decide when multi-agent complexity is justified
- Design orchestration patterns appropriate to the task
- Maintain observability and control across agent boundaries
- Prevent cascading failures and runaway costs

### [Moderation, Rate Limits, User Reporting, and Policy Enforcement](./04-shipping-ai-features/moderation-policy.md)

**Topics**
- Moderation models and policy layers (pre/post filters, allow/deny lists)
- Rate limits and abuse throttling (per-user, per-tenant, adaptive limits)
- User reporting workflows and feedback loops
- Policy enforcement in UI and backend (refusals, safe alternatives, escalation paths)
- Logging for safety review without exposing sensitive content

**Enables you to**
- Prevent abuse and policy violations at the product boundary
- Build clear user-facing escalation and reporting paths
- Balance safety controls with usable UX

### [Security: Prompt Injection, Tool Abuse, Exfiltration](./04-shipping-ai-features/security.md)

**Topics**
- Direct/indirect injection; confused deputy problems
- **Defense-in-depth approach** (no single-layer defense is sufficient)
  - Input validation and sanitization
  - Prompt isolation techniques (spotlighting, delimiters, structured formats)
  - Output validation and filtering
  - Tool scoping and least privilege
- **Emerging defense patterns**
  - Prompt shields and injection detection models
  - Layered frameworks: input gatekeeping → structured formatting → output validation → adaptive refinement
  - Multimodal injection risks (malicious instructions in images/audio)
- Logging/telemetry exfil pathways and mitigations
- Red-teaming and continuous adversarial testing
- MCP-specific security: treat server/tool surface as privileged

**Enables you to**
- Threat model AI systems like any other input-driven system
- Build layered defenses rather than relying on single controls
- Anticipate emerging attack vectors (multimodal, indirect injection)
- Prevent tool misuse and data leakage

### [Observability and Monitoring for LLM Systems](./04-shipping-ai-features/observability.md)

**Topics**
- End-to-end tracing: request → retrieval → model → tools → response
- Cost monitoring by feature/tenant; budget enforcement
- Quality monitoring: deflection, escalation, feedback taxonomy
- Drift detection (model/corpus/prompt/config)

**Enables you to**
- Debug performance, cost, and quality issues quickly
- Detect drift before users do
- Create operational playbooks for AI incidents

### [Repeatable Evals and CI/CD for AI Behavior](./04-shipping-ai-features/evals-cicd.md)

**Topics**
- Offline eval harnesses and golden conversations
- Online evals: A/B, canary, shadow traffic
- Rubrics + graders; pitfalls of LLM-as-judge
- CI gating: prompts/templates/corpora as release artifacts

**Enables you to**
- Ship behavior changes safely
- Use eval gates to prevent regressions
- Compare models/prompts objectively

### [Retrieval-Augmented Generation (RAG) Systems](./04-shipping-ai-features/rag-systems.md)

**Topics**
- Chunking, indexing, hybrid search, reranking
- Freshness/versioning of corpora; staleness controls
- Authorization-aware retrieval (multi-tenant + per-doc ACLs)
- Groundedness, citation quality, and "unknown" handling
- Corpus structure for retrieval quality:
  - chunkable structure, stable headings, canonical IDs
  - versioned pages and clear deprecation markers

**Enables you to**
- Build grounded systems that cite sources and admit unknowns
- Prevent stale or unauthorized knowledge leakage
- Improve retrieval quality via structure and evaluation

### [Fine-Tuning and Customization Strategy](./04-shipping-ai-features/fine-tuning.md)

**Topics**
- Decision framework: prompt/templates vs RAG vs fine-tune
- Data pipelines, leakage risks, ongoing maintenance burden
- Post-change evaluation and rollback planning
- Open-source fine-tuning considerations vs proprietary constraints

**Enables you to**
- Pick the simplest effective customization method
- Avoid "fine-tune by default"
- Plan for lifecycle: data, evals, monitoring, rollback

### [Model Routing and Cost/Latency Engineering](./04-shipping-ai-features/model-routing.md)

**Topics**
- Task-based routing, dynamic routing signals
- Caching: semantic, retrieval, response
- Fallbacks, degraded modes, timeouts
- Batch/async patterns for expensive operations
- Local-first vs hosted escalation routing:
  - privacy/cost first locally,
  - escalate hard tasks to stronger hosted models

**Enables you to**
- Meet performance targets while controlling spend
- Design robust degraded modes
- Use routing to optimize quality where it matters

### [Deployment, Versioning, and Change Management](./04-shipping-ai-features/deployment-versioning.md)

**Topics**
- Version prompts/templates/tool schemas/eval sets/corpora
- Release playbooks for behavior changes
- Rollback strategies and compatibility management

**Enables you to**
- Treat AI artifacts as first-class release components
- Roll back safely when behavior changes regress
- Maintain compatibility as tools/schemas evolve

### [Voice Interfaces (STT/TTS + Voice-specific challenges)](./04-shipping-ai-features/voice-interfaces.md)

**Topics**
- Voice pipeline: STT → LLM → TTS
- STT basics: accuracy, latency, noise handling, multi-speaker issues
- TTS basics: streaming vs non-streaming, SSML/prosody control
- Voice UX: confirmations, barge-in, error recovery, safe actions

**Enables you to**
- Decide where voice is worth it for internal tools
- Prototype a safe voice assistant workflow
- Design around recognition errors and latency
