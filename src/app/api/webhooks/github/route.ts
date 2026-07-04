import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifySignature, saveWebhookEvent } from "@/services/webhook.service";
import { processEvent } from "@/services/event.service";
import { eventBus } from "@/lib/event-bus";

// This is the public endpoint GitHub will POST webhook events to.
// URL format configured on GitHub: https://yourdomain.com/api/webhooks/github
export async function POST(req: NextRequest) {
  // =========================================================================
  // STEP 1: Read the raw body as text BEFORE any JSON parsing.
  //
  // WHY: HMAC-SHA256 is computed against the exact bytes GitHub sent.
  // If we let Next.js parse the body as JSON first, whitespace is normalised
  // and the digest will never match. We must read the raw stream ourselves.
  // =========================================================================
  const rawBody = await req.text();

  // =========================================================================
  // STEP 2: Extract and validate required GitHub webhook headers.
  // =========================================================================
  const signatureHeader = req.headers.get("x-hub-signature-256");
  const githubEvent = req.headers.get("x-github-event");
  const deliveryId = req.headers.get("x-github-delivery");

  if (!signatureHeader || !githubEvent || !deliveryId) {
    // GitHub always sends all three headers. Missing headers means the
    // request is not from GitHub (or is seriously malformed).
    return NextResponse.json(
      { error: "Missing required GitHub webhook headers." },
      { status: 400 }
    );
  }

  // =========================================================================
  // STEP 3: Parse the body and identify the repository.
  //
  // GitHub includes the repository's numeric ID in every event payload.
  // We use this to look up the repository in our database and retrieve
  // the stored webhookSecret for this specific repository.
  // =========================================================================
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const githubRepoId: number | undefined = payload?.repository?.id;
  if (!githubRepoId) {
    return NextResponse.json(
      { error: "Cannot identify repository from payload." },
      { status: 400 }
    );
  }

  const repository = await prisma.repository.findUnique({
    where: { githubId: githubRepoId },
  });

  if (!repository) {
    // The event is for a repo we don't track. Return 404.
    return NextResponse.json(
      { error: "Repository not connected to this bot." },
      { status: 404 }
    );
  }

  // =========================================================================
  // STEP 4: Verify the HMAC-SHA256 signature.
  //
  // We pass:
  //   - repository.webhookSecret: the secret we generated at connect time
  //   - rawBody: the unmodified request body string
  //   - signatureHeader: the "sha256=..." value from GitHub's header
  //
  // If this returns false, the request is forged or the secret is wrong.
  // We return 401 Unauthorized — do NOT return 403 which could leak info.
  // =========================================================================
  const isValid = verifySignature(
    repository.webhookSecret,
    rawBody,
    signatureHeader
  );

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 }
    );
  }

  // =========================================================================
  // STEP 5: Save the event (with deduplication).
  //
  // saveWebhookEvent() attempts a prisma.create(). If the X-GitHub-Delivery
  // UUID already exists (P2002 unique constraint), it returns { created: false }.
  //
  // In that case we return 200 OK — GitHub interprets any 2xx as a success
  // and will stop retrying. Returning 409 Conflict would cause GitHub to
  // keep retrying the event unnecessarily.
  // =========================================================================
  const action: string | undefined = payload?.action;

  const result = await saveWebhookEvent({
    repositoryId: repository.id,
    githubDeliveryId: deliveryId,
    event: githubEvent,
    action,
    payload,
  });

  if (!result.created) {
    // Duplicate delivery — acknowledge it so GitHub stops retrying
    return NextResponse.json(
      { message: "Duplicate event. Already processed." },
      { status: 200 }
    );
  }

  // =========================================================================
  // STEP 6: Trigger the processing pipeline (fire-and-forget).
  //
  // WHY NOT AWAIT? GitHub expects a response within 10 seconds or it marks
  // the delivery as failed and retries. Rule evaluation + action execution
  // (GitHub API calls, Slack messages) can take longer than that.
  //
  // We return 201 immediately and let processEvent() run in the background.
  // Any errors inside processEvent() are caught and logged to the ActionLog
  // table — they never surface to GitHub as a delivery failure.
  // =========================================================================
  if (result.created && result.webhookEvent) {
    // Notify connected SSE clients that a new event arrived (status: PENDING)
    eventBus.emit("webhook-update", { userId: repository.userId });

    processEvent(result.webhookEvent.id).catch((err) => {
      console.error(
        `[WebhookRoute] Pipeline error for event ${result.webhookEvent!.id}:`,
        err
      );
    });
  }

  return NextResponse.json(
    { message: "Webhook received.", eventId: result.webhookEvent?.id },
    { status: 201 }
  );
}
