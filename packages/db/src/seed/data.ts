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
import type { BrandTone, BrandColors, LogoRef } from '../schema/brand-kits.js';
import type { KnowledgeSourceType } from '../schema/knowledge-bases.js';

/**
 * Seed client brand kit data
 */
export interface SeedBrandKit {
  name: string;
  description?: string;
  tone: BrandTone;
  colors: BrandColors;
  logoRefs: LogoRef[];
  fonts?: {
    heading?: string;
    body?: string;
    accent?: string;
  };
  isDefault?: boolean;
}

/**
 * Seed client knowledge base data
 */
export interface SeedKnowledgeBase {
  name: string;
  description?: string;
  sourceType: KnowledgeSourceType;
  sourceRef?: string;
}

/**
 * Complete seed client definition
 */
export interface SeedClient {
  slug: string;
  name: string;
  settings: ClientSettings;
  brandKit: SeedBrandKit;
  knowledgeBases: SeedKnowledgeBase[];
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
      name: 'Raize The Vibe Brand Kit',
      description: 'Primary brand identity for Raize The Vibe',
      tone: {
        voice: 'friendly',
        personality: ['innovative', 'approachable', 'empowering', 'tech-savvy'],
        doList: [
          'Use conversational tone',
          'Be encouraging and supportive',
          'Share actionable insights',
          'Reference AI and automation benefits',
        ],
        dontList: [
          'Be overly technical without explanation',
          'Use corporate jargon',
          'Be condescending about technology',
          'Promise unrealistic results',
        ],
        examplePhrases: [
          "Let's vibe with your audience",
          'Bridging tech and humanity',
          'Your social presence, automated with soul',
        ],
      },
      colors: {
        primary: '#6366F1',    // Indigo
        secondary: '#EC4899',  // Pink
        accent: '#10B981',     // Emerald
        background: '#0F172A', // Slate 900
        text: '#F8FAFC',       // Slate 50
      },
      logoRefs: [
        {
          type: 'primary',
          url: 'https://assets.rtv.example/logo-primary.svg',
          format: 'svg',
          dimensions: { width: 200, height: 60 },
        },
        {
          type: 'icon',
          url: 'https://assets.rtv.example/logo-icon.png',
          format: 'png',
          dimensions: { width: 64, height: 64 },
        },
      ],
      fonts: {
        heading: 'Inter',
        body: 'Inter',
        accent: 'Space Grotesk',
      },
      isDefault: true,
    },
    knowledgeBases: [
      {
        name: 'RTV Service Offerings',
        description: 'Core services and capabilities documentation',
        sourceType: 'document',
        sourceRef: 'https://docs.rtv.example/services',
      },
      {
        name: 'Social Media Best Practices',
        description: 'Internal knowledge base for social media strategies',
        sourceType: 'manual',
      },
      {
        name: 'FAQ Database',
        description: 'Frequently asked questions and answers',
        sourceType: 'faq',
      },
    ],
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
      name: 'Acme Fitness Brand Kit',
      description: 'Energetic fitness brand identity',
      tone: {
        voice: 'casual',
        personality: ['energetic', 'motivating', 'inclusive', 'fun'],
        doList: [
          'Use active, energetic language',
          'Be encouraging and positive',
          'Include fitness tips and motivation',
          'Celebrate member achievements',
        ],
        dontList: [
          'Be judgmental about fitness levels',
          'Use body-shaming language',
          'Make unrealistic promises',
          'Be overly salesy',
        ],
        examplePhrases: [
          'Every rep counts!',
          "You've got this!",
          'Stronger every day',
        ],
      },
      colors: {
        primary: '#EF4444',    // Red
        secondary: '#F97316',  // Orange
        accent: '#FBBF24',     // Amber
        background: '#FFFFFF', // White
        text: '#1F2937',       // Gray 800
      },
      logoRefs: [
        {
          type: 'primary',
          url: 'https://assets.acmefitness.example/logo.png',
          format: 'png',
          dimensions: { width: 180, height: 50 },
        },
      ],
      fonts: {
        heading: 'Bebas Neue',
        body: 'Open Sans',
      },
      isDefault: true,
    },
    knowledgeBases: [
      {
        name: 'Class Schedules',
        description: 'Weekly class schedules and instructor info',
        sourceType: 'document',
        sourceRef: 'https://acmefitness.example/schedules',
      },
      {
        name: 'Membership FAQ',
        description: 'Common questions about memberships',
        sourceType: 'faq',
      },
    ],
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
      name: 'Green Thumb Brand Kit',
      description: 'Professional landscaping brand identity',
      tone: {
        voice: 'professional',
        personality: ['trustworthy', 'knowledgeable', 'reliable', 'local'],
        doList: [
          'Highlight expertise and experience',
          'Mention seasonal tips',
          'Share before/after project photos',
          'Emphasize local community connection',
        ],
        dontList: [
          'Be too casual',
          'Criticize competitor work',
          'Make claims without backing',
          'Ignore safety considerations',
        ],
        examplePhrases: [
          'Transforming outdoor spaces since 1998',
          'Your neighbors trust us',
          'Seasonal care for lasting beauty',
        ],
      },
      colors: {
        primary: '#16A34A',    // Green 600
        secondary: '#854D0E',  // Yellow 800 (earth tone)
        accent: '#0EA5E9',     // Sky 500
        background: '#FAFAF9', // Stone 50
        text: '#292524',       // Stone 800
      },
      logoRefs: [
        {
          type: 'primary',
          url: 'https://assets.greenthumb.example/logo.png',
          format: 'png',
          dimensions: { width: 200, height: 70 },
        },
      ],
      isDefault: true,
    },
    knowledgeBases: [
      {
        name: 'Service Catalog',
        description: 'Complete list of landscaping services',
        sourceType: 'product',
        sourceRef: 'https://greenthumb.example/services',
      },
    ],
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
