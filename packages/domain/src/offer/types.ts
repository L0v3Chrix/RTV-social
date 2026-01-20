/**
 * Offer entity types
 *
 * Represents active promotions, products, and services with CTAs for content generation.
 */

import { z } from 'zod';

/**
 * Offer status
 */
export const OfferStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted',
} as const;

export type OfferStatusType = (typeof OfferStatus)[keyof typeof OfferStatus];

/**
 * Offer type
 */
export const OfferType = {
  PRODUCT: 'product',
  SERVICE: 'service',
  PROMOTION: 'promotion',
  EVENT: 'event',
  CONTENT: 'content',
} as const;

export type OfferTypeType = (typeof OfferType)[keyof typeof OfferType];

/**
 * CTA action types
 */
export const CTAAction = {
  LINK: 'link',
  CALENDAR_BOOKING: 'calendar_booking',
  FORM: 'form',
  DM: 'dm',
  PHONE: 'phone',
  EMAIL: 'email',
} as const;

export type CTAActionType = (typeof CTAAction)[keyof typeof CTAAction];

/**
 * CTA button schema
 */
export const ctaButtonSchema = z.object({
  text: z.string().min(1).max(50),
  url: z.string().url().optional(),
  action: z.enum(['link', 'calendar_booking', 'form', 'dm', 'phone', 'email']),
  metadata: z.record(z.unknown()).optional(),
});

export type CTAButton = z.infer<typeof ctaButtonSchema>;

/**
 * CTA configuration
 */
export const ctaConfigSchema = z.object({
  primary: ctaButtonSchema,
  secondary: ctaButtonSchema.optional(),
});

export type CTAConfig = z.infer<typeof ctaConfigSchema>;

/**
 * Active period
 */
export const activePeriodSchema = z.object({
  startDate: z.date(),
  endDate: z.date().optional(),
});

export type ActivePeriod = z.infer<typeof activePeriodSchema>;

/**
 * Pricing information
 */
export const pricingSchema = z.object({
  originalPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  discountPercent: z.number().min(0).max(100).optional(),
  priceText: z.string().optional(),
});

export type Pricing = z.infer<typeof pricingSchema>;

/**
 * Offer entity
 */
export interface Offer {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly type: OfferTypeType;
  readonly status: OfferStatusType;
  readonly headline: string;
  readonly description: string;
  readonly cta: CTAConfig | null;
  readonly activePeriod: ActivePeriod | null;
  readonly pricing: Pricing | null;
  readonly platformTargeting: string[] | null;
  readonly tags: string[];
  readonly metadata: Record<string, unknown>;
  readonly priority: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

/**
 * Create offer input
 */
export const createOfferInputSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(255),
  type: z.enum(['product', 'service', 'promotion', 'event', 'content']),
  headline: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  cta: ctaConfigSchema.optional(),
  activePeriod: activePeriodSchema.optional(),
  pricing: pricingSchema.optional(),
  platformTargeting: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

export type CreateOfferInput = z.infer<typeof createOfferInputSchema>;

/**
 * Update offer input
 */
export const updateOfferInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['product', 'service', 'promotion', 'event', 'content']).optional(),
  headline: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(5000).optional(),
  cta: ctaConfigSchema.nullable().optional(),
  activePeriod: activePeriodSchema.nullable().optional(),
  pricing: pricingSchema.nullable().optional(),
  platformTargeting: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

export type UpdateOfferInput = z.infer<typeof updateOfferInputSchema>;

/**
 * List offers options
 */
export interface ListOffersOptions {
  limit?: number;
  cursor?: string;
  type?: OfferTypeType;
  status?: OfferStatusType;
  tags?: string[];
}

/**
 * Cursor-based paginated result for offers
 */
export interface OfferPaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  cursor: string | null;
}
