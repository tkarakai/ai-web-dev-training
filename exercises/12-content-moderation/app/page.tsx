'use client';

import { useState, useCallback } from 'react';

/**
 * Content Moderation Demo
 *
 * Test the content moderation system.
 */

type ModerationCategory =
  | 'hate'
  | 'violence'
  | 'sexual'
  | 'harassment'
  | 'self_harm'
  | 'spam'
  | 'scam'
  | 'illegal'
  | 'clean';

type ModerationAction = 'allow' | 'warn' | 'block' | 'review';

interface ModerationResult {
  action: ModerationAction;
  categories: ModerationCategory[];
  scores: Record<ModerationCategory, number>;
  flags: string[];
  reason?: string;
}

const SAMPLE_TEXTS = [
  'Hello, how are you doing today?',
  'Click here now for free money!!! Act fast!!!',
  'Please send bitcoin to this address immediately',
  'You are such a worthless stupid idiot loser',
  'I have a bomb threat planned for tomorrow',
  'Congratulations you won! Wire transfer to claim your inheritance',
];

export default function ContentModerationPage() {
  const [content, setContent] = useState(SAMPLE_TEXTS[0]);
  const [result, setResult] = useState<ModerationResult | null>(null);
  const [threshold, setThreshold] = useState(0.5);

  const checkContent = useCallback(async () => {
    const { ContentModerator } = await import('@/lib/moderation');
    const moderator = new ContentModerator({
      warnThreshold: threshold,
      blockThreshold: threshold + 0.3,
    });
    const moderationResult = moderator.moderate(content);
    setResult(moderationResult);
  }, [content, threshold]);

  // Auto-check on content change
  useState(() => {
    if (content) {
      checkContent();
    }
  });

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 12: Content Moderation</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/moderation.ts</code> - filter inappropriate
          content.
        </p>
      </header>

      {/* Input */}
      <section className="bg-gray-800 p-6 rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">Test Content</h2>

        <div className="flex flex-wrap gap-2">
          {SAMPLE_TEXTS.map((sample, i) => (
            <button
              key={i}
              onClick={() => setContent(sample)}
              className={`px-3 py-1 text-xs rounded ${
                content === sample ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Sample {i + 1}
            </button>
          ))}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 min-h-[100px]"
          placeholder="Enter content to moderate..."
        />

        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-400">Sensitivity:</label>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.1"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-mono w-12">{threshold.toFixed(1)}</span>
        </div>

        <button
          onClick={checkContent}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
        >
          Check Content
        </button>
      </section>

      {/* Result */}
      {result && (
        <>
          {/* Action Banner */}
          <ActionBanner action={result.action} reason={result.reason} />

          {/* Category Scores */}
          <section className="bg-gray-800 p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-semibold">Category Scores</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {Object.entries(result.scores)
                .filter(([cat]) => cat !== 'clean')
                .map(([category, score]) => (
                  <ScoreBar
                    key={category}
                    category={category as ModerationCategory}
                    score={score}
                  />
                ))}
            </div>
          </section>

          {/* Flags */}
          {result.flags.length > 0 && (
            <section className="bg-gray-800 p-6 rounded-lg space-y-4">
              <h2 className="text-xl font-semibold">Triggered Flags</h2>
              <ul className="space-y-2">
                {result.flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-400">⚠</span>
                    <span className="text-gray-300">{flag}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Moderation Layers */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Moderation Layers</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <LayerCard
            title="Blocklists"
            description="Pattern matching against known bad words and phrases"
            examples={['Violence keywords', 'Spam phrases', 'Scam patterns']}
          />
          <LayerCard
            title="Pattern Detection"
            description="Regex patterns for suspicious content"
            examples={['ALL CAPS shouting', 'Repeated chars', 'Crypto requests']}
          />
          <LayerCard
            title="Classification"
            description="Keyword-based content categorization"
            examples={['Hate indicators', 'Violence signals', 'Harassment terms']}
          />
        </div>
      </section>

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/moderation.ts</code> - Blocklists, patterns,
            classifier, pipeline
          </li>
          <li>
            <code className="text-blue-400">lib/moderation.test.ts</code> - Comprehensive tests
          </li>
        </ul>
      </section>
    </main>
  );
}

// =============================================================================
// Components
// =============================================================================

function ActionBanner({ action, reason }: { action: ModerationAction; reason?: string }) {
  const config: Record<ModerationAction, { bg: string; icon: string; label: string }> = {
    allow: { bg: 'bg-green-900/30 border-green-700', icon: '✓', label: 'ALLOWED' },
    warn: { bg: 'bg-yellow-900/30 border-yellow-700', icon: '⚠', label: 'WARNING' },
    block: { bg: 'bg-red-900/30 border-red-700', icon: '✗', label: 'BLOCKED' },
    review: { bg: 'bg-purple-900/30 border-purple-700', icon: '?', label: 'NEEDS REVIEW' },
  };

  const { bg, icon, label } = config[action];

  return (
    <div className={`p-6 rounded-lg border ${bg}`}>
      <div className="flex items-center gap-4">
        <span className="text-4xl">{icon}</span>
        <div>
          <p className="text-2xl font-bold">{label}</p>
          {reason && <p className="text-sm text-gray-400">{reason}</p>}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ category, score }: { category: ModerationCategory; score: number }) {
  const getColor = (score: number) => {
    if (score < 0.3) return 'bg-green-600';
    if (score < 0.6) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="capitalize">{category.replace('_', ' ')}</span>
        <span>{(score * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded overflow-hidden">
        <div
          className={`h-full ${getColor(score)} transition-all`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}

function LayerCard({
  title,
  description,
  examples,
}: {
  title: string;
  description: string;
  examples: string[];
}) {
  return (
    <div className="bg-gray-900/50 p-4 rounded">
      <h3 className="font-medium text-blue-400">{title}</h3>
      <p className="text-gray-400 text-sm mt-1">{description}</p>
      <ul className="mt-2 text-xs text-gray-500">
        {examples.map((ex, i) => (
          <li key={i}>&bull; {ex}</li>
        ))}
      </ul>
    </div>
  );
}
