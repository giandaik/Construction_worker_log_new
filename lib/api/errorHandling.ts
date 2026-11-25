import { NextResponse } from 'next/server'
import { ValidationError } from './validation'

/**
 * Reads a JSON request body, turning a malformed or empty body into a 400.
 *
 * `request.json()` throws a SyntaxError on an empty or truncated body, and every
 * route's catch reports that as 500 — a client mistake logged as a server fault.
 */
export async function readJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  // Some callers (and the route tests) hand in a minimal object that only has
  // `json()`. Use it when the full Request API is not there.
  if (typeof (request as { text?: unknown }).text !== 'function') {
    return (await (request as unknown as { json: () => Promise<T> }).json()) as T
  }
  const text = await request.text()
  if (!text.trim()) throw new ValidationError('Request body must be valid JSON')
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ValidationError('Request body must be valid JSON')
  }
}

/**
 * Centralized API error handling utility
 * Provides consistent error responses across all API routes
 */
export class ApiError {
  /**
   * Generic error handler for API routes
   * Automatically handles different error types and returns appropriate responses
   */
  static handle(error: unknown): NextResponse {
    // A ValidationError is a client mistake answered with a 4xx. Logging it as
    // "API Error" turned expected refusals into stack traces and buried the ones
    // that really were server faults.
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

    console.error('API Error:', error)
    // Handle standard JavaScript errors
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Handle unknown error types
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }

  /**
   * Returns a standardized 404 not found response
   */
  static notFound(resource: string): NextResponse {
    return NextResponse.json(
      { error: `${resource} not found` },
      { status: 404 }
    )
  }

  /**
   * Returns a standardized success response
   */
  static success<T>(data: T, status: number = 200): NextResponse {
    return NextResponse.json(data, { status })
  }

  /**
   * Returns a standardized 400 bad request response
   */
  static badRequest(message: string): NextResponse {
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }

  /**
   * Returns a standardized 401 unauthorized response
   */
  static unauthorized(message: string = 'Unauthorized'): NextResponse {
    return NextResponse.json(
      { error: message },
      { status: 401 }
    )
  }

  /**
   * Returns a standardized 403 forbidden response
   */
  static forbidden(message: string = 'Forbidden'): NextResponse {
    return NextResponse.json(
      { error: message },
      { status: 403 }
    )
  }

  /**
   * Returns a standardized 409 conflict response.
   *
   * For a request that is well-formed and authenticated but contradicts the
   * current state — a replayed "end impersonation", say.
   */
  static conflict(message: string): NextResponse {
    return NextResponse.json(
      { error: message },
      { status: 409 }
    )
  }
}
