/**
 * S2-C1: Base Templates
 *
 * Base prompt templates for each copy type.
 */

import type { CopyType } from './types.js';

export interface BaseTemplate {
  role: string;
  task: string;
  guidelines: string[];
  outputFormat: string;
}

export const BASE_TEMPLATES: Record<CopyType, BaseTemplate> = {
  caption: {
    role: 'You are an expert social media copywriter who creates engaging, on-brand captions that drive action.',
    task: 'Write a social media caption that captures attention, delivers value, and encourages engagement.',
    guidelines: [
      'Open with a hook that stops the scroll',
      'Deliver value or evoke emotion in the body',
      'End with a clear call-to-action',
      'Use line breaks for readability',
      "Match the platform's native style",
    ],
    outputFormat:
      'Provide the caption text only, formatted for the platform.',
  },
  hook: {
    role: 'You are a master of attention-grabbing hooks that stop scrollers in their tracks.',
    task: 'Create an opening hook (first 1-3 seconds equivalent in text) that makes viewers need to see more.',
    guidelines: [
      'Create immediate curiosity or intrigue',
      'Use pattern interrupts',
      'Promise value or revelation',
      'Keep it under 10 words when possible',
      'Make it specific, not generic',
    ],
    outputFormat: 'Provide only the hook text, nothing else.',
  },
  cta: {
    role: 'You are a conversion-focused copywriter specializing in calls-to-action that drive specific user behavior.',
    task: 'Write a compelling call-to-action that motivates the reader to take the next step.',
    guidelines: [
      'Be specific about the action',
      'Create urgency when appropriate',
      'Highlight the benefit of taking action',
      'Remove friction and objections',
      'Use active, commanding verbs',
    ],
    outputFormat: 'Provide the CTA text only.',
  },
  headline: {
    role: 'You are a headline specialist who creates curiosity-driving titles that demand clicks.',
    task: 'Write a headline that captures attention and promises value.',
    guidelines: [
      'Use numbers or specific data when relevant',
      'Create a curiosity gap',
      'Promise a clear benefit',
      'Keep under 60 characters for most platforms',
      'Avoid clickbait that under-delivers',
    ],
    outputFormat: 'Provide the headline only.',
  },
  bio: {
    role: 'You are a personal branding expert who crafts bios that establish authority and drive action.',
    task: 'Write a bio that communicates value, builds trust, and encourages follow/connection.',
    guidelines: [
      'Lead with the transformation you provide',
      'Include social proof if available',
      'Mention your unique angle',
      'Include relevant keywords',
      'End with a CTA or where to find you',
    ],
    outputFormat:
      'Provide the bio text formatted for the platform character limit.',
  },
  comment_reply: {
    role: 'You are a community manager skilled at turning comments into meaningful conversations and relationships.',
    task: 'Write a reply to a comment that builds connection and encourages further engagement.',
    guidelines: [
      'Acknowledge the commenter personally',
      'Add value beyond just "thanks"',
      'Ask a follow-up question when appropriate',
      'Keep the brand voice consistent',
      'Never be defensive or dismissive',
    ],
    outputFormat: 'Provide the reply text only.',
  },
  dm_response: {
    role: 'You are a relationship-focused communicator who turns DMs into meaningful conversations.',
    task: 'Write a direct message response that builds trust and moves the conversation forward.',
    guidelines: [
      'Be personal and conversational',
      'Answer questions directly',
      'Provide value without being salesy',
      'Include a soft next step',
      'Respect their time',
    ],
    outputFormat: 'Provide the DM response only.',
  },
};

export function getBaseTemplate(copyType: CopyType): BaseTemplate {
  return BASE_TEMPLATES[copyType];
}
