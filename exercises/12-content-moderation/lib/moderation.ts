/**
 * Content Moderation
 *
 * Filter inappropriate content using multiple layers of checks.
 *
 * KEY CONCEPTS:
 * 1. Blocklists - Pattern-based filtering for known bad content
 * 2. Classification - Categorize content by type/risk
 * 3. Layered filtering - Multiple checks in sequence
 * 4. Rate limiting - Prevent abuse through volume control
 */

// =============================================================================
// TYPES
// =============================================================================

export type ModerationCategory =
  | 'hate'
  | 'violence'
  | 'sexual'
  | 'harassment'
  | 'self_harm'
  | 'spam'
  | 'scam'
  | 'illegal'
  | 'clean';

export type ModerationAction = 'allow' | 'warn' | 'block' | 'review';

export interface ModerationResult {
  action: ModerationAction;
  categories: ModerationCategory[];
  scores: Record<ModerationCategory, number>;
  flags: string[];
  reason?: string;
}

export interface ContentFilter {
  name: string;
  check: (content: string) => FilterResult;
}

export interface FilterResult {
  triggered: boolean;
  category?: ModerationCategory;
  score: number;
  details?: string;
}

// =============================================================================
// BLOCKLISTS
// =============================================================================

/**
 * Word/phrase blocklists by category
 *
 * Note: These are simplified examples. Production systems would use
 * more comprehensive lists and handle variations (leetspeak, etc.)
 */
export const BLOCKLISTS: Record<string, { words: string[]; category: ModerationCategory }> = {
  hate_speech: {
    words: [
      // Placeholder examples - production would have comprehensive lists
      'hate_word_1',
      'hate_word_2',
      'slur_placeholder',
    ],
    category: 'hate',
  },

  violence: {
    words: [
      'kill everyone',
      'bomb threat',
      'mass shooting',
      'terrorist attack',
    ],
    category: 'violence',
  },

  harassment: {
    words: [
      'kys',
      'go die',
      'doxxing',
      'swatting',
    ],
    category: 'harassment',
  },

  self_harm: {
    words: [
      'how to commit',
      'methods to end',
      'suicide instructions',
    ],
    category: 'self_harm',
  },

  spam_patterns: {
    words: [
      'click here now',
      'free money',
      'act fast limited time',
      'congratulations you won',
    ],
    category: 'spam',
  },

  scam_patterns: {
    words: [
      'send bitcoin to',
      'wire transfer immediately',
      'nigerian prince',
      'inherit millions',
    ],
    category: 'scam',
  },
};

/**
 * Check content against blocklists
 */
export function checkBlocklists(content: string): FilterResult[] {
  const results: FilterResult[] = [];
  const contentLower = content.toLowerCase();

  for (const [listName, { words, category }] of Object.entries(BLOCKLISTS)) {
    for (const word of words) {
      if (contentLower.includes(word.toLowerCase())) {
        results.push({
          triggered: true,
          category,
          score: 1.0,
          details: `Matched blocklist "${listName}": "${word}"`,
        });
      }
    }
  }

  return results;
}

// =============================================================================
// PATTERN-BASED FILTERS
// =============================================================================

/**
 * Regex patterns for content detection
 */
export const PATTERNS: Record<string, { pattern: RegExp; category: ModerationCategory; score: number }> = {
  // URLs (potential phishing)
  suspicious_url: {
    pattern: /https?:\/\/(?!(?:www\.)?(?:google|github|stackoverflow|wikipedia|youtube)\.)[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi,
    category: 'spam',
    score: 0.3,
  },

  // Excessive caps (shouting)
  all_caps: {
    pattern: /\b[A-Z]{10,}\b/g,
    category: 'harassment',
    score: 0.2,
  },

  // Repeated characters (spam indicator)
  repeated_chars: {
    pattern: /(.)\1{5,}/g,
    category: 'spam',
    score: 0.4,
  },

  // Phone number solicitation
  phone_solicitation: {
    pattern: /(?:call|text|contact)\s*(?:me|us)?\s*(?:at|on)?\s*\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/gi,
    category: 'spam',
    score: 0.5,
  },

  // Crypto/money requests
  crypto_request: {
    pattern: /(?:send|transfer|pay)\s*(?:me|us)?\s*(?:some|your)?\s*(?:bitcoin|btc|eth|crypto|money)/gi,
    category: 'scam',
    score: 0.8,
  },
};

/**
 * Check content against patterns
 */
export function checkPatterns(content: string): FilterResult[] {
  const results: FilterResult[] = [];

  for (const [patternName, { pattern, category, score }] of Object.entries(PATTERNS)) {
    pattern.lastIndex = 0;
    const matches = content.match(pattern);

    if (matches && matches.length > 0) {
      results.push({
        triggered: true,
        category,
        score: Math.min(score * matches.length, 1.0),
        details: `Pattern "${patternName}" matched ${matches.length} time(s)`,
      });
    }
  }

  return results;
}

// =============================================================================
// CONTENT CLASSIFIERS
// =============================================================================

/**
 * Simple keyword-based classifier
 *
 * Production systems would use ML models for better accuracy.
 */
export function classifyContent(content: string): Record<ModerationCategory, number> {
  const scores: Record<ModerationCategory, number> = {
    hate: 0,
    violence: 0,
    sexual: 0,
    harassment: 0,
    self_harm: 0,
    spam: 0,
    scam: 0,
    illegal: 0,
    clean: 1,
  };

  const contentLower = content.toLowerCase();

  // Hate indicators
  const hateIndicators = ['hate', 'inferior', 'deport', 'go back to'];
  scores.hate = calculateIndicatorScore(contentLower, hateIndicators);

  // Violence indicators
  const violenceIndicators = ['kill', 'attack', 'destroy', 'weapon', 'bomb', 'shoot'];
  scores.violence = calculateIndicatorScore(contentLower, violenceIndicators);

  // Harassment indicators
  const harassmentIndicators = ['stupid', 'idiot', 'loser', 'worthless', 'ugly'];
  scores.harassment = calculateIndicatorScore(contentLower, harassmentIndicators);

  // Spam indicators
  const spamIndicators = ['click', 'subscribe', 'free', 'winner', 'act now', '!!!'];
  scores.spam = calculateIndicatorScore(contentLower, spamIndicators);

  // Scam indicators
  const scamIndicators = ['urgent', 'wire', 'prince', 'inheritance', 'lottery'];
  scores.scam = calculateIndicatorScore(contentLower, scamIndicators);

  // Calculate clean score (inverse of max harmful score)
  const maxHarmful = Math.max(
    scores.hate,
    scores.violence,
    scores.harassment,
    scores.spam,
    scores.scam
  );
  scores.clean = Math.max(0, 1 - maxHarmful);

  return scores;
}

function calculateIndicatorScore(content: string, indicators: string[]): number {
  let matches = 0;
  for (const indicator of indicators) {
    if (content.includes(indicator)) matches++;
  }
  return Math.min(matches / 3, 1.0); // Cap at 1.0, reach max with 3 matches
}

// =============================================================================
// MODERATION PIPELINE
// =============================================================================

export interface ModerationConfig {
  /** Threshold for blocking (0-1) */
  blockThreshold?: number;
  /** Threshold for warning (0-1) */
  warnThreshold?: number;
  /** Categories that auto-block regardless of score */
  autoBlockCategories?: ModerationCategory[];
  /** Custom filters to add to pipeline */
  customFilters?: ContentFilter[];
  /** Whether to include detailed reasons */
  includeDetails?: boolean;
}

/**
 * Content Moderator
 *
 * Runs content through multiple layers of checks.
 */
export class ContentModerator {
  private config: Required<ModerationConfig>;
  private filters: ContentFilter[] = [];

  constructor(config: ModerationConfig = {}) {
    this.config = {
      blockThreshold: config.blockThreshold ?? 0.8,
      warnThreshold: config.warnThreshold ?? 0.5,
      autoBlockCategories: config.autoBlockCategories ?? ['violence', 'self_harm', 'illegal'],
      customFilters: config.customFilters ?? [],
      includeDetails: config.includeDetails ?? true,
    };

    // Build filter pipeline
    this.filters = [
      { name: 'blocklist', check: (c) => this.aggregateResults(checkBlocklists(c)) },
      { name: 'patterns', check: (c) => this.aggregateResults(checkPatterns(c)) },
      { name: 'classifier', check: (c) => this.classifierFilter(c) },
      ...this.config.customFilters,
    ];
  }

  /**
   * Moderate content through all filters
   */
  moderate(content: string): ModerationResult {
    const allResults: FilterResult[] = [];
    const flags: string[] = [];
    const categoryScores: Record<ModerationCategory, number> = {
      hate: 0,
      violence: 0,
      sexual: 0,
      harassment: 0,
      self_harm: 0,
      spam: 0,
      scam: 0,
      illegal: 0,
      clean: 1,
    };

    // Run all filters
    for (const filter of this.filters) {
      const result = filter.check(content);
      if (result.triggered) {
        allResults.push(result);
        flags.push(`${filter.name}: ${result.details || result.category}`);

        if (result.category) {
          categoryScores[result.category] = Math.max(
            categoryScores[result.category],
            result.score
          );
        }
      }
    }

    // Determine categories that were flagged
    const triggeredCategories = Object.entries(categoryScores)
      .filter(([cat, score]) => cat !== 'clean' && score > 0)
      .map(([cat]) => cat as ModerationCategory);

    // Update clean score
    const maxScore = Math.max(...Object.values(categoryScores).filter((_, i) => i < 8));
    categoryScores.clean = Math.max(0, 1 - maxScore);

    // Determine action
    let action: ModerationAction = 'allow';
    let reason: string | undefined;

    // Check auto-block categories
    for (const category of this.config.autoBlockCategories) {
      if (categoryScores[category] > 0.1) {
        action = 'block';
        reason = `Auto-blocked for ${category} content`;
        break;
      }
    }

    // Check thresholds if not already blocked
    if (action === 'allow') {
      if (maxScore >= this.config.blockThreshold) {
        action = 'block';
        reason = `Score ${maxScore.toFixed(2)} exceeds block threshold`;
      } else if (maxScore >= this.config.warnThreshold) {
        action = 'warn';
        reason = `Score ${maxScore.toFixed(2)} exceeds warn threshold`;
      }
    }

    return {
      action,
      categories: triggeredCategories.length > 0 ? triggeredCategories : ['clean'],
      scores: categoryScores,
      flags: this.config.includeDetails ? flags : [],
      reason,
    };
  }

  /**
   * Quick check if content is clean
   */
  isClean(content: string): boolean {
    return this.moderate(content).action === 'allow';
  }

  /**
   * Helper to aggregate multiple filter results
   */
  private aggregateResults(results: FilterResult[]): FilterResult {
    if (results.length === 0) {
      return { triggered: false, score: 0 };
    }

    const maxScore = Math.max(...results.map((r) => r.score));
    const categories = results.filter((r) => r.category).map((r) => r.category!);
    const details = results.map((r) => r.details).filter(Boolean).join('; ');

    return {
      triggered: true,
      category: categories[0],
      score: maxScore,
      details,
    };
  }

  /**
   * Classifier as filter
   */
  private classifierFilter(content: string): FilterResult {
    const scores = classifyContent(content);
    const maxCategory = Object.entries(scores)
      .filter(([cat]) => cat !== 'clean')
      .reduce((max, curr) => (curr[1] > max[1] ? curr : max), ['none', 0] as [string, number]);

    return {
      triggered: maxCategory[1] > 0.3,
      category: maxCategory[0] as ModerationCategory,
      score: maxCategory[1],
      details: `Classified as ${maxCategory[0]} (${(maxCategory[1] * 100).toFixed(0)}%)`,
    };
  }
}

// =============================================================================
// RATE LIMITING FOR MODERATION
// =============================================================================

export interface RateLimitConfig {
  /** Max violations before temporary block */
  maxViolations: number;
  /** Time window for counting violations (ms) */
  windowMs: number;
  /** Cooldown period after max violations (ms) */
  cooldownMs: number;
}

/**
 * Track user violations for rate limiting
 */
export class ViolationTracker {
  private violations: Map<string, { count: number; timestamps: number[]; cooldownUntil?: number }> =
    new Map();
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxViolations: config.maxViolations ?? 3,
      windowMs: config.windowMs ?? 60000, // 1 minute
      cooldownMs: config.cooldownMs ?? 300000, // 5 minutes
    };
  }

  /**
   * Record a violation for a user
   */
  recordViolation(userId: string): { blocked: boolean; remainingViolations: number } {
    const now = Date.now();
    let record = this.violations.get(userId);

    if (!record) {
      record = { count: 0, timestamps: [] };
      this.violations.set(userId, record);
    }

    // Check if in cooldown
    if (record.cooldownUntil && now < record.cooldownUntil) {
      return { blocked: true, remainingViolations: 0 };
    }

    // Clean old violations outside window
    record.timestamps = record.timestamps.filter(
      (ts) => now - ts < this.config.windowMs
    );

    // Add new violation
    record.timestamps.push(now);
    record.count = record.timestamps.length;

    // Check if exceeded max
    if (record.count >= this.config.maxViolations) {
      record.cooldownUntil = now + this.config.cooldownMs;
      return { blocked: true, remainingViolations: 0 };
    }

    return {
      blocked: false,
      remainingViolations: this.config.maxViolations - record.count,
    };
  }

  /**
   * Check if user is currently blocked
   */
  isBlocked(userId: string): boolean {
    const record = this.violations.get(userId);
    if (!record || !record.cooldownUntil) return false;
    return Date.now() < record.cooldownUntil;
  }

  /**
   * Get user's violation count
   */
  getViolationCount(userId: string): number {
    const record = this.violations.get(userId);
    if (!record) return 0;

    // Clean old violations
    const now = Date.now();
    record.timestamps = record.timestamps.filter(
      (ts) => now - ts < this.config.windowMs
    );
    return record.timestamps.length;
  }

  /**
   * Reset a user's violations
   */
  reset(userId: string): void {
    this.violations.delete(userId);
  }
}

// =============================================================================
// COMBINED MODERATION SYSTEM
// =============================================================================

/**
 * Complete moderation system with content filtering and rate limiting
 */
export class ModerationSystem {
  private moderator: ContentModerator;
  private violationTracker: ViolationTracker;

  constructor(
    moderationConfig: ModerationConfig = {},
    rateLimitConfig: Partial<RateLimitConfig> = {}
  ) {
    this.moderator = new ContentModerator(moderationConfig);
    this.violationTracker = new ViolationTracker(rateLimitConfig);
  }

  /**
   * Check content and track violations
   */
  check(
    content: string,
    userId: string
  ): ModerationResult & { userBlocked: boolean; remainingViolations?: number } {
    // First check if user is already blocked
    if (this.violationTracker.isBlocked(userId)) {
      return {
        action: 'block',
        categories: [],
        scores: {} as Record<ModerationCategory, number>,
        flags: ['User temporarily blocked due to repeated violations'],
        reason: 'Too many violations',
        userBlocked: true,
      };
    }

    // Run content moderation
    const result = this.moderator.moderate(content);

    // Track violation if blocked
    if (result.action === 'block') {
      const { blocked, remainingViolations } = this.violationTracker.recordViolation(userId);
      return {
        ...result,
        userBlocked: blocked,
        remainingViolations,
      };
    }

    return {
      ...result,
      userBlocked: false,
    };
  }
}
