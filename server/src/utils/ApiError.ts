/**
 * Module purpose: Represents expected HTTP errors with status codes and optional field-level validation details.
 */
export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  statusCode: number;
  errors: FieldError[];

  constructor(statusCode: number, message: string, errors: FieldError[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }

  static badRequest(message = 'Bad request', errors: FieldError[] = []) {
    return new ApiError(400, message, errors);
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }
  static conflict(message = 'Resource already exists') {
    return new ApiError(409, message);
  }
}
