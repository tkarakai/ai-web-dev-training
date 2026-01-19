'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
}

interface Voice {
  name: string;
  lang: string;
  default: boolean;
}

export default function VoicePage() {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    interimTranscript: '',
    error: null,
  });

  const [supported, setSupported] = useState({ stt: false, tts: false });
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [ttsText, setTtsText] = useState('Hello! I am a voice assistant. How can I help you today?');
  const [ttsConfig, setTtsConfig] = useState({ rate: 1, pitch: 1, volume: 1 });

  const [llmUrl, setLlmUrl] = useState('http://127.0.0.1:8033');
  const [llmResponse, setLlmResponse] = useState('');
  const [processing, setProcessing] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check browser support
  useEffect(() => {
    const stt = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const tts = 'speechSynthesis' in window;
    setSupported({ stt, tts });

    if (tts) {
      const loadVoices = () => {
        const v = speechSynthesis.getVoices();
        setVoices(v.map((voice) => ({
          name: voice.name,
          lang: voice.lang,
          default: voice.default,
        })));
        if (v.length > 0 && !selectedVoice) {
          const defaultVoice = v.find((voice) => voice.default) || v[0];
          setSelectedVoice(defaultVoice.name);
        }
      };

      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice]);

  // Start listening
  const startListening = useCallback(() => {
    if (!supported.stt) return;

    const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState((s) => ({ ...s, isListening: true, error: null }));
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setState((s) => ({
        ...s,
        transcript: s.transcript + final,
        interimTranscript: interim,
      }));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setState((s) => ({ ...s, error: event.error, isListening: false }));
    };

    recognition.onend = () => {
      setState((s) => ({ ...s, isListening: false }));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported.stt]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setState((s) => ({ ...s, isListening: false, interimTranscript: '' }));
  }, []);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setState((s) => ({ ...s, transcript: '', interimTranscript: '' }));
    setLlmResponse('');
  }, []);

  // Speak text
  const speak = useCallback((text: string) => {
    if (!supported.tts) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = ttsConfig.rate;
    utterance.pitch = ttsConfig.pitch;
    utterance.volume = ttsConfig.volume;

    const voice = speechSynthesis.getVoices().find((v) => v.name === selectedVoice);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setState((s) => ({ ...s, isSpeaking: true }));
    utterance.onend = () => setState((s) => ({ ...s, isSpeaking: false }));
    utterance.onerror = () => setState((s) => ({ ...s, isSpeaking: false }));

    speechSynthesis.speak(utterance);
  }, [supported.tts, selectedVoice, ttsConfig]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel();
    setState((s) => ({ ...s, isSpeaking: false }));
  }, []);

  // Process with LLM
  const processWithLLM = useCallback(async () => {
    if (!state.transcript.trim()) return;

    setProcessing(true);
    setLlmResponse('');

    try {
      const res = await fetch(`${llmUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful voice assistant. Keep responses concise and conversational.' },
            { role: 'user', content: state.transcript },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      if (!res.ok) throw new Error(`LLM request failed: ${res.statusText}`);

      const data = await res.json();
      const response = data.choices?.[0]?.message?.content || 'No response';
      setLlmResponse(response);

      // Speak the response
      speak(response);
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'LLM request failed',
      }));
    } finally {
      setProcessing(false);
    }
  }, [state.transcript, llmUrl, speak]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Exercise 19: Voice Interfaces</h1>
        <p className="text-gray-400 mb-8">
          Build speech-to-text and text-to-speech interfaces using Web Speech API
        </p>

        {/* Browser Support */}
        <div className="flex gap-4 mb-6">
          <div className={`px-4 py-2 rounded-lg ${supported.stt ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
            STT: {supported.stt ? 'Supported' : 'Not Supported'}
          </div>
          <div className={`px-4 py-2 rounded-lg ${supported.tts ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
            TTS: {supported.tts ? 'Supported' : 'Not Supported'}
          </div>
        </div>

        {state.error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            Error: {state.error}
          </div>
        )}

        {/* Speech Recognition */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Speech Recognition (STT)</h2>

          <div className="flex gap-4 mb-4">
            <button
              onClick={state.isListening ? stopListening : startListening}
              disabled={!supported.stt}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                state.isListening
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {state.isListening ? 'Stop Listening' : 'Start Listening'}
            </button>
            <button
              onClick={clearTranscript}
              className="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600"
            >
              Clear
            </button>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 min-h-32">
            <p className="text-gray-300">
              {state.transcript}
              <span className="text-gray-500">{state.interimTranscript}</span>
            </p>
            {!state.transcript && !state.interimTranscript && (
              <p className="text-gray-500 italic">
                {state.isListening ? 'Listening...' : 'Click "Start Listening" and speak'}
              </p>
            )}
          </div>
        </div>

        {/* Speech Synthesis */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Speech Synthesis (TTS)</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Voice</label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
              >
                {voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Rate</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={ttsConfig.rate}
                  onChange={(e) => setTtsConfig({ ...ttsConfig, rate: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{ttsConfig.rate}x</span>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Pitch</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={ttsConfig.pitch}
                  onChange={(e) => setTtsConfig({ ...ttsConfig, pitch: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{ttsConfig.pitch}</span>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Volume</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={ttsConfig.volume}
                  onChange={(e) => setTtsConfig({ ...ttsConfig, volume: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{Math.round(ttsConfig.volume * 100)}%</span>
              </div>
            </div>
          </div>

          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            className="w-full h-24 bg-gray-800 border border-gray-700 rounded p-3 mb-4"
            placeholder="Enter text to speak..."
          />

          <div className="flex gap-4">
            <button
              onClick={() => speak(ttsText)}
              disabled={!supported.tts || state.isSpeaking}
              className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {state.isSpeaking ? 'Speaking...' : 'Speak'}
            </button>
            {state.isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Voice Assistant */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Voice Assistant (STT + LLM + TTS)</h2>

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">llama-server URL</label>
            <input
              type="text"
              value={llmUrl}
              onChange={(e) => setLlmUrl(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 font-mono"
            />
          </div>

          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-400 mb-2">Your input:</p>
            <p className="text-gray-300 mb-4">
              {state.transcript || <span className="text-gray-500 italic">Speak something first...</span>}
            </p>

            <button
              onClick={processWithLLM}
              disabled={!state.transcript.trim() || processing}
              className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Send to LLM & Speak Response'}
            </button>
          </div>

          {llmResponse && (
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Assistant response:</p>
              <p className="text-gray-300">{llmResponse}</p>
            </div>
          )}
        </div>

        {/* Code Reference */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Code Patterns</h2>
          <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto">
{`// lib/voice.ts - Key patterns

// Speech Recognition
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
};
recognition.start();

// Speech Synthesis
const utterance = new SpeechSynthesisUtterance('Hello!');
utterance.rate = 1;
utterance.pitch = 1;
speechSynthesis.speak(utterance);

// Voice Command Parser
const result = parseVoiceCommand('search for cats', COMMON_COMMANDS);
// { intent: 'search', entities: { query: 'cats' } }

// Full Pipeline
const transcript = await recognizeSpeech();
const response = await processWithLLM(transcript);
await speak(response);`}
          </pre>
        </div>
      </div>
    </div>
  );
}
