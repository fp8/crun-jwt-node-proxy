interface IErrorOptions {
  cause?: unknown;
  type?: new (message: string, options?: { cause?: unknown }) => Error;
}

/**
 * Designed to be used when an Error is caught.  JS allow you to throw anything so
 * the error caught might not be an instance of error.  Optionally allow you to send
 * a custom error message.
 *
 * If the custom error message ends with a colon, the original error message will be appended.
 *
 * ref: copied from @fp8/gcutils
 *
 * @param message
 * @param options - New signature: options object with error and type properties
 * @param error - Legacy signature: error for backward compatibility
 * @returns
 */
export function createError(
  message: string | unknown,
  options?: IErrorOptions,
): Error {
  // Handle backward compatibility: if options is not an IErrorOptions object, treat it as the old 'error' parameter
  const error = options?.cause;
  const errorType = options?.type ?? Error;

  if (typeof message === 'string') {
    // Error message provided
    if (error === undefined) {
      // This branch shouldn't really be used by the caller.  It works but make no sense
      return new errorType(message);
    } else {
      if (message.endsWith(':')) {
        // If message ends with colon, append the original error message
        if (error instanceof Error) {
          return new errorType(`${message} ${error.message}`, {
            cause: error,
          });
        } else {
          return new errorType(`${message} ${error}`);
        }
      } else {
        // Throw error using message provided and add original error as cause
        return new errorType(message, { cause: error });
      }
    }
  } else {
    // Is message is not a string, ignore the error param
    if (message instanceof Error) {
      if (options?.type) {
        return new errorType(message.message, { cause: message });
      } else {
        return message;
      }
    } else {
      return new errorType(`Unknown error ${message}`);
    }
  }
}

/**
 * A base HTTP Error with status attribute
 */
export class HttpError extends Error {
  // Override cause to be an instance of Error
  public readonly cause: Error | undefined = undefined;

  // HttpStatus
  public readonly status: number;

  constructor(message: string, status: number, cause?: unknown) {
    if (cause instanceof Error) {
      super(message, { cause });
      this.cause = cause;
    } else {
      super(message, { cause });
    }
    this.status = status;
    this.name = HttpError.name;
  }
}

/**
 * Bad request error
 */
export class BadRequestError extends HttpError {
  static status = 400;

  constructor(message: string, cause?: unknown) {
    super(message, BadRequestError.status, cause);
    this.name = BadRequestError.name;
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends HttpError {
  static status = 401;

  constructor(message: string, cause?: unknown) {
    super(message, UnauthorizedError.status, cause);
    this.name = UnauthorizedError.name;
  }
}

/**
 * Internal server error
 */
export class InternalServerError extends HttpError {
  static status = 500;

  constructor(message: string, cause?: unknown) {
    super(message, InternalServerError.status, cause);
    this.name = InternalServerError.name;
  }
}
