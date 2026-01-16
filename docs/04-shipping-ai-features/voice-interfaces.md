# Voice Interfaces (STT/TTS + Voice-specific Challenges)

Building voice-based AI features with appropriate latency, accuracy, and UX.

## TL;DR

- Voice pipeline: **STT → LLM → TTS**, each with latency and quality trade-offs
- **Latency is critical**: Users expect <1s response; >2s feels broken
- **Recognition errors happen**: Design for misunderstanding, not just understanding
- Confirm before **risky actions**—voice has no "undo click"
- Voice adds complexity; only use where it **genuinely adds value**

## Core Concepts

### Voice Pipeline Architecture

```typescript
interface VoicePipeline {
  stt: STTConfig;        // Speech-to-Text
  llm: LLMConfig;        // Language Model
  tts: TTSConfig;        // Text-to-Speech
  vad?: VADConfig;       // Voice Activity Detection
}

interface PipelineTimings {
  vadLatency: number;     // ~50-100ms
  sttLatency: number;     // ~200-500ms
  llmTTFT: number;        // ~200-800ms (time to first token)
  llmComplete: number;    // ~500-2000ms
  ttsLatency: number;     // ~100-300ms
  totalLatency: number;   // Target: <1500ms
}

async function processVoiceInput(
  audio: AudioBuffer,
  pipeline: VoicePipeline
): Promise<VoiceResponse> {
  const timings: Partial<PipelineTimings> = {};
  const start = performance.now();

  // Step 1: Speech-to-Text
  const sttStart = performance.now();
  const transcript = await pipeline.stt.transcribe(audio);
  timings.sttLatency = performance.now() - sttStart;

  if (!transcript.text || transcript.confidence < 0.5) {
    return {
      type: 'clarification',
      audio: await pipeline.tts.synthesize("I didn't catch that. Could you repeat?"),
      timings,
    };
  }

  // Step 2: LLM processing
  const llmStart = performance.now();
  const response = await pipeline.llm.generate(transcript.text);
  timings.llmComplete = performance.now() - llmStart;

  // Step 3: Text-to-Speech
  const ttsStart = performance.now();
  const audio = await pipeline.tts.synthesize(response.text);
  timings.ttsLatency = performance.now() - ttsStart;

  timings.totalLatency = performance.now() - start;

  return { type: 'response', audio, text: response.text, timings };
}
```

### Speech-to-Text (STT)

**Provider options:**

| Provider | Latency | Accuracy | Cost | Best For |
|----------|---------|----------|------|----------|
| [Deepgram](https://deepgram.com) | ~200ms | Excellent | $0.0043/min | Real-time, streaming |
| [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text) | ~500ms | Excellent | $0.006/min | Batch, accuracy |
| [AssemblyAI](https://www.assemblyai.com) | ~300ms | Excellent | $0.00025/sec | Features (diarization) |
| Whisper (self-hosted) | Varies | Excellent | Compute cost | Privacy, control |

**Streaming STT:**

```typescript
import { DeepgramClient } from '@deepgram/sdk';

const deepgram = new DeepgramClient(process.env.DEEPGRAM_API_KEY);

async function streamingSTT(
  audioStream: ReadableStream
): AsyncGenerator<TranscriptChunk> {
  const connection = deepgram.transcription.live({
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    interim_results: true,  // Get partial results
    endpointing: 300,       // End of speech detection (ms)
  });

  connection.on('transcriptReceived', (data) => {
    const transcript = data.channel.alternatives[0];
    yield {
      text: transcript.transcript,
      isFinal: data.is_final,
      confidence: transcript.confidence,
    };
  });

  // Pipe audio to Deepgram
  for await (const chunk of audioStream) {
    connection.send(chunk);
  }

  connection.finish();
}
```

### Text-to-Speech (TTS)

**Provider options:**

| Provider | Latency | Quality | Streaming | Best For |
|----------|---------|---------|-----------|----------|
| [ElevenLabs](https://elevenlabs.io) | ~200ms | Excellent | Yes | Natural voices |
| [OpenAI TTS](https://platform.openai.com/docs/guides/text-to-speech) | ~300ms | Very good | Yes | Simple integration |
| [Play.ht](https://play.ht) | ~250ms | Excellent | Yes | Voice cloning |
| [Amazon Polly](https://aws.amazon.com/polly/) | ~150ms | Good | Yes | AWS integration, cost |

**Streaming TTS:**

```typescript
async function streamingTTS(
  text: string,
  onChunk: (audio: ArrayBuffer) => void
): Promise<void> {
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2',  // Optimized for low latency
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(value);
  }
}
```

### Latency Optimization

```typescript
interface LatencyOptimizations {
  // Start TTS before LLM completes (stream)
  streamLLMToTTS: boolean;

  // Pre-fetch common responses
  prefetchCommonResponses: boolean;

  // Use faster models for simple queries
  adaptiveModelSelection: boolean;

  // Compress audio for faster transmission
  audioCompression: 'opus' | 'mp3' | 'pcm';
}

// Stream LLM output directly to TTS
async function streamingVoiceResponse(
  input: string,
  outputStream: WritableStream<ArrayBuffer>
): Promise<void> {
  const llmStream = await streamingLLMGenerate(input);
  const sentenceBuffer: string[] = [];

  for await (const chunk of llmStream) {
    sentenceBuffer.push(chunk);
    const text = sentenceBuffer.join('');

    // Check for sentence boundary
    if (/[.!?]\s*$/.test(text)) {
      // Send complete sentence to TTS immediately
      const audio = await tts.synthesize(text);
      outputStream.write(audio);
      sentenceBuffer.length = 0;
    }
  }

  // Flush remaining text
  if (sentenceBuffer.length > 0) {
    const audio = await tts.synthesize(sentenceBuffer.join(''));
    outputStream.write(audio);
  }
}
```

### Voice UX Patterns

**Turn-taking:**

```typescript
interface TurnTakingConfig {
  // How long to wait for user to start speaking
  listenTimeout: number;  // e.g., 5000ms

  // How long of silence indicates turn end
  endpointingDelay: number;  // e.g., 500ms

  // Audio cue when listening starts
  listeningCue: AudioCue;

  // Audio cue when processing
  processingCue: AudioCue;
}

// State machine for turn-taking
type VoiceState =
  | { type: 'idle' }
  | { type: 'listening'; startTime: number }
  | { type: 'processing'; transcript: string }
  | { type: 'speaking'; text: string }
  | { type: 'error'; message: string };

function voiceStateMachine(
  state: VoiceState,
  event: VoiceEvent
): VoiceState {
  switch (state.type) {
    case 'idle':
      if (event.type === 'wake_word' || event.type === 'button_press') {
        return { type: 'listening', startTime: Date.now() };
      }
      break;

    case 'listening':
      if (event.type === 'speech_end') {
        return { type: 'processing', transcript: event.transcript };
      }
      if (event.type === 'timeout') {
        return { type: 'idle' };
      }
      break;

    case 'processing':
      if (event.type === 'response_ready') {
        return { type: 'speaking', text: event.text };
      }
      if (event.type === 'error') {
        return { type: 'error', message: event.message };
      }
      break;

    case 'speaking':
      if (event.type === 'speech_complete') {
        return { type: 'idle' };
      }
      if (event.type === 'barge_in') {
        // User interrupted - stop speaking, start listening
        return { type: 'listening', startTime: Date.now() };
      }
      break;
  }

  return state;
}
```

**Barge-in (interruption handling):**

```typescript
interface BargeInConfig {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  minSpeechDuration: number;  // Avoid false triggers
}

async function handleBargeIn(
  currentSpeech: SpeechOutput,
  config: BargeInConfig
): Promise<void> {
  if (!config.enabled) return;

  // Stop current TTS output
  await currentSpeech.stop();

  // Switch to listening mode
  await transitionToListening();

  // Log for analysis
  analytics.track('barge_in', {
    interruptedAt: currentSpeech.position,
    totalLength: currentSpeech.length,
  });
}
```

**Confirmations for risky actions:**

```typescript
interface RiskyAction {
  action: string;
  description: string;
  requiresConfirmation: boolean;
  confirmationPrompt: string;
  acceptPhrases: string[];
  rejectPhrases: string[];
}

const riskyActions: RiskyAction[] = [
  {
    action: 'send_email',
    description: 'Send email to recipients',
    requiresConfirmation: true,
    confirmationPrompt: "I'll send that email to {recipients}. Should I go ahead?",
    acceptPhrases: ['yes', 'send it', 'go ahead', 'confirm'],
    rejectPhrases: ['no', 'cancel', 'stop', 'wait'],
  },
  {
    action: 'delete_item',
    description: 'Delete item permanently',
    requiresConfirmation: true,
    confirmationPrompt: "This will permanently delete {item}. Are you sure?",
    acceptPhrases: ['yes', 'delete it', 'confirm'],
    rejectPhrases: ['no', 'cancel', 'keep it'],
  },
];

async function executeWithConfirmation(
  action: RiskyAction,
  params: Record<string, string>
): Promise<ActionResult> {
  // Ask for confirmation
  const prompt = interpolate(action.confirmationPrompt, params);
  const confirmationAudio = await tts.synthesize(prompt);
  await playAudio(confirmationAudio);

  // Wait for response
  const response = await listenForResponse({ timeout: 10000 });

  if (action.acceptPhrases.some(p => response.text.toLowerCase().includes(p))) {
    return executeAction(action, params);
  }

  if (action.rejectPhrases.some(p => response.text.toLowerCase().includes(p))) {
    return { status: 'cancelled', message: 'Action cancelled by user' };
  }

  // Unclear response - ask again
  return executeWithConfirmation(action, params);
}
```

### Error Recovery

```typescript
interface VoiceErrorHandling {
  // Recognition errors
  onLowConfidence: (transcript: string, confidence: number) => Promise<void>;

  // No speech detected
  onSilence: () => Promise<void>;

  // System errors
  onSystemError: (error: Error) => Promise<void>;
}

const errorHandlers: VoiceErrorHandling = {
  onLowConfidence: async (transcript, confidence) => {
    if (confidence < 0.3) {
      await speak("I'm sorry, I didn't understand that. Could you say it again?");
    } else {
      // Confirm what we heard
      await speak(`Did you say "${transcript}"?`);
    }
  },

  onSilence: async () => {
    await speak("I didn't hear anything. Are you still there?");
  },

  onSystemError: async (error) => {
    logger.error('Voice system error', { error });
    await speak("I'm having trouble right now. Please try again in a moment.");
  },
};
```

### When to Use Voice

| Good Fit | Poor Fit |
|----------|----------|
| Hands-free scenarios | Complex data entry |
| Quick commands | Sensitive information |
| Accessibility | Noisy environments |
| Mobile/wearables | Long-form content |
| Simple queries | Precise editing |

## Common Pitfalls

- **Ignoring latency.** >2s response time kills voice UX.
- **No confirmation for actions.** "Delete everything" shouldn't just work.
- **Optimizing only for happy path.** Most voice sessions have misunderstandings.
- **Voice where text is better.** Not every feature needs voice.

## Related

- [Product Patterns and UX](./product-patterns-ux.md) — Voice UX basics
- [API Integration](./api-integration.md) — Streaming patterns
- [Latency engineering](./model-routing.md) — Optimizing response time

## Previous

- [Deployment and Versioning](./deployment-versioning.md)
