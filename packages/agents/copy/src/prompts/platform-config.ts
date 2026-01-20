/**
 * S2-C1: Platform Configuration
 *
 * Platform-specific configurations for copy generation.
 */

import type { Platform } from './types.js';

export interface PlatformConfig {
  name: string;
  captionMaxLength: number;
  hashtagLimit: number;
  mentionLimit: number;
  linkBehavior: 'in_bio' | 'inline' | 'first_comment';
  characteristics: string[];
  audienceExpectations: string[];
  bestPractices: string[];
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  instagram: {
    name: 'Instagram',
    captionMaxLength: 2200,
    hashtagLimit: 30,
    mentionLimit: 20,
    linkBehavior: 'in_bio',
    characteristics: [
      'Visual-first platform',
      'Hashtags drive discovery',
      'Stories for ephemeral content',
      'Reels for algorithm boost',
    ],
    audienceExpectations: [
      'Polished, aesthetic content',
      'Behind-the-scenes authenticity',
      'Engagement through questions and polls',
      'Value-driven captions',
    ],
    bestPractices: [
      'Front-load important information',
      'Use line breaks for readability',
      'Include call-to-action',
      'Place hashtags at end or in first comment',
      'Optimal hashtag count: 5-15',
    ],
  },
  facebook: {
    name: 'Facebook',
    captionMaxLength: 63206,
    hashtagLimit: 10,
    mentionLimit: 50,
    linkBehavior: 'inline',
    characteristics: [
      'Community-focused',
      'Groups drive engagement',
      'Longer content acceptable',
      'Link posts perform well',
    ],
    audienceExpectations: [
      'Personal, relatable content',
      'Community building',
      'Event promotion',
      'Detailed information',
    ],
    bestPractices: [
      'Keep captions under 80 characters for engagement',
      'Use 1-2 hashtags maximum',
      'Include native video when possible',
      'Post during lunch and evening hours',
    ],
  },
  tiktok: {
    name: 'TikTok',
    captionMaxLength: 2200,
    hashtagLimit: 6,
    mentionLimit: 10,
    linkBehavior: 'in_bio',
    characteristics: [
      'Short-form video dominant',
      'Trend-driven culture',
      'Sound/music integral',
      'FYP algorithm rewards engagement',
    ],
    audienceExpectations: [
      'Authentic, unpolished content',
      'Entertainment value',
      'Trend participation',
      'Quick hooks (0-3 seconds)',
    ],
    bestPractices: [
      'Hook in first 1-3 seconds',
      'Use trending sounds',
      'Hashtags: mix of broad and niche',
      'FYP, viral hashtags sparingly',
      'Caption supports video, not standalone',
    ],
  },
  youtube: {
    name: 'YouTube',
    captionMaxLength: 5000,
    hashtagLimit: 15,
    mentionLimit: 50,
    linkBehavior: 'inline',
    characteristics: [
      'Long-form video platform',
      'Search-driven discovery',
      'Shorts competing with TikTok',
      'Comments build community',
    ],
    audienceExpectations: [
      'Educational or entertainment value',
      'Production quality',
      'Consistent posting schedule',
      'Creator authenticity',
    ],
    bestPractices: [
      'Description front-loads keywords',
      'Include timestamps for long videos',
      'CTAs: subscribe, like, comment',
      'Shorts: vertical, 60 seconds max',
    ],
  },
  linkedin: {
    name: 'LinkedIn',
    captionMaxLength: 3000,
    hashtagLimit: 5,
    mentionLimit: 30,
    linkBehavior: 'inline',
    characteristics: [
      'Professional networking',
      'Thought leadership',
      'B2B focus',
      'Career content',
    ],
    audienceExpectations: [
      'Professional, polished tone',
      'Industry insights',
      'Career advice',
      'Company culture',
    ],
    bestPractices: [
      'First line is the hook (before "see more")',
      '3-5 hashtags maximum',
      'Personal stories perform well',
      'Native documents get high reach',
      'Avoid external links in post (use comments)',
    ],
  },
  x: {
    name: 'X (Twitter)',
    captionMaxLength: 280,
    hashtagLimit: 2,
    mentionLimit: 10,
    linkBehavior: 'inline',
    characteristics: [
      'Real-time conversation',
      'News and trending topics',
      'Thread culture',
      'High velocity',
    ],
    audienceExpectations: [
      'Concise, punchy content',
      'Hot takes and opinions',
      'Engagement with trends',
      'Quick wit',
    ],
    bestPractices: [
      'Under 280 characters (or threads)',
      '1-2 hashtags maximum',
      'Questions drive engagement',
      'Visual tweets perform better',
    ],
  },
  skool: {
    name: 'Skool',
    captionMaxLength: 10000,
    hashtagLimit: 0,
    mentionLimit: 50,
    linkBehavior: 'inline',
    characteristics: [
      'Community-first platform',
      'Course integration',
      'Discussion-focused',
      'Membership model',
    ],
    audienceExpectations: [
      'High-value content',
      'Community engagement',
      'Educational material',
      'Personal connection',
    ],
    bestPractices: [
      'Lead with value',
      'Encourage discussion',
      'Reference course materials',
      'Build relationships',
    ],
  },
};

export function getPlatformConfig(platform: Platform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}
