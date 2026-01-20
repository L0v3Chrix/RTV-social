/**
 * Context Window Implementation
 *
 * Manages content fitting into LLM context windows.
 */

import type {
  ContextWindow,
  ContextWindowConfig,
  ContextSection,
  AddSectionResult,
  BudgetAllocation,
  AllocationRatios,
  TruncationOptions,
  ComposeOptions,
  ComposedResult,
  WindowSnapshot,
  TokenCounter,
} from './types.js';

/**
 * Create a new Context Window
 */
export function createContextWindow(config: ContextWindowConfig): ContextWindow {
  const sections = new Map<string, ContextSection>();
  let usedTokens = 0;

  const availableTokens = config.maxTokens - config.reservedForResponse;

  function calculateTokens(content: string): number {
    return config.tokenCounter.count(content);
  }

  function getSortedSections(): ContextSection[] {
    return Array.from(sections.values()).sort((a, b) => b.priority - a.priority);
  }

  // Helper to find sections to evict
  function tryEvictForSpace(
    neededTokens: number,
    minPriority: number,
    excludeId: string
  ): string[] {
    const candidates = getSortedSections()
      .filter((s) => s.id !== excludeId && s.priority < minPriority)
      .reverse(); // Lowest priority first

    const toEvict: string[] = [];
    let freedTokens = 0;

    for (const section of candidates) {
      toEvict.push(section.id);
      freedTokens += section.tokenCount ?? 0;

      if (freedTokens >= neededTokens) {
        break;
      }
    }

    return freedTokens >= neededTokens ? toEvict : [];
  }

  const window: ContextWindow = {
    config,

    // Section management
    addSection(section: ContextSection): AddSectionResult {
      const tokenCount = section.tokenCount ?? calculateTokens(section.content);
      const sectionWithTokens = { ...section, tokenCount };

      // Check if replacing existing section
      const existing = sections.get(section.id);
      const existingTokens = existing?.tokenCount ?? 0;

      const netTokens = tokenCount - existingTokens;
      const wouldExceed = usedTokens + netTokens > availableTokens;

      if (wouldExceed) {
        // Try to evict lower priority sections if allowed
        if (section.evictLowerPriority) {
          const evicted = tryEvictForSpace(
            netTokens,
            section.priority,
            section.id
          );

          if (evicted.length > 0) {
            // Remove evicted sections
            for (const id of evicted) {
              const evictedSection = sections.get(id);
              if (evictedSection) {
                usedTokens -= evictedSection.tokenCount ?? 0;
                sections.delete(id);
              }
            }

            // Now add the section
            sections.set(section.id, sectionWithTokens);
            usedTokens += tokenCount;

            return {
              added: true,
              tokenCount,
              evicted,
            };
          }
        }

        return {
          added: false,
          tokenCount,
          reason: `Would exceed budget: need ${netTokens}, have ${availableTokens - usedTokens}`,
        };
      }

      // Update tokens if replacing
      if (existing) {
        usedTokens -= existingTokens;
      }

      sections.set(section.id, sectionWithTokens);
      usedTokens += tokenCount;

      return {
        added: true,
        tokenCount,
      };
    },

    removeSection(id: string): boolean {
      const section = sections.get(id);
      if (!section) return false;

      usedTokens -= section.tokenCount ?? 0;
      sections.delete(id);
      return true;
    },

    getSection(id: string): ContextSection | null {
      return sections.get(id) ?? null;
    },

    getSections(): ContextSection[] {
      return getSortedSections();
    },

    clearSections(): void {
      sections.clear();
      usedTokens = 0;
    },

    // Budget
    getRemainingTokens(): number {
      return availableTokens - usedTokens;
    },

    getUsedTokens(): number {
      return usedTokens;
    },

    allocateBudget(ratios: AllocationRatios): BudgetAllocation {
      const totalRatio = Object.values(ratios).reduce<number>((sum, r) => sum + (r ?? 0), 0);

      if (totalRatio > 1.01) {
        throw new Error(`Budget ratios exceed 100%: ${(totalRatio * 100).toFixed(1)}%`);
      }

      const allocation: BudgetAllocation = {
        system: 0,
        conversation: 0,
        retrieved: 0,
        tool_result: 0,
        instruction: 0,
        response: config.reservedForResponse,
      };

      for (const [key, ratio] of Object.entries(ratios)) {
        if (key === 'response') {
          allocation.response = Math.floor(config.maxTokens * (ratio ?? 0));
        } else {
          allocation[key] = Math.floor(config.maxTokens * (ratio ?? 0));
        }
      }

      return allocation;
    },

    fitToAllocation(
      content: string,
      category: keyof BudgetAllocation,
      allocation: BudgetAllocation
    ): string {
      const maxTokens = allocation[category];
      if (!maxTokens) return content;

      const currentTokens = calculateTokens(content);
      if (currentTokens <= maxTokens) return content;

      return window.truncateToFit(content, maxTokens);
    },

    // Truncation
    truncateToFit(
      content: string,
      maxTokens: number,
      options?: TruncationOptions
    ): string {
      const strategy = options?.strategy ?? config.defaultTruncation ?? 'end';
      const suffix = options?.suffix ?? '...';

      const currentTokens = calculateTokens(content);
      if (currentTokens <= maxTokens) return content;

      switch (strategy) {
        case 'end':
          return truncateFromEnd(content, maxTokens, suffix, config.tokenCounter);

        case 'sentence':
          return truncateBySentence(content, maxTokens, suffix, config.tokenCounter);

        case 'middle':
          return truncateFromMiddle(
            content,
            maxTokens,
            options?.startRatio ?? 0.6,
            config.tokenCounter
          );

        case 'paragraph':
          return truncateByParagraph(content, maxTokens, suffix, config.tokenCounter);

        default:
          return truncateFromEnd(content, maxTokens, suffix, config.tokenCounter);
      }
    },

    // Composition
    compose(options?: ComposeOptions): string {
      const separator = options?.separator ?? '\n\n';
      const sorted = options?.order
        ? options.order
            .map((id) => sections.get(id))
            .filter((s): s is ContextSection => s !== undefined)
        : getSortedSections();

      const parts: string[] = [];

      for (const section of sorted) {
        if (options?.includeHeaders) {
          parts.push(`[${section.type.toUpperCase()}: ${section.id}]`);
        }
        parts.push(section.content);
      }

      return parts.join(separator);
    },

    composeWithMetadata(options?: ComposeOptions): ComposedResult {
      const content = window.compose(options);

      return {
        content,
        totalTokens: usedTokens,
        sectionCount: sections.size,
        remainingForResponse: config.reservedForResponse,
        truncatedSections: [], // Would track if we added truncation tracking
        evictedSections: [],
      };
    },

    // Snapshot
    snapshot(): WindowSnapshot {
      return {
        sections: Array.from(sections.values()),
        usedTokens,
        createdAt: new Date(),
      };
    },

    restore(snapshot: WindowSnapshot): void {
      sections.clear();
      for (const section of snapshot.sections) {
        sections.set(section.id, section);
      }
      usedTokens = snapshot.usedTokens;
    },
  };

  return window;
}

// =====================
// Truncation Helpers
// =====================

function truncateFromEnd(
  content: string,
  maxTokens: number,
  suffix: string,
  counter: TokenCounter
): string {
  const suffixTokens = counter.count(suffix);
  const targetTokens = maxTokens - suffixTokens;

  // Binary search for optimal cut point
  let low = 0;
  let high = content.length;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const slice = content.slice(0, mid);
    const tokens = counter.count(slice);

    if (tokens <= targetTokens) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return content.slice(0, low) + suffix;
}

function truncateBySentence(
  content: string,
  maxTokens: number,
  suffix: string,
  counter: TokenCounter
): string {
  const sentences = content.match(/[^.!?]+[.!?]+/g) ?? [content];
  const suffixTokens = counter.count(suffix);
  const targetTokens = maxTokens - suffixTokens;

  let result = '';
  let tokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = counter.count(sentence);
    if (tokens + sentenceTokens > targetTokens) break;

    result += sentence;
    tokens += sentenceTokens;
  }

  if (result.length < content.length) {
    result += suffix;
  }

  return result || content.slice(0, 100) + suffix;
}

function truncateFromMiddle(
  content: string,
  maxTokens: number,
  startRatio: number,
  counter: TokenCounter
): string {
  const ellipsis = ' [...] ';
  const ellipsisTokens = counter.count(ellipsis);
  const targetTokens = maxTokens - ellipsisTokens;

  const startTokens = Math.floor(targetTokens * startRatio);
  const endTokens = targetTokens - startTokens;

  // Find start portion using binary search
  const startEnd = findCutPoint(content, startTokens, counter);

  // Find end portion
  const endStart = content.length - findCutPoint(reverseString(content), endTokens, counter);

  if (startEnd >= endStart) {
    // Content fits
    return content;
  }

  return content.slice(0, startEnd) + ellipsis + content.slice(endStart);
}

function truncateByParagraph(
  content: string,
  maxTokens: number,
  suffix: string,
  counter: TokenCounter
): string {
  const paragraphs = content.split(/\n\n+/);
  const suffixTokens = counter.count(suffix);
  const targetTokens = maxTokens - suffixTokens;

  let result = '';
  let tokens = 0;

  for (const para of paragraphs) {
    const paraTokens = counter.count(para + '\n\n');
    if (tokens + paraTokens > targetTokens) break;

    result += para + '\n\n';
    tokens += paraTokens;
  }

  if (result.length < content.length) {
    result = result.trimEnd() + suffix;
  }

  return result || content.slice(0, 100) + suffix;
}

function findCutPoint(content: string, targetTokens: number, counter: TokenCounter): number {
  let low = 0;
  let high = content.length;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const slice = content.slice(0, mid);
    const tokens = counter.count(slice);

    if (tokens <= targetTokens) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

function reverseString(str: string): string {
  return str.split('').reverse().join('');
}
