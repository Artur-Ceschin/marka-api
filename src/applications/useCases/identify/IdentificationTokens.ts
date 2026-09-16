import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/kernel/errors/AppError";
import type { Certainty, Location, PlantCandidate } from "@/shared/types/plant";

// Well inside the 7-day lifecycle on uploads/, so a token that is still valid
// always points at an image that still exists.
export const IDENTIFICATION_TTL_SECONDS = 24 * 60 * 60;

export interface IdentificationClaims {
  userId: string;
  // Chosen at identification, so saving the same token twice targets one row.
  detectionId: string;
  key: string;
  candidates: PlantCandidate[];
  certainty: Certainty;
  location?: Location | undefined;
  observedAt?: string | undefined;
  identifiedAt: string;
  expiresAt: number;
}

const invalid = () =>
  new AppError(
    400,
    "INVALID_IDENTIFICATION",
    "This identification is not valid. Identify the photo again",
  );

/**
 * An identification result signed with HMAC-SHA256 — a JWT minus the header,
 * since only this API ever issues or reads one.
 *
 * Nothing is stored between /identify and POST /detections, so the client
 * carries the result back. The signature is what stops it editing the
 * candidate list to get care text written for a species PlantNet never
 * proposed. Signed, not encrypted: the client can read it, which is fine —
 * the /identify response already gave it every field inside.
 */
export class IdentificationTokens {
  constructor(private readonly secret: string) {}

  issue(
    claims: Omit<IdentificationClaims, "expiresAt">,
    now = Date.now(),
  ): string {
    const expiresAt = Math.floor(now / 1000) + IDENTIFICATION_TTL_SECONDS;
    const body = Buffer.from(JSON.stringify({ ...claims, expiresAt })).toString(
      "base64url",
    );

    return `${body}.${this.sign(body)}`;
  }

  read(token: string, userId: string, now = Date.now()): IdentificationClaims {
    const [body, signature, extra] = token.split(".");

    if (!body || !signature || extra !== undefined) {
      throw invalid();
    }

    if (!this.matches(body, signature)) {
      throw invalid();
    }

    const claims = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as IdentificationClaims;

    // Bound to one user: a token lifted from someone else's session is useless.
    if (claims.userId !== userId) {
      throw invalid();
    }

    if (claims.expiresAt * 1000 < now) {
      throw new AppError(
        410,
        "IDENTIFICATION_EXPIRED",
        "This identification has expired. Identify the photo again",
      );
    }

    return claims;
  }

  private sign(body: string): string {
    return createHmac("sha256", this.secret).update(body).digest("base64url");
  }

  // Constant-time: a plain === reveals, through response timing, how many
  // leading characters of a forged signature were right.
  private matches(body: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);

    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
