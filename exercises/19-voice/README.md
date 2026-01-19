# Exercise 19: Voice Interfaces

Build speech-to-text and text-to-speech interfaces using the Web Speech API.

## What You'll Learn

1. **Speech Recognition (STT)** - Convert voice to text
2. **Speech Synthesis (TTS)** - Convert text to voice
3. **Voice Commands** - Parse and execute voice commands
4. **Voice Assistant** - Complete STT -> LLM -> TTS pipeline

## Prerequisites

**Modern browser required** (Chrome, Edge, Safari recommended).

For the full voice assistant pipeline:
```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/voice.ts       <- THE MAIN FILE - STT, TTS, command parsing
lib/voice.test.ts  <- Unit tests
```

## Key Concepts

### 1. Speech Recognition (STT)

```typescript
// Check support
const supported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

// Create recognition instance
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

// Configure
recognition.continuous = true;        // Keep listening
recognition.interimResults = true;    // Show partial results
recognition.lang = 'en-US';

// Handle results
recognition.onresult = (event) => {
  const result = event.results[event.results.length - 1];
  const transcript = result[0].transcript;
  const confidence = result[0].confidence;
  const isFinal = result.isFinal;
};

// Start/stop
recognition.start();
recognition.stop();
```

### 2. Speech Synthesis (TTS)

```typescript
// Check support
const supported = 'speechSynthesis' in window;

// Get available voices
const voices = speechSynthesis.getVoices();

// Create utterance
const utterance = new SpeechSynthesisUtterance('Hello, world!');
utterance.voice = voices[0];
utterance.rate = 1;     // 0.1 - 10
utterance.pitch = 1;    // 0 - 2
utterance.volume = 1;   // 0 - 1

// Speak
speechSynthesis.speak(utterance);

// Control
speechSynthesis.pause();
speechSynthesis.resume();
speechSynthesis.cancel();
```

### 3. Voice Command Parser

```typescript
const COMMANDS: CommandPattern[] = [
  {
    intent: 'search',
    patterns: [/search (?:for )?(.+)/, /find (.+)/],
    entities: ['query'],
  },
  {
    intent: 'timer',
    patterns: [/set (?:a )?timer (?:for )?(\d+) (minutes?|seconds?)/],
    entities: ['duration', 'unit'],
  },
];

const result = parseVoiceCommand('search for TypeScript', COMMANDS);
// { intent: 'search', entities: { query: 'typescript' }, raw: '...' }
```

### 4. Voice Assistant Pipeline

```typescript
// 1. Listen for speech
const transcript = await recognizeSpeech();

// 2. Process with LLM
const response = await processVoiceCommand(transcript, {
  llmBaseUrl: 'http://127.0.0.1:8033',
  systemPrompt: 'You are a helpful voice assistant.',
});

// 3. Speak the response
await speak(response, {
  rate: 1,
  pitch: 1,
  voice: 'Samantha',
});
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

Open http://localhost:3019 in a modern browser.

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Speech Recognition | Yes | No* | Yes | Yes |
| Speech Synthesis | Yes | Yes | Yes | Yes |

*Firefox requires flags or extensions for Speech Recognition.

## Code Patterns

### Creating a Voice Assistant React Hook

```typescript
function useVoiceAssistant(config: VoiceAssistantConfig) {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    error: null,
  });

  const recognition = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    recognition.current = new SpeechRecognition();
    recognition.current.continuous = true;
    recognition.current.interimResults = true;

    recognition.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setState(s => ({ ...s, transcript }));
    };

    recognition.current.start();
    setState(s => ({ ...s, isListening: true }));
  }, []);

  const stopListening = useCallback(() => {
    recognition.current?.stop();
    setState(s => ({ ...s, isListening: false }));
  }, []);

  const speak = useCallback((text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setState(s => ({ ...s, isSpeaking: true }));
    utterance.onend = () => setState(s => ({ ...s, isSpeaking: false }));
    speechSynthesis.speak(utterance);
  }, []);

  return { state, startListening, stopListening, speak };
}
```

### Audio Feedback

```typescript
function playBeep(frequency = 440, duration = 200) {
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  gainNode.gain.value = 0.1;

  oscillator.start();
  setTimeout(() => {
    oscillator.stop();
    audioContext.close();
  }, duration);
}

// Use for listening indicators
playBeep(880, 100);  // High beep = start listening
playBeep(440, 100);  // Low beep = stop listening
```

### Handling Long Responses

```typescript
function splitIntoChunks(text: string, maxLength = 200): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length <= maxLength) {
      current += sentence;
    } else {
      if (current) chunks.push(current.trim());
      current = sentence;
    }
  }
  if (current) chunks.push(current.trim());

  return chunks;
}

// Speak long text in chunks
async function speakLongText(text: string) {
  const chunks = splitIntoChunks(text);
  for (const chunk of chunks) {
    await speak(chunk);
  }
}
```

## Exercises to Try

1. **Wake word detection** - Listen for "Hey Assistant" to activate
2. **Multi-language support** - Detect language and respond accordingly
3. **Conversation context** - Maintain multi-turn conversation state
4. **Custom commands** - Add your own command patterns
5. **Voice activity detection** - Auto-stop when user stops speaking

## Common Issues

### Recognition not starting
- Ensure HTTPS (required in some browsers)
- Check microphone permissions
- Try Chrome or Edge

### No voices available
- Wait for `voiceschanged` event
- Some browsers load voices asynchronously

### Recognition stops unexpectedly
- Set `continuous = true`
- Handle `onend` and restart if needed

## Voice UX Best Practices

1. **Provide feedback** - Show listening state, play sounds
2. **Handle errors gracefully** - Retry, offer alternatives
3. **Confirm actions** - "Did you mean..." for ambiguous commands
4. **Keep responses short** - Voice is linear, don't overwhelm
5. **Support keyboard fallback** - Not everyone can use voice

## Congratulations!

You've completed all 19 exercises! You now have a solid foundation for building AI-powered applications with:

- Token economics and prompt engineering
- Streaming and memory management
- Tool calling and structured outputs
- Resilience and production patterns
- Safety, moderation, and security
- Observability and evaluation
- RAG, routing, and fine-tuning
- Voice interfaces

Happy building!
