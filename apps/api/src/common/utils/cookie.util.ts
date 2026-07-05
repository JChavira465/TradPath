import { FastifyReply, FastifyRequest } from "fastify";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

export function setRefreshCookie(reply: FastifyReply, name: string, value: string) {
  reply.setCookie(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    signed: true,
    maxAge: THIRTY_DAYS_SECONDS,
  });
}

export function clearRefreshCookie(reply: FastifyReply, name: string) {
  reply.clearCookie(name, { path: "/" });
}

/** Reads and verifies a signed refresh cookie. Returns undefined if absent or tampered. */
export function readSignedCookie(request: FastifyRequest, name: string): string | undefined {
  const raw = request.cookies?.[name];
  if (!raw) return undefined;
  const result = request.unsignCookie(raw);
  return result.valid ? (result.value ?? undefined) : undefined;
}
