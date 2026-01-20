/**
 * S2-C1: Prompt Template Engine
 *
 * Variable interpolation and conditional sections for prompts.
 */

export class PromptTemplate {
  constructor(private template: string) {}

  render(variables: Record<string, string | undefined>): string {
    let result = this.template;

    // Handle conditionals: {{#if variable}}content{{/if}}
    result = this.processConditionals(result, variables);

    // Handle variable interpolation: {{variable}}
    result = this.processVariables(result, variables);

    return result;
  }

  private processConditionals(
    template: string,
    variables: Record<string, string | undefined>
  ): string {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

    return template.replace(conditionalRegex, (_match, varName, content) => {
      const value = variables[varName];
      if (value !== undefined && value !== null && value !== '') {
        // Process variables within the conditional content
        return this.processVariables(content, variables);
      }
      return '';
    });
  }

  private processVariables(
    template: string,
    variables: Record<string, string | undefined>
  ): string {
    const variableRegex = /\{\{(\w+)\}\}/g;

    return template.replace(variableRegex, (match, varName) => {
      const value = variables[varName];
      return value !== undefined ? value : match;
    });
  }
}

// Pre-defined templates for common use cases
export const PROMPT_TEMPLATES = {
  captionRequest: new PromptTemplate(
    'Write a {{platform}} caption about {{topic}}{{#if style}} in a {{style}} style{{/if}}.'
  ),
  hookRequest: new PromptTemplate(
    'Create a hook for a {{platform}} {{contentType}} about {{topic}}.'
  ),
  ctaRequest: new PromptTemplate(
    'Write a CTA for {{platform}} that drives {{action}}{{#if offer}} for the offer: {{offer}}{{/if}}.'
  ),
};
