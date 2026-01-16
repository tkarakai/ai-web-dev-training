# Shipping AI Features

This section covers building production AI features into your applications. It assumes you're responsible for shipping AI-powered product capabilities, not just using AI as a development tool.

## Topics

| File | Description |
|------|-------------|
| [Product Patterns and UX](./product-patterns-ux.md) | Chat UX, failure states, agent workflows, and voice modality |
| [Message Design and Application State](./message-design-state.md) | System/user message separation, memory, and persistence |
| [Output Control and Reliability](./output-control.md) | Structured outputs, validators, streaming, and reproducibility |
| [API Integration Patterns](./api-integration.md) | Agentic APIs, caching, idempotency, and MCP in production |
| [Native Thinking Models](./thinking-models.md) | Reasoning models, extended thinking, and when to use them |
| [Multi-Agent Systems and Orchestration](./multi-agent-orchestration.md) | When to use multiple agents, orchestration patterns, and governance |
| [Operational Guardrails](./guardrails.md) | Data classification, secure handling, when to avoid AI, safe defaults |
| [Evals Basics](./evals-basics.md) | Success criteria, eval sets, baselines, diffs, and human review gates |
| [Moderation and Policy Enforcement](./moderation-policy.md) | Content filtering, rate limits, user reporting, and abuse prevention |
| [Security](./security.md) | Prompt injection, tool abuse, defense-in-depth, and red-teaming |
| [Observability and Monitoring](./observability.md) | Tracing, cost monitoring, quality metrics, and drift detection |
| [Evals and CI/CD for AI](./evals-cicd.md) | Offline evals, online testing, rubrics, and CI gating |
| [RAG Systems](./rag-systems.md) | Chunking, indexing, retrieval, authorization, and groundedness |
| [Fine-Tuning Strategy](./fine-tuning.md) | When to fine-tune, data pipelines, and lifecycle management |
| [Model Routing and Cost Engineering](./model-routing.md) | Task routing, caching, fallbacks, and local-first patterns |
| [Deployment and Versioning](./deployment-versioning.md) | Versioning prompts, release playbooks, and rollback strategies |
| [Voice Interfaces](./voice-interfaces.md) | STT/TTS pipelines, latency, and voice-specific UX |

## Prerequisites

Complete [Core Concepts](../01-core-concepts/README.md) and [Governance](../02-governance/README.md). [AI-Assisted Development](../03-ai-assisted-development/README.md) is recommended but not required.

## Reading Order

The order depends on what you're building:

**Starting a new AI feature?**
1. Product Patterns and UX
2. Message Design and Application State
3. API Integration Patterns
4. Security
5. Observability

**Adding RAG to an existing app?**
1. RAG Systems
2. Output Control and Reliability
3. Evals and CI/CD

**Building an agent?**
1. Multi-Agent Systems (or API Integration for single-agent)
2. Security
3. Observability
4. Moderation and Policy
