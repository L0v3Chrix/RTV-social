/**
 * S2-C1: Prompt Composer
 *
 * Composes multi-layered prompts for copy generation.
 */

import type {
  CopyContext,
  ComposedPrompt,
  PromptLayer,
  BrandVoice,
  CopyConstraints,
  Platform,
  CopyType,
} from './types.js';
import { getBaseTemplate } from './base-templates.js';
import { getPlatformConfig } from './platform-config.js';

export class CopyPromptComposer {
  private layers: PromptLayer[] = [];

  compose(context: CopyContext): ComposedPrompt {
    this.layers = [];

    // Layer 1: Base instructions
    this.addBaseLayer(context.copyType);

    // Layer 2: Brand voice (if provided)
    if (context.brandVoice) {
      this.addBrandLayer(context.brandVoice);
    }

    // Layer 3: Platform specifics
    this.addPlatformLayer(context.platform);

    // Layer 4: Campaign context (if provided)
    if (context.campaign) {
      this.addCampaignLayer(context.campaign);
    }

    // Layer 5: Constraints
    if (context.constraints) {
      this.addConstraintLayer(context.constraints);
    }

    // Layer 6: Output format
    this.addOutputFormatLayer(context.outputFormat || 'text');

    // Compose final prompt
    return this.buildPrompt(context);
  }

  private addBaseLayer(copyType: CopyType): void {
    const template = getBaseTemplate(copyType);

    const content = `
## Role
${template.role}

## Task
${template.task}

## Core Guidelines
${template.guidelines.map((g) => `- ${g}`).join('\n')}
`;

    this.layers.push({
      name: 'base',
      priority: 1,
      content,
    });
  }

  private addBrandLayer(voice: BrandVoice): void {
    const toneList = voice.tone.join(', ');
    const preferredWords = voice.vocabulary.preferred.join(', ');
    const avoidedWords = voice.vocabulary.avoided.join(', ');
    const industryTerms = voice.vocabulary.industry.join(', ');

    const content = `
## Brand Voice

### Tone
Write with a ${toneList} tone throughout.

### Personality
${voice.personality}

### Vocabulary Guidelines
**PREFER these words/phrases:** ${preferredWords || 'No specific preferences'}
**AVOID these words/phrases:** ${avoidedWords || 'No specific restrictions'}
**Industry terms to use naturally:** ${industryTerms || 'None specified'}

### Writing Style
${voice.sentenceStyle}

### Emoji Usage
${voice.emojiUsage}
`;

    this.layers.push({
      name: 'brand',
      priority: 2,
      content,
    });
  }

  private addPlatformLayer(platform: Platform): void {
    const config = getPlatformConfig(platform);

    const content = `
## Platform: ${config.name}

### Platform Characteristics
${config.characteristics.map((c) => `- ${c}`).join('\n')}

### Audience Expectations on ${config.name}
${config.audienceExpectations.map((e) => `- ${e}`).join('\n')}

### Best Practices
${config.bestPractices.map((p) => `- ${p}`).join('\n')}

### Technical Limits
- Maximum caption length: ${config.captionMaxLength} characters
- Maximum hashtags: ${config.hashtagLimit}
- Link handling: ${config.linkBehavior === 'in_bio' ? 'Direct viewers to link in bio' : 'Links can be included inline'}
`;

    this.layers.push({
      name: 'platform',
      priority: 3,
      content,
    });
  }

  private addCampaignLayer(campaign: {
    name: string;
    objective: string;
    keyMessages: string[];
  }): void {
    const content = `
## Campaign Context

### Campaign: ${campaign.name}
**Objective:** ${campaign.objective}

### Key Messages to Incorporate
${campaign.keyMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Weave these messages naturally into the copy without being overtly promotional.
`;

    this.layers.push({
      name: 'campaign',
      priority: 4,
      content,
    });
  }

  private addConstraintLayer(constraints: CopyConstraints): void {
    const parts: string[] = ['## Constraints'];

    if (constraints.maxLength) {
      parts.push(`- Maximum length: ${constraints.maxLength} characters`);
    }
    if (constraints.minLength) {
      parts.push(`- Minimum length: ${constraints.minLength} characters`);
    }
    if (constraints.hashtagCount) {
      parts.push(
        `- Hashtag count: between ${constraints.hashtagCount.min} and ${constraints.hashtagCount.max}`
      );
    }
    if (constraints.mustInclude?.length) {
      parts.push(`- MUST include: ${constraints.mustInclude.join(', ')}`);
    }
    if (constraints.mustAvoid?.length) {
      parts.push(`- MUST NOT include: ${constraints.mustAvoid.join(', ')}`);
    }
    if (constraints.compliance?.length) {
      parts.push('\n### Compliance Requirements');
      constraints.compliance.forEach((c) => parts.push(`- ${c}`));
    }

    this.layers.push({
      name: 'constraints',
      priority: 5,
      content: parts.join('\n'),
    });
  }

  private addOutputFormatLayer(format: 'text' | 'json'): void {
    let content: string;

    if (format === 'json') {
      content = `
## Output Format
Respond with valid JSON in the following structure:
{
  "copy": "The generated copy text",
  "hashtags": ["array", "of", "hashtags"],
  "characterCount": 123,
  "alternateVersions": ["optional alternate version"]
}
`;
    } else {
      content = `
## Output Format
Provide only the final copy text, ready to use. Do not include explanations or alternatives unless specifically requested.
`;
    }

    this.layers.push({
      name: 'output',
      priority: 6,
      content,
    });
  }

  private buildPrompt(context: CopyContext): ComposedPrompt {
    // Sort layers by priority
    const sortedLayers = [...this.layers].sort(
      (a, b) => a.priority - b.priority
    );

    // Build system prompt
    const systemPrompt = sortedLayers.map((l) => l.content).join('\n\n---\n');

    // Build user prompt
    const userPrompt = this.buildUserPrompt(context);

    return {
      system: systemPrompt,
      user: userPrompt,
      model: this.selectModel(context),
      temperature: this.selectTemperature(context),
      maxTokens: this.calculateMaxTokens(context),
    };
  }

  private buildUserPrompt(context: CopyContext): string {
    const parts: string[] = [];

    parts.push(`Write a ${context.copyType} for ${context.platform}.`);

    if (context.topic) {
      parts.push(`\nTopic: ${context.topic}`);
    }

    if (context.contentDescription) {
      parts.push(`\nContent Description: ${context.contentDescription}`);
    }

    return parts.join('\n');
  }

  private selectModel(context: CopyContext): string {
    // Use GPT-4o for complex copy, 4o-mini for simpler tasks
    const complexTypes: CopyType[] = ['caption', 'bio', 'dm_response'];
    return complexTypes.includes(context.copyType) ? 'gpt-4o' : 'gpt-4o-mini';
  }

  private selectTemperature(context: CopyContext): number {
    // Higher temperature for creative copy, lower for replies
    const creativeTypes: CopyType[] = ['hook', 'headline', 'caption'];
    return creativeTypes.includes(context.copyType) ? 0.8 : 0.6;
  }

  private calculateMaxTokens(context: CopyContext): number {
    const config = getPlatformConfig(context.platform);
    // Estimate: 1 token ≈ 4 characters, add buffer
    return Math.ceil(
      (context.constraints?.maxLength || config.captionMaxLength) / 3
    );
  }
}

// Re-export types for convenience
export type { PromptLayer, ComposedPrompt } from './types.js';
