/**
 * S2-C1: Brand Voice Loader
 *
 * Loads brand voice data from external memory.
 */

import { BrandVoice, BrandVoiceSchema } from './types.js';

export interface MemoryClient {
  retrieve(query: { clientId: string; type: string }): Promise<unknown>;
}

const DEFAULT_BRAND_VOICE: BrandVoice = {
  tone: ['professional', 'friendly'],
  personality:
    'A knowledgeable professional who communicates clearly and warmly.',
  vocabulary: {
    preferred: [],
    avoided: [],
    industry: [],
  },
  sentenceStyle:
    'Clear and concise sentences with occasional longer explanatory passages.',
  emojiUsage: 'Minimal and purposeful use of emojis when they add value.',
};

export class BrandVoiceLoader {
  constructor(private memory: MemoryClient) {}

  async loadForClient(clientId: string): Promise<BrandVoice> {
    const raw = await this.memory.retrieve({
      clientId,
      type: 'brand_voice',
    });

    if (!raw) {
      return DEFAULT_BRAND_VOICE;
    }

    const parsed = BrandVoiceSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(
        `Invalid brand voice data for client ${clientId}, using defaults`
      );
      return DEFAULT_BRAND_VOICE;
    }

    return parsed.data;
  }

  static getDefault(): BrandVoice {
    return DEFAULT_BRAND_VOICE;
  }
}
