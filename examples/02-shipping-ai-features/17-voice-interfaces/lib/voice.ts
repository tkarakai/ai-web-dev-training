/**
 * Voice interface utilities
 * - STT/TTS pipeline
 * - Latency optimization
 * - Turn-taking state machine
 * - Confirmation patterns
 * - Error recovery
 */

import { generateId } from '@examples/shared/lib/utils';

// Types
export type VoiceStateType = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface VoiceState {
  type: VoiceStateType;
  transcript?: string;
  response?: string;
  error?: string;
  startTime?: number;
}

export interface PipelineTimings {
  vadLatency: number;
  sttLatency: number;
  llmTTFT: number;
  llmComplete: number;
  ttsLatency: number;
  totalLatency: number;
}

export interface TranscriptResult {
  text: string;
  confidence: number;
  alternatives?: string[];
}

export interface VoiceResponse {
  id: string;
  transcript: TranscriptResult;
  response: string;
  timings: PipelineTimings;
  timestamp: Date;
}

export interface STTProvider {
  name: string;
  latency: string;
  accuracy: string;
  cost: string;
  bestFor: string;
  streaming: boolean;
}

export interface TTSProvider {
  name: string;
  latency: string;
  quality: string;
  streaming: boolean;
  bestFor: string;
}

export interface RiskyAction {
  id: string;
  action: string;
  description: string;
  confirmationPrompt: string;
  acceptPhrases: string[];
  rejectPhrases: string[];
}

export interface VoiceSession {
  id: string;
  state: VoiceState;
  history: VoiceResponse[];
  startTime: Date;
  totalTurns: number;
  avgLatency: number;
}

export interface LatencyOptimization {
  name: string;
  description: string;
  savings: string;
  enabled: boolean;
  impact: 'high' | 'medium' | 'low';
}

export interface VoiceError {
  type: 'low_confidence' | 'silence' | 'timeout' | 'system';
  message: string;
  recovery: string;
}

// STT Provider options
export const sttProviders: STTProvider[] = [
  {
    name: 'Deepgram',
    latency: '~200ms',
    accuracy: 'Excellent',
    cost: '$0.0043/min',
    bestFor: 'Real-time, streaming',
    streaming: true,
  },
  {
    name: 'OpenAI Whisper API',
    latency: '~500ms',
    accuracy: 'Excellent',
    cost: '$0.006/min',
    bestFor: 'Batch processing, accuracy',
    streaming: false,
  },
  {
    name: 'AssemblyAI',
    latency: '~300ms',
    accuracy: 'Excellent',
    cost: '$0.015/min',
    bestFor: 'Features (diarization)',
    streaming: true,
  },
  {
    name: 'Whisper (self-hosted)',
    latency: 'Varies',
    accuracy: 'Excellent',
    cost: 'Compute cost',
    bestFor: 'Privacy, control',
    streaming: false,
  },
];

// TTS Provider options
export const ttsProviders: TTSProvider[] = [
  {
    name: 'ElevenLabs',
    latency: '~200ms',
    quality: 'Excellent',
    streaming: true,
    bestFor: 'Natural voices',
  },
  {
    name: 'OpenAI TTS',
    latency: '~300ms',
    quality: 'Very Good',
    streaming: true,
    bestFor: 'Simple integration',
  },
  {
    name: 'Play.ht',
    latency: '~250ms',
    quality: 'Excellent',
    streaming: true,
    bestFor: 'Voice cloning',
  },
  {
    name: 'Amazon Polly',
    latency: '~150ms',
    quality: 'Good',
    streaming: true,
    bestFor: 'AWS integration, cost',
  },
];

// Latency optimizations
export const latencyOptimizations: LatencyOptimization[] = [
  {
    name: 'Stream LLM to TTS',
    description: 'Start TTS before LLM completes by streaming sentences',
    savings: '-300-500ms',
    enabled: true,
    impact: 'high',
  },
  {
    name: 'Prefetch common responses',
    description: 'Cache audio for frequent responses like greetings',
    savings: '-100-200ms',
    enabled: true,
    impact: 'medium',
  },
  {
    name: 'Adaptive model selection',
    description: 'Use faster models for simple queries',
    savings: '-200-400ms',
    enabled: false,
    impact: 'high',
  },
  {
    name: 'Audio compression (Opus)',
    description: 'Compress audio for faster transmission',
    savings: '-50-100ms',
    enabled: true,
    impact: 'low',
  },
  {
    name: 'Edge deployment',
    description: 'Run STT/TTS closer to users',
    savings: '-100-300ms',
    enabled: false,
    impact: 'medium',
  },
];

// Risky actions requiring confirmation
export const riskyActions: RiskyAction[] = [
  {
    id: 'send-email',
    action: 'send_email',
    description: 'Send email to recipients',
    confirmationPrompt: "I'll send that email to {recipients}. Should I go ahead?",
    acceptPhrases: ['yes', 'send it', 'go ahead', 'confirm'],
    rejectPhrases: ['no', 'cancel', 'stop', 'wait'],
  },
  {
    id: 'delete-item',
    action: 'delete_item',
    description: 'Delete item permanently',
    confirmationPrompt: 'This will permanently delete {item}. Are you sure?',
    acceptPhrases: ['yes', 'delete it', 'confirm'],
    rejectPhrases: ['no', 'cancel', 'keep it'],
  },
  {
    id: 'transfer-money',
    action: 'transfer_money',
    description: 'Transfer funds',
    confirmationPrompt: "I'll transfer ${amount} to {recipient}. Please confirm.",
    acceptPhrases: ['yes', 'confirm', 'transfer it', 'approved'],
    rejectPhrases: ['no', 'cancel', 'stop', 'wait'],
  },
  {
    id: 'cancel-order',
    action: 'cancel_order',
    description: 'Cancel an order',
    confirmationPrompt: 'This will cancel order #{orderId}. Continue?',
    acceptPhrases: ['yes', 'cancel it', 'confirm'],
    rejectPhrases: ['no', 'keep it', 'wait'],
  },
];

// Voice use case fit
export const voiceUseCases = {
  goodFit: [
    { use: 'Hands-free scenarios', example: 'Cooking, driving, exercising' },
    { use: 'Quick commands', example: 'Set timer, play music, toggle lights' },
    { use: 'Accessibility', example: 'Vision impairment, motor limitations' },
    { use: 'Mobile/wearables', example: 'Smart watches, AR glasses' },
    { use: 'Simple queries', example: 'Weather, time, quick facts' },
  ],
  poorFit: [
    { use: 'Complex data entry', example: 'Filling forms, spreadsheets' },
    { use: 'Sensitive information', example: 'Passwords, SSN, health data' },
    { use: 'Noisy environments', example: 'Crowded spaces, construction' },
    { use: 'Long-form content', example: 'Writing documents, code' },
    { use: 'Precise editing', example: 'Photo editing, code debugging' },
  ],
};

// Simulate STT transcription
export async function simulateSTT(
  duration: number = 2000
): Promise<TranscriptResult> {
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

  const sampleTranscripts = [
    { text: 'What is the weather like today?', confidence: 0.95 },
    { text: 'Set a reminder for 3 PM', confidence: 0.92 },
    { text: 'Send an email to John', confidence: 0.88 },
    { text: 'Play some relaxing music', confidence: 0.97 },
    { text: 'Turn off the lights', confidence: 0.94 },
    { text: 'What time is my next meeting?', confidence: 0.91 },
    { text: 'Cancel my order', confidence: 0.85 },
    { text: 'Transfer fifty dollars to Sarah', confidence: 0.78 },
  ];

  const selected = sampleTranscripts[Math.floor(Math.random() * sampleTranscripts.length)];

  return {
    ...selected,
    alternatives: [
      selected.text,
      selected.text.replace(/\?$/, ''),
    ],
  };
}

// Simulate LLM response generation
export async function simulateLLM(
  transcript: string,
  onToken?: (token: string) => void
): Promise<{ text: string; ttft: number; complete: number }> {
  const ttft = 200 + Math.random() * 400;
  await new Promise(resolve => setTimeout(resolve, ttft));

  const responses: Record<string, string> = {
    weather: "It's currently 72 degrees and sunny. Perfect weather for a walk!",
    reminder: "I've set a reminder for 3 PM. I'll notify you when it's time.",
    email: "I can help you send an email to John. What would you like to say?",
    music: 'Playing relaxing music for you now. Enjoy!',
    lights: 'Done! The lights are now off.',
    meeting: 'Your next meeting is at 2:30 PM with the design team.',
    cancel: 'I can help you cancel that order. Which order would you like to cancel?',
    transfer: "I'll help you transfer $50 to Sarah. Please confirm to proceed.",
  };

  let response = "I'm not sure how to help with that. Could you try again?";
  for (const [key, value] of Object.entries(responses)) {
    if (transcript.toLowerCase().includes(key)) {
      response = value;
      break;
    }
  }

  // Simulate streaming tokens
  if (onToken) {
    const words = response.split(' ');
    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
      onToken(word + ' ');
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
  }

  return {
    text: response,
    ttft,
    complete: ttft + 300 + Math.random() * 500,
  };
}

// Simulate TTS synthesis
export async function simulateTTS(text: string): Promise<number> {
  const latency = 100 + Math.random() * 200;
  await new Promise(resolve => setTimeout(resolve, latency));
  return latency;
}

// Full voice pipeline simulation
export async function processVoiceInput(
  onStateChange: (state: VoiceState) => void,
  onTimingUpdate: (timings: Partial<PipelineTimings>) => void
): Promise<VoiceResponse> {
  const timings: Partial<PipelineTimings> = {};
  const start = performance.now();

  // VAD
  timings.vadLatency = 50 + Math.random() * 50;
  await new Promise(resolve => setTimeout(resolve, timings.vadLatency));

  // STT
  onStateChange({ type: 'listening', startTime: Date.now() });
  const sttStart = performance.now();
  const transcript = await simulateSTT();
  timings.sttLatency = performance.now() - sttStart;
  onTimingUpdate({ ...timings });

  // LLM
  onStateChange({ type: 'processing', transcript: transcript.text });
  const llmStart = performance.now();
  const llmResponse = await simulateLLM(transcript.text);
  timings.llmTTFT = llmResponse.ttft;
  timings.llmComplete = performance.now() - llmStart;
  onTimingUpdate({ ...timings });

  // TTS
  onStateChange({ type: 'speaking', response: llmResponse.text });
  timings.ttsLatency = await simulateTTS(llmResponse.text);
  timings.totalLatency = performance.now() - start;
  onTimingUpdate({ ...timings });

  // Complete
  await new Promise(resolve => setTimeout(resolve, 500));
  onStateChange({ type: 'idle' });

  return {
    id: generateId('voice'),
    transcript,
    response: llmResponse.text,
    timings: timings as PipelineTimings,
    timestamp: new Date(),
  };
}

// Get confidence level
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

// Get voice error and recovery
export function getVoiceError(
  type: VoiceError['type'],
  confidence?: number
): VoiceError {
  switch (type) {
    case 'low_confidence':
      if (confidence && confidence < 0.3) {
        return {
          type: 'low_confidence',
          message: "I didn't understand that",
          recovery: "I'm sorry, I didn't understand that. Could you say it again?",
        };
      }
      return {
        type: 'low_confidence',
        message: 'Uncertain transcription',
        recovery: 'I heard "{transcript}". Is that correct?',
      };
    case 'silence':
      return {
        type: 'silence',
        message: 'No speech detected',
        recovery: "I didn't hear anything. Are you still there?",
      };
    case 'timeout':
      return {
        type: 'timeout',
        message: 'Response timeout',
        recovery: 'Sorry, I took too long to respond. Please try again.',
      };
    case 'system':
      return {
        type: 'system',
        message: 'System error',
        recovery: "I'm having trouble right now. Please try again in a moment.",
      };
  }
}

// Latency thresholds
export const latencyThresholds = {
  excellent: 1000,
  good: 1500,
  acceptable: 2000,
  poor: 3000,
};

// Get latency rating
export function getLatencyRating(
  totalLatency: number
): 'excellent' | 'good' | 'acceptable' | 'poor' {
  if (totalLatency <= latencyThresholds.excellent) return 'excellent';
  if (totalLatency <= latencyThresholds.good) return 'good';
  if (totalLatency <= latencyThresholds.acceptable) return 'acceptable';
  return 'poor';
}

// State colors
export const stateColors: Record<VoiceStateType, string> = {
  idle: 'bg-gray-100 text-gray-600',
  listening: 'bg-blue-100 text-blue-600',
  processing: 'bg-yellow-100 text-yellow-600',
  speaking: 'bg-green-100 text-green-600',
  error: 'bg-red-100 text-red-600',
};

export const confidenceColors: Record<ConfidenceLevel, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-red-100 text-red-700',
};

export const latencyColors: Record<string, string> = {
  excellent: 'text-green-600',
  good: 'text-blue-600',
  acceptable: 'text-yellow-600',
  poor: 'text-red-600',
};

export const impactColors: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-700',
};
