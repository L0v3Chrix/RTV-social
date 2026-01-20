/**
 * Audit Event Framework
 *
 * Provides a simple API for emitting audit events with builder pattern support.
 * All side effects in the system should emit audit events with proof.
 */

import { randomUUID } from 'crypto';
import { getCurrentSpan } from './tracing.js';
import { createModuleLogger } from './logging.js';

const logger = createModuleLogger('audit');

/**
 * Actor types that can perform actions
 */
export type AuditActorType = 'user' | 'agent' | 'system' | 'webhook';

/**
 * Outcome of an audited action
 */
export type AuditOutcome = 'success' | 'failure' | 'partial' | 'pending';

/**
 * Proof attachment for an audit event
 */
export interface AuditProof {
  type: 'screenshot' | 'api_response' | 'hash' | 'url' | 'none';
  data?: Record<string, unknown>;
  url?: string;
  hash?: string;
  capturedAt?: string;
}

/**
 * Input for creating an audit event
 */
export interface AuditEventInput {
  clientId: string;
  actionType: string;
  actorType: AuditActorType;
  actorId: string;
  targetType: string;
  targetId: string;
  outcome: AuditOutcome;
  proof?: AuditProof;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Result from emitting an audit event
 */
export interface AuditEventResult {
  id: string;
  createdAt: Date;
}

/**
 * Internal state for the builder pattern
 */
interface BuilderState {
  clientId?: string;
  actionType?: string;
  actorType?: AuditActorType;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  outcome?: AuditOutcome;
  proof?: AuditProof;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * AuditEmitter class with builder pattern support
 *
 * Usage with direct emit:
 * ```typescript
 * const emitter = createAuditEmitter();
 * await emitter.emit({
 *   clientId: 'client-123',
 *   actionType: 'post.publish',
 *   actorType: 'agent',
 *   actorId: 'agent-456',
 *   targetType: 'post',
 *   targetId: 'post-789',
 *   outcome: 'success',
 * });
 * ```
 *
 * Usage with builder pattern:
 * ```typescript
 * const emitter = createAuditEmitter();
 * await emitter
 *   .forClient('client-123')
 *   .action('post.publish')
 *   .actor('agent', 'agent-456')
 *   .target('post', 'post-789')
 *   .succeeded()
 *   .withApiProof({ response: { id: 'fb-123' } })
 *   .emit();
 * ```
 */
export class AuditEmitter {
  private state: BuilderState = {};

  /**
   * Reset the builder state
   */
  private reset(): void {
    this.state = {};
  }

  /**
   * Get correlation ID from trace context or state
   */
  private getCorrelationId(): string | undefined {
    if (this.state.correlationId) {
      return this.state.correlationId;
    }

    const span = getCurrentSpan();
    if (span) {
      return span.spanContext().traceId;
    }

    return undefined;
  }

  /**
   * Direct emit method for audit events
   */
  async emit(event?: AuditEventInput): Promise<AuditEventResult> {
    const input = event || this.buildInput();

    // Validate required fields
    if (!input.clientId) throw new Error('clientId is required');
    if (!input.actionType) throw new Error('actionType is required');
    if (!input.actorType) throw new Error('actorType is required');
    if (!input.actorId) throw new Error('actorId is required');
    if (!input.targetType) throw new Error('targetType is required');
    if (!input.targetId) throw new Error('targetId is required');
    if (!input.outcome) throw new Error('outcome is required');

    const id = randomUUID();
    const createdAt = new Date();
    const correlationId = input.correlationId || this.getCorrelationId();

    // Log the audit event
    logger.info(
      {
        auditEventId: id,
        clientId: input.clientId,
        actionType: input.actionType,
        actorType: input.actorType,
        actorId: input.actorId,
        targetType: input.targetType,
        targetId: input.targetId,
        outcome: input.outcome,
        correlationId,
        proof: input.proof?.type || 'none',
        metadata: input.metadata,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      },
      `Audit: ${input.actionType} by ${input.actorType}:${input.actorId} on ${input.targetType}:${input.targetId} - ${input.outcome}`
    );

    // Reset builder state after emit
    this.reset();

    return { id, createdAt };
  }

  /**
   * Build input from builder state
   */
  private buildInput(): AuditEventInput {
    const input: AuditEventInput = {
      clientId: this.state.clientId || '',
      actionType: this.state.actionType || '',
      actorType: this.state.actorType || 'system',
      actorId: this.state.actorId || '',
      targetType: this.state.targetType || '',
      targetId: this.state.targetId || '',
      outcome: this.state.outcome || 'pending',
    };

    // Only add optional properties if they have values
    if (this.state.proof !== undefined) {
      input.proof = this.state.proof;
    }
    if (this.state.metadata !== undefined) {
      input.metadata = this.state.metadata;
    }
    if (this.state.correlationId !== undefined) {
      input.correlationId = this.state.correlationId;
    }
    if (this.state.errorCode !== undefined) {
      input.errorCode = this.state.errorCode;
    }
    if (this.state.errorMessage !== undefined) {
      input.errorMessage = this.state.errorMessage;
    }

    return input;
  }

  // ========== Builder Methods ==========

  /**
   * Set the client ID for tenant scoping
   */
  forClient(clientId: string): this {
    this.state.clientId = clientId;
    return this;
  }

  /**
   * Set the action type (e.g., 'post.publish', 'comment.reply')
   */
  action(actionType: string): this {
    this.state.actionType = actionType;
    return this;
  }

  /**
   * Set the actor performing the action
   */
  actor(type: AuditActorType, id: string): this {
    this.state.actorType = type;
    this.state.actorId = id;
    return this;
  }

  /**
   * Set the target of the action
   */
  target(type: string, id: string): this {
    this.state.targetType = type;
    this.state.targetId = id;
    return this;
  }

  /**
   * Mark the action as succeeded
   */
  succeeded(): this {
    this.state.outcome = 'success';
    return this;
  }

  /**
   * Mark the action as failed
   */
  failed(errorCode?: string, errorMessage?: string): this {
    this.state.outcome = 'failure';
    if (errorCode !== undefined) {
      this.state.errorCode = errorCode;
    }
    if (errorMessage !== undefined) {
      this.state.errorMessage = errorMessage;
    }
    return this;
  }

  /**
   * Mark the action as partially completed
   */
  partial(): this {
    this.state.outcome = 'partial';
    return this;
  }

  /**
   * Mark the action as pending
   */
  pending(): this {
    this.state.outcome = 'pending';
    return this;
  }

  /**
   * Attach proof to the audit event
   */
  withProof(proof: AuditProof): this {
    this.state.proof = proof;
    return this;
  }

  /**
   * Attach API response proof
   */
  withApiProof(data: Record<string, unknown>): this {
    this.state.proof = {
      type: 'api_response',
      data,
      capturedAt: new Date().toISOString(),
    };
    return this;
  }

  /**
   * Attach screenshot proof
   */
  withScreenshotProof(url: string): this {
    this.state.proof = {
      type: 'screenshot',
      url,
      capturedAt: new Date().toISOString(),
    };
    return this;
  }

  /**
   * Add metadata to the audit event
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.state.metadata = { ...this.state.metadata, ...metadata };
    return this;
  }

  /**
   * Set explicit correlation ID (overrides trace context)
   */
  withCorrelation(correlationId: string): this {
    this.state.correlationId = correlationId;
    return this;
  }
}

// ========== Singleton Management ==========

let defaultEmitter: AuditEmitter | null = null;

/**
 * Create a new AuditEmitter instance
 */
export function createAuditEmitter(): AuditEmitter {
  return new AuditEmitter();
}

/**
 * Get or create the default AuditEmitter instance
 */
export function getAuditEmitter(): AuditEmitter {
  if (!defaultEmitter) {
    defaultEmitter = createAuditEmitter();
  }
  return defaultEmitter;
}

/**
 * Emit an audit event using the default emitter
 */
export async function emitAuditEvent(event: AuditEventInput): Promise<AuditEventResult> {
  return getAuditEmitter().emit(event);
}

/**
 * Convenience function to get a fresh emitter for building
 *
 * Usage:
 * ```typescript
 * await audit()
 *   .forClient('client-123')
 *   .action('post.publish')
 *   .actor('agent', 'agent-456')
 *   .target('post', 'post-789')
 *   .succeeded()
 *   .emit();
 * ```
 */
export function audit(): AuditEmitter {
  return createAuditEmitter();
}
