import crypto from "crypto";
import prisma from "@/lib/prisma";

// =============================================================================
// SECURITY: Signature Verification
// =============================================================================
//
// GitHub signs every webhook request body using HMAC-SHA256 with the repository's
// webhookSecret. The resulting digest is sent in the X-Hub-Signature-256 header
// as "sha256=<hex_digest>".
//
// We MUST use crypto.timingSafeEqual() for comparison — NOT a regular string ===.
//
// WHY? A normal string comparison short-circuits as soon as it finds a
// mismatched character. An attacker can measure these tiny timing differences
// to infer how many characters of the correct signature they've guessed,
// allowing them to reconstruct the secret byte-by-byte. timingSafeEqual always
// takes the same amount of time regardless of where the mismatch is, making
// this attack impossible.
//
// NOTE: rawBody MUST be the original, unmodified bytes from the HTTP request.
// Parsing to JSON first changes whitespace and breaks the HMAC.
// =============================================================================
export function verifySignature(
  secret: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")}`;

  // Both buffers must be the same length for timingSafeEqual to work
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Buffers of different lengths throw — treat as invalid
    return false;
  }
}

// =============================================================================
// Deduplication: Save Webhook Event
// =============================================================================
//
// GitHub guarantees that every delivery has a unique UUID sent in the
// X-GitHub-Delivery header. We store this as a UNIQUE constraint
// (githubDeliveryId) in the WebhookEvent table.
//
// If GitHub retries a failed delivery (e.g., we returned a 5xx), the same
// UUID will be sent again. The Prisma create will throw a P2002 unique
// constraint error. We catch this and return null to signal "already seen".
// The caller must then return 200 OK — this signals GitHub to stop retrying.
// =============================================================================
export async function saveWebhookEvent({
  repositoryId,
  githubDeliveryId,
  event,
  action,
  payload,
}: {
  repositoryId: string;
  githubDeliveryId: string;
  event: string;
  action?: string;
  payload: object;
}) {
  try {
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        githubDeliveryId,
        event,
        action: action ?? null,
        payload,
        status: "PENDING",
        repositoryId,
      },
    });
    return { created: true, webhookEvent };
  } catch (error: any) {
    // P2002 = Prisma unique constraint violation → duplicate delivery
    if (error?.code === "P2002") {
      return { created: false, webhookEvent: null };
    }
    // Any other error is unexpected — rethrow so the caller returns 500
    throw error;
  }
}
