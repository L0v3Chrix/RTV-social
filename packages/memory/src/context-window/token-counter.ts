/**
 * Token Counter Implementation
 *
 * Uses estimation by default, with optional tiktoken for accuracy.
 */

import type { TokenCounter } from './types.js';

/**
 * Create a token counter for a specific model
 *
 * Uses character-based estimation by default.
 * For accurate counting, use createTokenCounterAsync with tiktoken.
 */
export function createTokenCounter(model = 'gpt-4'): TokenCounter {
  // Synchronous estimation based on character count
  function estimateTokens(text: string): number {
    // Average: ~4 characters per token for English
    // Adjust for code/special characters which tokenize differently
    const hasCode = /[{}[\]();:=<>]/.test(text);
    const ratio = hasCode ? 3 : 4;
    return Math.ceil(text.length / ratio);
  }

  return {
    model,

    count(text: string): number {
      return estimateTokens(text);
    },

    countMany(texts: string[]): number {
      return texts.reduce((sum, text) => sum + this.count(text), 0);
    },

    estimate(text: string): number {
      return estimateTokens(text);
    },
  };
}

/**
 * Initialize token counter asynchronously with tiktoken (if available)
 *
 * Falls back to estimation if tiktoken is not installed.
 * Install tiktoken for accurate counting: pnpm add tiktoken
 */
export async function createTokenCounterAsync(
  model = 'gpt-4'
): Promise<TokenCounter> {
  try {
    // Try to dynamically import tiktoken using require for better error handling
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const tiktoken = require('tiktoken') as any;
    const { encoding_for_model, get_encoding } = tiktoken;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let encoding: any;
    try {
      encoding = encoding_for_model(model);
    } catch {
      // Fallback to cl100k_base for unknown models
      encoding = get_encoding('cl100k_base');
    }

    const counter: TokenCounter = {
      model,

      count(text: string): number {
        return encoding.encode(text).length;
      },

      countMany(texts: string[]): number {
        return texts.reduce((sum, text) => sum + counter.count(text), 0);
      },

      estimate(text: string): number {
        // Still use estimation for quick checks
        return Math.ceil(text.length / 4);
      },
    };

    return counter;
  } catch {
    // Tiktoken not available, use synchronous fallback
    return createTokenCounter(model);
  }
}
