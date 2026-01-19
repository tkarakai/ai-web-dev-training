/**
 * Tests for Content Moderation
 *
 * Run: bun test lib/moderation.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  checkBlocklists,
  checkPatterns,
  classifyContent,
  ContentModerator,
  ViolationTracker,
  ModerationSystem,
  BLOCKLISTS,
  PATTERNS,
} from './moderation';

describe('checkBlocklists', () => {
  it('returns empty for clean content', () => {
    const results = checkBlocklists('Hello, how are you today?');
    expect(results.length).toBe(0);
  });

  it('detects violence keywords', () => {
    const results = checkBlocklists('I have a bomb threat for you');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe('violence');
  });

  it('detects scam patterns', () => {
    const results = checkBlocklists('send bitcoin to this address');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe('scam');
  });

  it('detects spam patterns', () => {
    const results = checkBlocklists('Click here now for free money!');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.category === 'spam')).toBe(true);
  });
});

describe('checkPatterns', () => {
  it('detects all caps (shouting)', () => {
    const results = checkPatterns('THIS IS ABSOLUTELY OUTRAGEOUS');
    expect(results.some((r) => r.details?.includes('all_caps'))).toBe(true);
  });

  it('detects repeated characters', () => {
    const results = checkPatterns('Hellooooooooo there');
    expect(results.some((r) => r.details?.includes('repeated_chars'))).toBe(true);
  });

  it('detects crypto requests', () => {
    const results = checkPatterns('Please send me some bitcoin');
    expect(results.some((r) => r.category === 'scam')).toBe(true);
  });

  it('allows normal content', () => {
    const results = checkPatterns('This is a normal sentence.');
    expect(results.length).toBe(0);
  });
});

describe('classifyContent', () => {
  it('classifies clean content', () => {
    const scores = classifyContent('Have a wonderful day!');
    expect(scores.clean).toBeGreaterThan(0.5);
  });

  it('detects violence indicators', () => {
    const scores = classifyContent('I want to attack and destroy everything');
    expect(scores.violence).toBeGreaterThan(0);
    expect(scores.clean).toBeLessThan(scores.violence);
  });

  it('detects spam indicators', () => {
    const scores = classifyContent('Click here now! Free winner! Act now!!!');
    expect(scores.spam).toBeGreaterThan(0.5);
  });

  it('detects scam indicators', () => {
    const scores = classifyContent('Urgent wire transfer for lottery inheritance');
    expect(scores.scam).toBeGreaterThan(0);
  });
});

describe('ContentModerator', () => {
  let moderator: ContentModerator;

  beforeEach(() => {
    moderator = new ContentModerator();
  });

  it('allows clean content', () => {
    const result = moderator.moderate('How is the weather today?');
    expect(result.action).toBe('allow');
    expect(result.categories).toContain('clean');
  });

  it('blocks violent content', () => {
    const result = moderator.moderate('I have a bomb threat planned');
    expect(result.action).toBe('block');
    expect(result.categories).toContain('violence');
  });

  it('blocks scam content', () => {
    const result = moderator.moderate('Wire transfer immediately to inherit millions');
    expect(result.action).toBe('block');
    expect(result.categories).toContain('scam');
  });

  it('provides detailed flags', () => {
    const result = moderator.moderate('Click here now for free money');
    expect(result.flags.length).toBeGreaterThan(0);
  });

  it('respects custom thresholds', () => {
    const strictModerator = new ContentModerator({
      warnThreshold: 0.2,
      blockThreshold: 0.5,
    });

    const lenientModerator = new ContentModerator({
      warnThreshold: 0.8,
      blockThreshold: 0.95,
    });

    const testContent = 'You are such a stupid idiot loser';

    const strictResult = strictModerator.moderate(testContent);
    const lenientResult = lenientModerator.moderate(testContent);

    // Strict should be more likely to warn/block
    expect(['warn', 'block']).toContain(strictResult.action);
  });

  it('isClean helper works', () => {
    expect(moderator.isClean('Hello world')).toBe(true);
    expect(moderator.isClean('bomb threat attack')).toBe(false);
  });
});

describe('ViolationTracker', () => {
  let tracker: ViolationTracker;

  beforeEach(() => {
    tracker = new ViolationTracker({
      maxViolations: 3,
      windowMs: 60000,
      cooldownMs: 300000,
    });
  });

  it('tracks violations', () => {
    expect(tracker.getViolationCount('user1')).toBe(0);

    tracker.recordViolation('user1');
    expect(tracker.getViolationCount('user1')).toBe(1);

    tracker.recordViolation('user1');
    expect(tracker.getViolationCount('user1')).toBe(2);
  });

  it('blocks after max violations', () => {
    const result1 = tracker.recordViolation('user1');
    expect(result1.blocked).toBe(false);
    expect(result1.remainingViolations).toBe(2);

    const result2 = tracker.recordViolation('user1');
    expect(result2.blocked).toBe(false);
    expect(result2.remainingViolations).toBe(1);

    const result3 = tracker.recordViolation('user1');
    expect(result3.blocked).toBe(true);
    expect(result3.remainingViolations).toBe(0);
  });

  it('reports blocked status', () => {
    tracker.recordViolation('user1');
    tracker.recordViolation('user1');
    tracker.recordViolation('user1');

    expect(tracker.isBlocked('user1')).toBe(true);
    expect(tracker.isBlocked('user2')).toBe(false);
  });

  it('tracks users independently', () => {
    tracker.recordViolation('user1');
    tracker.recordViolation('user1');
    tracker.recordViolation('user2');

    expect(tracker.getViolationCount('user1')).toBe(2);
    expect(tracker.getViolationCount('user2')).toBe(1);
  });

  it('reset clears violations', () => {
    tracker.recordViolation('user1');
    tracker.recordViolation('user1');
    expect(tracker.getViolationCount('user1')).toBe(2);

    tracker.reset('user1');
    expect(tracker.getViolationCount('user1')).toBe(0);
  });
});

describe('ModerationSystem', () => {
  let system: ModerationSystem;

  beforeEach(() => {
    system = new ModerationSystem(
      {}, // default moderation config
      { maxViolations: 2 } // strict rate limiting for tests
    );
  });

  it('allows clean content', () => {
    const result = system.check('Hello world', 'user1');
    expect(result.action).toBe('allow');
    expect(result.userBlocked).toBe(false);
  });

  it('blocks bad content and tracks violations', () => {
    const result1 = system.check('bomb threat attack', 'user1');
    expect(result1.action).toBe('block');
    expect(result1.userBlocked).toBe(false);
    expect(result1.remainingViolations).toBe(1);

    const result2 = system.check('another bomb threat', 'user1');
    expect(result2.action).toBe('block');
    expect(result2.userBlocked).toBe(true);
  });

  it('blocks user after repeated violations', () => {
    // First two violations
    system.check('bomb threat', 'user1');
    system.check('bomb threat', 'user1');

    // User should now be blocked even for clean content
    const result = system.check('Hello world', 'user1');
    expect(result.userBlocked).toBe(true);
    expect(result.reason).toContain('violations');
  });
});

describe('BLOCKLISTS structure', () => {
  it('has categories for common issues', () => {
    expect(BLOCKLISTS.hate_speech).toBeDefined();
    expect(BLOCKLISTS.violence).toBeDefined();
    expect(BLOCKLISTS.spam_patterns).toBeDefined();
    expect(BLOCKLISTS.scam_patterns).toBeDefined();
  });

  it('each blocklist has words and category', () => {
    for (const [name, list] of Object.entries(BLOCKLISTS)) {
      expect(list.words).toBeInstanceOf(Array);
      expect(list.words.length).toBeGreaterThan(0);
      expect(list.category).toBeTruthy();
    }
  });
});

describe('PATTERNS structure', () => {
  it('has common detection patterns', () => {
    expect(PATTERNS.all_caps).toBeDefined();
    expect(PATTERNS.repeated_chars).toBeDefined();
    expect(PATTERNS.crypto_request).toBeDefined();
  });

  it('each pattern has required fields', () => {
    for (const [name, config] of Object.entries(PATTERNS)) {
      expect(config.pattern).toBeInstanceOf(RegExp);
      expect(config.category).toBeTruthy();
      expect(typeof config.score).toBe('number');
      expect(config.score).toBeGreaterThan(0);
      expect(config.score).toBeLessThanOrEqual(1);
    }
  });
});
