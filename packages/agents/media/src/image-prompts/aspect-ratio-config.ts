/**
 * S2-D1: Aspect Ratio Configuration
 *
 * Platform-specific aspect ratios and resolutions.
 */

import type { Platform, ContentType } from './types.js';

interface AspectRatioSpec {
  ratio: string;
  resolutions: {
    low: string;
    medium: string;
    high: string;
  };
}

const ASPECT_RATIOS: Record<string, AspectRatioSpec> = {
  '1:1': {
    ratio: '1:1',
    resolutions: { low: '512x512', medium: '768x768', high: '1080x1080' },
  },
  '4:5': {
    ratio: '4:5',
    resolutions: { low: '512x640', medium: '768x960', high: '1080x1350' },
  },
  '9:16': {
    ratio: '9:16',
    resolutions: { low: '512x910', medium: '768x1365', high: '1080x1920' },
  },
  '16:9': {
    ratio: '16:9',
    resolutions: { low: '512x288', medium: '1280x720', high: '1920x1080' },
  },
  '1.91:1': {
    ratio: '1.91:1',
    resolutions: { low: '600x314', medium: '1200x628', high: '1200x628' },
  },
  '2:3': {
    ratio: '2:3',
    resolutions: { low: '512x768', medium: '768x1152', high: '1000x1500' },
  },
  '4:1': {
    ratio: '4:1',
    resolutions: { low: '800x200', medium: '1584x396', high: '1584x396' },
  },
};

const PLATFORM_CONTENT_RATIOS: Record<string, string> = {
  'instagram:post': '1:1',
  'instagram:story': '9:16',
  'instagram:reel': '9:16',
  'instagram:carousel': '1:1',
  'instagram:ad': '1:1',
  'facebook:post': '1.91:1',
  'facebook:story': '9:16',
  'facebook:ad': '1.91:1',
  'facebook:cover': '16:9',
  'tiktok:post': '9:16',
  'tiktok:thumbnail': '9:16',
  'youtube:thumbnail': '16:9',
  'youtube:post': '16:9',
  'youtube:cover': '16:9',
  'linkedin:post': '1.91:1',
  'linkedin:cover': '4:1',
  'x:post': '16:9',
  'x:ad': '1.91:1',
  'skool:post': '16:9',
};

export class AspectRatioConfig {
  static get(platform: Platform, contentType: ContentType): string {
    const key = `${platform}:${contentType}`;
    return PLATFORM_CONTENT_RATIOS[key] || '1:1';
  }

  static getResolution(
    ratio: string,
    quality: 'low' | 'medium' | 'high' = 'high'
  ): string {
    const spec = ASPECT_RATIOS[ratio];
    if (!spec) {
      return '1080x1080'; // Default
    }
    return spec.resolutions[quality];
  }

  static getSpec(ratio: string): AspectRatioSpec | null {
    return ASPECT_RATIOS[ratio] || null;
  }

  static getAllRatios(): string[] {
    return Object.keys(ASPECT_RATIOS);
  }

  static getMidjourneyRatio(ratio: string): string {
    // Midjourney uses specific format
    const conversions: Record<string, string> = {
      '1:1': '1:1',
      '4:5': '4:5',
      '9:16': '9:16',
      '16:9': '16:9',
      '1.91:1': '191:100',
      '2:3': '2:3',
      '4:1': '4:1',
    };
    return conversions[ratio] || '1:1';
  }
}
