import { NextResponse } from 'next/server';

import { ApiError, readJsonBody } from '@/lib/api/errorHandling';
import { sendSignupRequestNotificationEmail } from '@/lib/email/sendEmail';
import { signupRequestSchema } from '@/lib/schemas/signupRequestSchema';
import {
  createOrGetPendingSignupRequest,
  markSignupRequestNotificationSent,
} from '@/lib/tenant/signupRequests';
import { consumeRateLimit, getClientIp } from '@/lib/rateLimit';
import { RepositoryFactory } from '@/lib/repositories';

const REQUEST_RATE_LIMIT = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
};

const REQUEST_EMAIL_RATE_LIMIT = {
  limit: 3,
  windowMs: 60 * 60 * 1000,
};

function requestReceived(): NextResponse {
  return NextResponse.json(
    { message: 'Your request has been submitted for review.' },
    { status: 202 },
  );
}

export async function POST(request: Request) {
  try {
    const ipLimit = consumeRateLimit(
      `signup-request:ip:${getClientIp(request)}`,
      REQUEST_RATE_LIMIT,
    );
    if (ipLimit.isLimited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } },
      );
    }

    const body = await readJsonBody(request);
    const parsed = signupRequestSchema.safeParse(body);
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((issue) => issue.message).join(', '));
    }

    const { website, ...input } = parsed.data;
    if (website?.trim()) return requestReceived();

    const emailLimit = consumeRateLimit(
      `signup-request:email:${input.email}`,
      REQUEST_EMAIL_RATE_LIMIT,
    );
    if (emailLimit.isLimited) {
      return NextResponse.json(
        { error: 'Too many requests for this email address. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } },
      );
    }

    const signupRequest = await createOrGetPendingSignupRequest(input);
    if (signupRequest.notificationSentAt) return requestReceived();

    const superAdmins = await RepositoryFactory.withUserRepository((userRepository) =>
      userRepository.findPlatformSuperAdmins(),
    );
    const recipients = Array.from(new Set(
      superAdmins.map((superAdmin) => superAdmin.email.trim()).filter(Boolean),
    ));
    const notificationSent = await sendSignupRequestNotificationEmail({
      recipients,
      requestId: signupRequest._id!.toString(),
      firstName: signupRequest.firstName,
      lastName: signupRequest.lastName,
      email: signupRequest.email,
      organizationName: signupRequest.organizationName,
      message: signupRequest.message,
    });

    if (!notificationSent) {
      return NextResponse.json(
        { error: 'Your request was saved, but the administrators could not be notified. Please try again later.' },
        { status: 503 },
      );
    }

    await markSignupRequestNotificationSent(signupRequest._id!);
    return requestReceived();
  } catch (error) {
    return ApiError.handle(error);
  }
}
