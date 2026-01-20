/**
 * Client Entity Error Classes
 *
 * Custom error types for Client domain operations.
 */

/**
 * Base class for all client-related errors
 */
export class ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientError';
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a client is not found
 */
export class ClientNotFoundError extends ClientError {
  public readonly clientId: string;

  constructor(clientId: string) {
    super(`Client not found: ${clientId}`);
    this.name = 'ClientNotFoundError';
    this.clientId = clientId;
  }
}

/**
 * Error thrown when attempting to create a client with a duplicate name
 */
export class DuplicateClientNameError extends ClientError {
  public readonly name_: string;

  constructor(name: string) {
    super(`A client with the name "${name}" already exists`);
    this.name = 'DuplicateClientNameError';
    this.name_ = name;
  }
}

/**
 * Error thrown when attempting to create a client with a duplicate slug
 */
export class DuplicateClientSlugError extends ClientError {
  public readonly slug: string;

  constructor(slug: string) {
    super(`A client with the slug "${slug}" already exists`);
    this.name = 'DuplicateClientSlugError';
    this.slug = slug;
  }
}

/**
 * Error thrown when an invalid status transition is attempted
 */
export class InvalidClientStatusError extends ClientError {
  public readonly currentStatus: string;
  public readonly targetStatus: string;

  constructor(currentStatus: string, targetStatus: string) {
    super(`Cannot transition client from "${currentStatus}" to "${targetStatus}"`);
    this.name = 'InvalidClientStatusError';
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
  }
}

/**
 * Error thrown when validation fails
 */
export class ClientValidationError extends ClientError {
  public readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>) {
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ');
    super(`Client validation failed: ${errorMessages}`);
    this.name = 'ClientValidationError';
    this.errors = errors;
  }
}
