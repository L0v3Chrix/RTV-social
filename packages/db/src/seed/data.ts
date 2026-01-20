/**
 * @rtv/db Seed Data
 *
 * Sample client data for development and testing.
 * Includes 3 clients with varying feature levels:
 * - RTV House Account (full features)
 * - Acme Fitness (partial features)
 * - Green Thumb Landscaping (minimal features)
 */

import type { ClientSettings } from '../schema/clients.js';
import type { VoiceStyle, VisualTokens, ComplianceRules, ICP } from '../schema/brand-kits.js';
import type { FAQEntry, Resource, RetrievalConfig } from '../schema/knowledge-bases.js';

/**
 * Seed client brand kit data
 */
export interface SeedBrandKit {
  voiceStyle: VoiceStyle;
  visualTokens?: VisualTokens | null;
  complianceRules?: ComplianceRules | null;
  icp?: ICP | null;
}

/**
 * Seed client knowledge base data (new RLM-based schema)
 */
export interface SeedKnowledgeBase {
  faqs: Omit<FAQEntry, 'id'>[];
  resources: Omit<Resource, 'id'>[];
  retrievalConfig?: Partial<RetrievalConfig>;
}

/**
 * Complete seed client definition
 */
export interface SeedClient {
  slug: string;
  name: string;
  settings: ClientSettings;
  brandKit: SeedBrandKit;
  knowledgeBase: SeedKnowledgeBase;
}

/**
 * Seed clients array
 *
 * These clients represent different tiers of service:
 * 1. rtv-house-account: Internal RTV testing with full features enabled
 * 2. acme-fitness: Typical client with partial features
 * 3. green-thumb-landscaping: Basic client with minimal features
 */
export const SEED_CLIENTS: SeedClient[] = [
  // ============================================
  // RTV House Account (Full Features)
  // ============================================
  {
    slug: 'rtv-house-account',
    name: 'Raize The Vibe (House)',
    settings: {
      timezone: 'America/New_York',
      defaultLanguage: 'en',
      features: {
        publishing: true,
        engagement: true,
        browserLane: true,
      },
      limits: {
        maxPlatformAccounts: 10,
        maxBrandKits: 5,
        maxKnowledgeBases: 20,
      },
    },
    brandKit: {
      voiceStyle: {
        tone: 'friendly',
        personality: ['innovative', 'approachable', 'empowering', 'tech-savvy'],
        writingStyle: 'conversational',
        vocabulary: {
          preferred: ['vibe', 'bridging tech and humanity', 'automation with soul'],
          avoided: ['corporate jargon', 'overly technical', 'condescending'],
        },
        examples: [
          { context: 'tagline', example: "Let's vibe with your audience" },
          { context: 'mission', example: 'Bridging tech and humanity' },
          { context: 'social', example: 'Your social presence, automated with soul' },
        ],
      },
      visualTokens: {
        colors: {
          primary: '#6366F1',    // Indigo
          secondary: '#EC4899',  // Pink
          accent: '#10B981',     // Emerald
          background: '#0F172A', // Slate 900
          text: '#F8FAFC',       // Slate 50
        },
        typography: {
          headingFont: 'Inter',
          bodyFont: 'Inter',
          baseSize: 16,
        },
        logoUrls: {
          primary: 'https://assets.rtv.example/logo-primary.svg',
          icon: 'https://assets.rtv.example/logo-icon.png',
        },
      },
      complianceRules: {
        industry: 'technology',
        restrictions: ['No spam messaging', 'Respect platform ToS'],
        requiredDisclosures: ['AI-generated content disclosure when required'],
      },
      icp: {
        demographics: {
          ageRange: { min: 25, max: 55 },
          income: 'middle-upper',
          location: ['USA'],
          occupation: ['small business owner', 'marketer', 'entrepreneur'],
        },
        psychographics: {
          interests: ['marketing', 'automation', 'social media', 'AI'],
          values: ['efficiency', 'authenticity', 'innovation'],
          painPoints: ['time constraints', 'content creation fatigue', 'platform complexity'],
        },
        behaviors: {
          platforms: ['LinkedIn', 'Instagram', 'TikTok'],
          contentPreferences: ['video', 'short-form', 'educational'],
          purchaseDrivers: ['time savings', 'ROI', 'ease of use'],
        },
      },
    },
    knowledgeBase: {
      faqs: [
        {
          question: 'What services does Raize The Vibe offer?',
          answer: 'We offer autonomous social media management, content creation, publishing, and engagement automation for small businesses.',
          category: 'services',
          tags: ['services', 'general'],
        },
        {
          question: 'How does the AI-powered automation work?',
          answer: 'Our RLM (Recursive Language Model) system handles planning, creation, and engagement with human oversight at key approval points.',
          category: 'technology',
          tags: ['ai', 'automation'],
        },
      ],
      resources: [
        {
          title: 'Service Offerings',
          url: 'https://docs.rtv.example/services',
          type: 'link',
          description: 'Core services and capabilities documentation',
          tags: ['services', 'documentation'],
        },
        {
          title: 'Social Media Best Practices',
          url: 'https://docs.rtv.example/best-practices',
          type: 'pdf',
          description: 'Internal knowledge base for social media strategies',
          tags: ['social-media', 'best-practices'],
        },
      ],
      retrievalConfig: {
        chunkSize: 4096,
        maxResults: 10,
        similarityThreshold: 0.6,
      },
    },
  },

  // ============================================
  // Acme Fitness Studio (Partial Features)
  // ============================================
  {
    slug: 'acme-fitness',
    name: 'Acme Fitness Studio',
    settings: {
      timezone: 'America/Los_Angeles',
      defaultLanguage: 'en',
      features: {
        publishing: true,
        engagement: true,
        browserLane: false,
      },
      limits: {
        maxPlatformAccounts: 5,
        maxBrandKits: 2,
        maxKnowledgeBases: 10,
      },
    },
    brandKit: {
      voiceStyle: {
        tone: 'casual',
        personality: ['energetic', 'motivating', 'inclusive', 'fun'],
        writingStyle: 'short-form',
        vocabulary: {
          preferred: ['every rep counts', "you've got this", 'stronger every day'],
          avoided: ['body shaming', 'judgmental', 'overly salesy'],
        },
        examples: [
          { context: 'motivation', example: 'Every rep counts!' },
          { context: 'encouragement', example: "You've got this!" },
          { context: 'progress', example: 'Stronger every day' },
        ],
      },
      visualTokens: {
        colors: {
          primary: '#EF4444',    // Red
          secondary: '#F97316',  // Orange
          accent: '#FBBF24',     // Amber
          background: '#FFFFFF', // White
          text: '#1F2937',       // Gray 800
        },
        typography: {
          headingFont: 'Bebas Neue',
          bodyFont: 'Open Sans',
          baseSize: 16,
        },
        logoUrls: {
          primary: 'https://assets.acmefitness.example/logo.png',
        },
      },
      icp: {
        demographics: {
          ageRange: { min: 18, max: 45 },
          gender: 'all',
          location: ['Los Angeles, CA'],
        },
        psychographics: {
          interests: ['fitness', 'health', 'wellness', 'community'],
          values: ['health', 'community', 'self-improvement'],
          painPoints: ['motivation', 'time management', 'accountability'],
        },
        behaviors: {
          platforms: ['Instagram', 'TikTok'],
          contentPreferences: ['video', 'reels', 'workout tips'],
          purchaseDrivers: ['community', 'results', 'convenience'],
        },
      },
    },
    knowledgeBase: {
      faqs: [
        {
          question: 'What are your class times?',
          answer: 'We offer classes from 6am-9pm daily. Check our online schedule for specific class types and times.',
          category: 'schedule',
          tags: ['classes', 'schedule'],
        },
        {
          question: 'What membership options do you offer?',
          answer: 'We offer monthly, quarterly, and annual memberships with options for unlimited classes or punch cards.',
          category: 'membership',
          tags: ['membership', 'pricing'],
        },
        {
          question: 'Do you offer a free trial?',
          answer: 'Yes! We offer a free week trial for new members to try any classes.',
          category: 'membership',
          tags: ['trial', 'new-members'],
        },
      ],
      resources: [
        {
          title: 'Class Schedule',
          url: 'https://acmefitness.example/schedules',
          type: 'link',
          description: 'Weekly class schedules and instructor info',
          tags: ['schedule', 'classes'],
        },
      ],
    },
  },

  // ============================================
  // Green Thumb Landscaping (Minimal Features)
  // ============================================
  {
    slug: 'green-thumb-landscaping',
    name: 'Green Thumb Landscaping',
    settings: {
      timezone: 'America/Chicago',
      defaultLanguage: 'en',
      features: {
        publishing: true,
        engagement: false,
        browserLane: false,
      },
      limits: {
        maxPlatformAccounts: 3,
        maxBrandKits: 1,
        maxKnowledgeBases: 5,
      },
    },
    brandKit: {
      voiceStyle: {
        tone: 'professional',
        personality: ['trustworthy', 'knowledgeable', 'reliable', 'local'],
        writingStyle: 'informative',
        vocabulary: {
          preferred: ['transforming outdoor spaces', 'your neighbors trust us', 'seasonal care'],
          avoided: ['competitor criticism', 'unsubstantiated claims', 'too casual'],
        },
        examples: [
          { context: 'heritage', example: 'Transforming outdoor spaces since 1998' },
          { context: 'trust', example: 'Your neighbors trust us' },
          { context: 'expertise', example: 'Seasonal care for lasting beauty' },
        ],
      },
      visualTokens: {
        colors: {
          primary: '#16A34A',    // Green 600
          secondary: '#854D0E',  // Yellow 800 (earth tone)
          accent: '#0EA5E9',     // Sky 500
          background: '#FAFAF9', // Stone 50
          text: '#292524',       // Stone 800
        },
        typography: {
          headingFont: 'Playfair Display',
          bodyFont: 'Source Sans Pro',
          baseSize: 16,
        },
        logoUrls: {
          primary: 'https://assets.greenthumb.example/logo.png',
        },
      },
      complianceRules: {
        industry: 'landscaping',
        restrictions: ['Safety disclaimers for equipment', 'Licensed and insured mention'],
        requiredDisclosures: ['Licensed and insured in Illinois'],
      },
      icp: {
        demographics: {
          ageRange: { min: 35, max: 65 },
          income: 'middle-upper',
          location: ['Chicago suburbs'],
        },
        psychographics: {
          interests: ['home improvement', 'gardening', 'outdoor living'],
          values: ['quality', 'reliability', 'local business'],
          painPoints: ['time', 'expertise', 'seasonal maintenance'],
        },
        behaviors: {
          platforms: ['Facebook', 'Google Business'],
          contentPreferences: ['before/after photos', 'tips', 'seasonal guides'],
          purchaseDrivers: ['reputation', 'local presence', 'quality work'],
        },
      },
    },
    knowledgeBase: {
      faqs: [
        {
          question: 'What landscaping services do you offer?',
          answer: 'We provide full-service landscaping including design, installation, maintenance, seasonal cleanup, and irrigation services.',
          category: 'services',
          tags: ['services', 'landscaping'],
        },
        {
          question: 'Do you offer free estimates?',
          answer: 'Yes, we provide free on-site consultations and estimates for all landscaping projects.',
          category: 'pricing',
          tags: ['estimates', 'pricing'],
        },
        {
          question: 'Are you licensed and insured?',
          answer: 'Yes, Green Thumb Landscaping is fully licensed and insured in Illinois.',
          category: 'company',
          tags: ['licensing', 'insurance'],
        },
      ],
      resources: [
        {
          title: 'Service Catalog',
          url: 'https://greenthumb.example/services',
          type: 'pdf',
          description: 'Complete list of landscaping services',
          tags: ['services', 'catalog'],
        },
      ],
    },
  },
];

/**
 * Helper to get a seed client by slug
 */
export function getSeedClientBySlug(slug: string): SeedClient | undefined {
  return SEED_CLIENTS.find((client) => client.slug === slug);
}

/**
 * Get all seed client slugs
 */
export function getSeedClientSlugs(): string[] {
  return SEED_CLIENTS.map((client) => client.slug);
}
