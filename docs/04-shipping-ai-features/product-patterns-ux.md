# Product Patterns and UX for AI Features

Designing AI features that handle uncertainty, provide citations, and fail gracefully.

## TL;DR

- AI UX must handle **uncertainty**—design for "I don't know" states
- Provide **citations and provenance** so users can verify AI outputs
- Agent workflows need **approvals, audit logs, and undo** capabilities
- Failure states should be **helpful, not dead ends**
- Voice adds latency constraints and requires confirmation for risky actions

## Core Concepts

### Designing for Uncertainty

AI outputs aren't always correct. Your UX must communicate this.

**Confidence indicators:**

```typescript
interface AIResponse {
  content: string;
  confidence: 'high' | 'medium' | 'low';
  sources?: Source[];
  caveats?: string[];
}

// Render differently based on confidence
function renderResponse(response: AIResponse) {
  return (
    <div className={`response response--${response.confidence}`}>
      <ResponseContent content={response.content} />

      {response.confidence === 'low' && (
        <ConfidenceWarning>
          This answer has low confidence. Consider verifying with other sources.
        </ConfidenceWarning>
      )}

      {response.sources && <SourceList sources={response.sources} />}
    </div>
  );
}
```

**"I don't know" states:**

```typescript
// Instead of making up answers, acknowledge limitations
const refusalPatterns = [
  {
    type: 'out_of_scope',
    message: "I can help with account questions, but I can't provide medical advice.",
    suggestion: 'Would you like me to help you find a healthcare resource?',
  },
  {
    type: 'insufficient_info',
    message: "I don't have enough information to answer that accurately.",
    suggestion: 'Could you provide more details about your situation?',
  },
  {
    type: 'uncertain',
    message: "I'm not confident in my answer to this.",
    suggestion: 'You might want to verify this with official documentation.',
  },
];
```

### Chat and Copilot UX Patterns

**Message threading:**

```typescript
interface Conversation {
  id: string;
  messages: Message[];
  context: ConversationContext;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata: {
    model?: string;
    latencyMs?: number;
    tokenCount?: number;
    sources?: Source[];
    feedback?: 'helpful' | 'not_helpful';
  };
}
```

**Streaming responses:**

```typescript
// Show responses as they generate
function StreamingMessage({ stream }: { stream: AsyncIterable<string> }) {
  const [content, setContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    (async () => {
      for await (const chunk of stream) {
        setContent(prev => prev + chunk);
      }
      setIsComplete(true);
    })();
  }, [stream]);

  return (
    <div className="message message--assistant">
      <ReactMarkdown>{content}</ReactMarkdown>
      {!isComplete && <TypingIndicator />}
    </div>
  );
}
```

**Revision workflows:**

```typescript
// Let users iterate on AI responses
interface RevisionControls {
  regenerate: () => Promise<void>;      // Try again with same prompt
  refine: (feedback: string) => Promise<void>;  // Add clarification
  edit: (editedContent: string) => void;  // User edits directly
  copy: () => void;
  share: () => void;
}
```

### Citations and Provenance

Users need to verify AI claims. Make it easy.

```typescript
interface CitedResponse {
  content: string;
  citations: Citation[];
}

interface Citation {
  id: string;
  text: string;              // The claim being cited
  source: {
    title: string;
    url: string;
    excerpt: string;         // Relevant quote from source
    retrievedAt: Date;
  };
  confidence: number;        // How well source supports claim
}

// Render inline citations
function CitedContent({ response }: { response: CitedResponse }) {
  return (
    <div className="cited-content">
      <ReactMarkdown
        components={{
          // Render [1] as clickable citation links
          a: ({ node, ...props }) => {
            const citationId = props.href?.match(/^#cite-(\d+)$/)?.[1];
            if (citationId) {
              return <CitationLink citation={response.citations[Number(citationId)]} />;
            }
            return <a {...props} />;
          },
        }}
      >
        {response.content}
      </ReactMarkdown>

      <SourcesPanel citations={response.citations} />
    </div>
  );
}
```

### Failure State UX

When AI fails, help users recover.

| Failure Type | User Impact | UX Response |
|--------------|-------------|-------------|
| Timeout | Frustration | Show progress, offer retry |
| Rate limit | Blocked | Explain wait, show queue position |
| Content filter | Confusion | Explain why, suggest alternatives |
| Model error | Broken | Apologize, offer fallback |
| Context too long | Truncation | Warn, offer to split |

```typescript
function ErrorState({ error }: { error: AIError }) {
  const errorConfig = {
    timeout: {
      title: 'Taking longer than expected',
      message: 'Complex questions can take time. Want to wait or try a simpler question?',
      actions: [
        { label: 'Keep waiting', action: 'wait' },
        { label: 'Try again', action: 'retry' },
        { label: 'Simplify question', action: 'edit' },
      ],
    },
    rate_limit: {
      title: 'Too many requests',
      message: `Please wait ${error.retryAfter}s before trying again.`,
      actions: [{ label: 'Set reminder', action: 'remind' }],
    },
    content_filter: {
      title: "I can't help with that",
      message: 'This request is outside what I can assist with.',
      actions: [
        { label: 'Rephrase question', action: 'edit' },
        { label: 'Contact support', action: 'support' },
      ],
    },
  };

  const config = errorConfig[error.type];

  return (
    <ErrorCard title={config.title}>
      <p>{config.message}</p>
      <ActionButtons actions={config.actions} />
    </ErrorCard>
  );
}
```

### Agent Workflow UX

When AI takes actions (not just generates text), add controls.

**Approval flows:**

```typescript
interface AgentAction {
  id: string;
  type: 'read' | 'write' | 'execute' | 'send';
  description: string;
  target: string;
  requiresApproval: boolean;
  risk: 'low' | 'medium' | 'high';
}

function ActionApproval({ action, onApprove, onReject }: ActionApprovalProps) {
  return (
    <div className={`action-card action-card--${action.risk}`}>
      <ActionIcon type={action.type} />
      <div className="action-details">
        <p className="action-description">{action.description}</p>
        <code className="action-target">{action.target}</code>
      </div>
      <div className="action-controls">
        <Button variant="danger" onClick={onReject}>Deny</Button>
        <Button variant="primary" onClick={onApprove}>Allow</Button>
      </div>
    </div>
  );
}
```

**Audit logs:**

```typescript
interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AgentAction;
  result: 'approved' | 'rejected' | 'executed' | 'failed';
  user: string;
  metadata: Record<string, unknown>;
}

// Make audit visible to users
function AgentActivityLog({ sessionId }: { sessionId: string }) {
  const entries = useAuditLog(sessionId);

  return (
    <Timeline>
      {entries.map(entry => (
        <TimelineEntry key={entry.id} entry={entry} />
      ))}
    </Timeline>
  );
}
```

**Undo and recovery:**

```typescript
interface UndoableAction {
  action: AgentAction;
  undoFn: () => Promise<void>;
  expiresAt: Date;  // Undo may not always be possible
}

function UndoToast({ undoable }: { undoable: UndoableAction }) {
  const [timeRemaining, setTimeRemaining] = useState(
    undoable.expiresAt.getTime() - Date.now()
  );

  return (
    <Toast>
      <p>Action completed: {undoable.action.description}</p>
      <Button onClick={undoable.undoFn} disabled={timeRemaining <= 0}>
        Undo ({Math.ceil(timeRemaining / 1000)}s)
      </Button>
    </Toast>
  );
}
```

## Voice Modality

Voice adds unique UX constraints.

### Voice-Specific Challenges

| Challenge | Cause | Mitigation |
|-----------|-------|------------|
| Latency intolerance | Users expect immediate response | Stream TTS, use fast models |
| No visual fallback | Can't show "loading" | Audio cues, filler phrases |
| Recognition errors | STT isn't perfect | Confirm before risky actions |
| Context loss | Users forget what was said | Summaries, written follow-up |

### Voice UX Patterns

```typescript
// Confirmations for risky actions
const voiceConfirmation = {
  prompt: "I'll send that email to your entire team. Should I go ahead?",
  acceptPhrases: ['yes', 'go ahead', 'send it', 'confirm'],
  rejectPhrases: ['no', 'cancel', 'stop', 'wait'],
  timeout: 5000,  // Auto-cancel if no response
};

// Turn-taking signals
const turnTakingCues = {
  listeningStart: { sound: 'ding.mp3', visual: 'pulse' },
  processing: { sound: null, visual: 'thinking' },
  speakingStart: { sound: null, visual: 'speaking' },
  finished: { sound: 'done.mp3', visual: 'idle' },
};

// Barge-in handling
interface BargeInConfig {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  onBargeIn: 'stop' | 'pause' | 'continue';
}
```

### Latency Targets

| Component | Target | Acceptable | Poor |
|-----------|--------|------------|------|
| STT (speech-to-text) | <300ms | <500ms | >1s |
| LLM response start | <500ms | <1s | >2s |
| TTS start | <200ms | <400ms | >800ms |
| **Total** | <1s | <2s | >3s |

## Common Pitfalls

- **Hiding AI uncertainty.** Users need to know when to verify.
- **No fallback for failures.** Plan for every failure mode.
- **Irreversible agent actions.** Always provide undo when possible.
- **Ignoring voice latency.** Voice UX dies at 2+ second latency.

## Related

- [Output Control](./output-control.md) — Structured responses
- [Voice Interfaces](./voice-interfaces.md) — Deep dive on voice

## Next

- [Message Design and Application State](./message-design-state.md)
