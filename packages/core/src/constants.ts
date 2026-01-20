/**
 * Platform constants and configuration values
 */

/**
 * Supported social media platforms
 */
export const PLATFORMS = [
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'skool',
] as const;

export type Platform = (typeof PLATFORMS)[number];

/**
 * Platform display names
 */
export const PLATFORM_NAMES: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
  skool: 'Skool',
};

/**
 * Default budget limits
 */
export const DEFAULT_BUDGETS = {
  maxTokensPerEpisode: 100_000,
  maxDurationMs: 300_000, // 5 minutes
  maxRetries: 3,
  maxToolCalls: 50,
} as const;

/**
 * Rate limits (per minute)
 */
export const RATE_LIMITS: Record<Platform, number> = {
  facebook: 30,
  instagram: 30,
  tiktok: 20,
  youtube: 10,
  linkedin: 20,
  x: 50,
  skool: 10,
};
