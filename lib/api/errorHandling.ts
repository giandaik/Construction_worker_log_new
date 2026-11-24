import { NextResponse } from 'next/server'
import { ValidationError } from './validation'

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
    console.error('API Error:', error)

    // Handle validation errors with custom status codes
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

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
