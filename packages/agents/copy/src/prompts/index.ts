/**
 * S2-C1: Copy Agent Prompt System
 *
 * Exports for the prompt composition system.
 */

export * from './types.js';
export { CopyPromptComposer } from './prompt-composer.js';
export { BrandVoiceLoader } from './brand-voice-loader.js';
export type { MemoryClient } from './brand-voice-loader.js';
export { PromptTemplate, PROMPT_TEMPLATES } from './prompt-template.js';
export {
  getPlatformConfig,
  PLATFORM_CONFIGS,
} from './platform-config.js';
export type { PlatformConfig } from './platform-config.js';
export { getBaseTemplate, BASE_TEMPLATES } from './base-templates.js';
export type { BaseTemplate } from './base-templates.js';
