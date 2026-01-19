'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ConversationManager,
  type Conversation,
  type Message,
  type MemoryConfig,
} from '@/lib/memory';

/**
 * Conversation Memory Demo
 *
 * See how different memory strategies handle context limits.
 *
 * REQUIRES: llama-server running on port 8033
 */

export default function ConversationMemoryPage() {
  const [config, setConfig] = useState<MemoryConfig>({
    maxTokens: 500,          // Deliberately small to show pruning
    reserveForOutput: 100,
    strategy: 'sliding-window',
  });

  const [manager] = useState(() => new ConversationManager(config));
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Create new conversation
  const startNewConversation = useCallback(() => {
    const conv = manager.createConversation('You are a helpful assistant.');
    setActiveConversation(conv);
  }, [manager]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!activeConversation || !input.trim()) return;

    setIsLoading(true);

    // Add user message
    manager.addMessage(activeConversation.id, 'user', input);
    setInput('');

    // Get context window (pruned if necessary)
    const contextMessages = manager.getContextWindow(activeConversation.id);

    try {
      const res = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: contextMessages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: config.reserveForOutput,
        }),
      });

      const data = await res.json();
      const assistantContent = data.choices?.[0]?.message?.content ?? 'No response';

      manager.addMessage(activeConversation.id, 'assistant', assistantContent);
    } catch (e) {
      manager.addMessage(activeConversation.id, 'assistant', `Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    // Refresh conversation
    setActiveConversation(manager.getConversation(activeConversation.id) ?? null);
    setIsLoading(false);
  }, [activeConversation, input, manager, config.reserveForOutput]);

  const stats = useMemo(() => {
    if (!activeConversation) return null;
    try {
      return manager.getStats(activeConversation.id);
    } catch {
      return null;
    }
  }, [activeConversation, manager]);

  const contextWindow = useMemo(() => {
    if (!activeConversation) return [];
    return manager.getContextWindow(activeConversation.id);
  }, [activeConversation, manager]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 05: Conversation Memory</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/memory.ts</code> - context windows, pruning strategies.
        </p>
      </header>

      {/* Config */}
      <section className="bg-gray-800 p-4 rounded-lg space-y-4">
        <h2 className="text-lg font-semibold">Memory Configuration</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Tokens</label>
            <input
              type="number"
              value={config.maxTokens}
              onChange={(e) => setConfig({ ...config, maxTokens: Number(e.target.value) })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-1 w-24"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Reserve for Output</label>
            <input
              type="number"
              value={config.reserveForOutput}
              onChange={(e) => setConfig({ ...config, reserveForOutput: Number(e.target.value) })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-1 w-24"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Strategy</label>
            <select
              value={config.strategy}
              onChange={(e) => setConfig({ ...config, strategy: e.target.value as MemoryConfig['strategy'] })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-1"
            >
              <option value="sliding-window">Sliding Window</option>
              <option value="importance">Importance-based</option>
              <option value="summarize">Summarization</option>
            </select>
          </div>
        </div>
        <button
          onClick={startNewConversation}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
        >
          Start New Conversation
        </button>
      </section>

      {activeConversation && (
        <>
          {/* Stats */}
          {stats && (
            <section className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">Memory Stats</h2>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
                <StatBox label="Total Messages" value={stats.totalMessages} />
                <StatBox label="In Context" value={stats.contextMessages} />
                <StatBox label="Dropped" value={stats.droppedMessages} warning={stats.droppedMessages > 0} />
                <StatBox label="Total Tokens" value={stats.totalTokens} />
                <StatBox label="Context Tokens" value={stats.contextTokens} />
                <StatBox label="Used" value={`${stats.percentUsed.toFixed(1)}%`} />
              </div>
              <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${stats.percentUsed > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(stats.percentUsed, 100)}%` }}
                />
              </div>
            </section>
          )}

          {/* Conversation */}
          <section className="grid md:grid-cols-2 gap-4">
            {/* Full History */}
            <div>
              <h2 className="text-lg font-semibold mb-2">
                Full History ({activeConversation.messages.length} messages)
              </h2>
              <div className="h-96 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
                {activeConversation.messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    inContext={contextWindow.some(m => m.id === msg.id)}
                  />
                ))}
              </div>
            </div>

            {/* Context Window */}
            <div>
              <h2 className="text-lg font-semibold mb-2">
                Context Window ({contextWindow.length} messages)
              </h2>
              <div className="h-96 overflow-y-auto bg-green-900/20 border border-green-700 rounded-lg p-4 space-y-2">
                {contextWindow.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} inContext={true} />
                ))}
              </div>
            </div>
          </section>

          {/* Input */}
          <section className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </section>
        </>
      )}

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/memory.ts</code> - Memory strategies, ConversationManager
          </li>
          <li>
            <code className="text-blue-400">lib/memory.test.ts</code> - Tests for pruning and management
          </li>
        </ul>
      </section>
    </main>
  );
}

// =============================================================================
// Components
// =============================================================================

function StatBox({ label, value, warning = false }: { label: string; value: string | number; warning?: boolean }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className={`font-mono ${warning ? 'text-yellow-400' : ''}`}>{value}</p>
    </div>
  );
}

function MessageBubble({ message, inContext }: { message: Message; inContext: boolean }) {
  const colors = {
    system: 'bg-purple-900/30 border-purple-700',
    user: 'bg-blue-900/30 border-blue-700',
    assistant: 'bg-gray-700/50 border-gray-600',
  };

  return (
    <div className={`p-2 rounded border ${colors[message.role]} ${!inContext ? 'opacity-40' : ''}`}>
      <p className="text-xs text-gray-400 mb-1">{message.role}</p>
      <p className="text-sm">{message.content.slice(0, 200)}{message.content.length > 200 ? '...' : ''}</p>
    </div>
  );
}
