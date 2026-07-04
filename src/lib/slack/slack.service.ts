import type { EventContext } from "@/types/webhook";
import type { SlackMessage, SlackConfig } from "@/lib/slack/slack.types";
import { formatSlackMessage } from "@/lib/slack/formatters";

// =============================================================================
// SlackService
// =============================================================================
//
// The single, reusable service responsible for all Slack communication.
//
// RESPONSIBILITIES:
//   1. Read and validate configuration from environment variables
//   2. Deliver a SlackMessage to Slack's Incoming Webhook endpoint
//   3. Retry transient failures with exponential backoff
//   4. Log every attempt, failure, and success with structured prefixes
//
// HOW SLACK INCOMING WEBHOOKS WORK:
//   - You POST JSON to a URL like: https://hooks.slack.com/services/T.../B.../XXX
//   - No Authorization header — the URL itself is the credential (treat it as a secret)
//   - Slack returns the plain text string "ok" on success
//   - On failure, Slack returns an error string (not JSON): e.g. "invalid_payload"
//
// RETRY STRATEGY:
//   - Retry on: network errors, HTTP 5xx (server-side transient failures)
//   - Never retry on: HTTP 4xx (bad payload — retrying will always fail)
//   - Backoff schedule: 1s → 2s → 4s  (baseMs * 2^(attempt-1))
//   - After all retries exhausted: throws, caller logs to ActionLog as FAILED
// =============================================================================

class SlackService {
  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Build the SlackConfig from environment variables.
   * Throws immediately if SLACK_WEBHOOK_URL is not set — fail fast at call time,
   * not silently later when trying to send.
   */
  private getConfig(): SlackConfig {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error(
        "[SlackService] SLACK_WEBHOOK_URL is not set. " +
        "Add it to your .env file: SLACK_WEBHOOK_URL=https://hooks.slack.com/services/..."
      );
    }

    return {
      webhookUrl,
      maxRetries: parseInt(process.env.SLACK_MAX_RETRIES ?? "3", 10),
      retryBaseMs: parseInt(process.env.SLACK_RETRY_BASE_MS ?? "1000", 10),
    };
  }

  // ---------------------------------------------------------------------------
  // Retry Logic
  // ---------------------------------------------------------------------------

  /** Sleep for `ms` milliseconds. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute `fn` up to `maxAttempts` times with exponential backoff.
   *
   * Retry schedule (default baseMs=1000):
   *   Attempt 1: immediate
   *   Attempt 2: wait 1000ms (1s)
   *   Attempt 3: wait 2000ms (2s)
   *
   * An attempt that throws a `SlackNonRetryableError` is never retried.
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number,
    baseMs: number,
    context: string
  ): Promise<T> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;

        // Non-retryable errors (4xx from Slack) — give up immediately
        if (err instanceof SlackNonRetryableError) {
          console.error(
            `[SlackService] Non-retryable error for "${context}": ${err.message}`
          );
          throw err;
        }

        if (attempt < maxAttempts) {
          const delayMs = baseMs * Math.pow(2, attempt - 1);
          console.warn(
            `[SlackService] Attempt ${attempt}/${maxAttempts} failed for "${context}". ` +
            `Retrying in ${delayMs}ms... Error: ${err.message}`
          );
          await this.sleep(delayMs);
        } else {
          console.error(
            `[SlackService] All ${maxAttempts} attempts failed for "${context}". ` +
            `Final error: ${err.message}`
          );
        }
      }
    }

    throw lastError;
  }

  // ---------------------------------------------------------------------------
  // Core Send
  // ---------------------------------------------------------------------------

  /**
   * Deliver a SlackMessage to the configured webhook URL.
   *
   * Validates the response and classifies errors:
   *   - "ok"           → success
   *   - HTTP 4xx body  → SlackNonRetryableError (not retried)
   *   - HTTP 5xx       → Error (retried)
   *   - Network error  → Error (retried)
   *
   * @param message     - The typed SlackMessage payload to send
   * @param webhookUrl  - Optional override; falls back to SLACK_WEBHOOK_URL env var
   */
  async send(message: SlackMessage, webhookUrl?: string): Promise<void> {
    const config = this.getConfig();
    const url = webhookUrl ?? config.webhookUrl;
    const label = message.text.slice(0, 60);

    await this.withRetry(
      async () => {
        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
          });
        } catch (networkErr: any) {
          // Network-level failure (DNS, timeout, connection refused)
          throw new Error(`Network error sending to Slack: ${networkErr.message}`);
        }

        const body = await res.text();

        if (res.ok && body === "ok") {
          console.log(`[SlackService] ✅ Message delivered: "${label}..."`);
          return;
        }

        // Slack returns 4xx for bad payloads — no point retrying
        if (res.status >= 400 && res.status < 500) {
          throw new SlackNonRetryableError(
            `Slack rejected the payload (${res.status}): "${body}". ` +
            "Check your Block Kit structure or webhook URL."
          );
        }

        // 5xx or unexpected status — retryable
        throw new Error(
          `Slack returned ${res.status}: "${body}"`
        );
      },
      config.maxRetries,
      config.retryBaseMs,
      label
    );
  }

  // ---------------------------------------------------------------------------
  // Event-Aware Convenience Method
  // ---------------------------------------------------------------------------

  /**
   * Format and send a GitHub event as a Slack message.
   *
   * Used by SendSlackStrategy — selects the appropriate Block Kit formatter
   * based on event type, then falls back to template interpolation for
   * unknown event types.
   *
   * @param context  - Immutable event context from the pipeline
   * @param template - User-configured message template (used as fallback text
   *                   and for unknown event types; supports {{field.path}})
   */
  async sendForEvent(context: EventContext, template: string): Promise<void> {
    const message = formatSlackMessage(context, template);
    await this.send(message);
  }
}

// ---------------------------------------------------------------------------
// SlackNonRetryableError
// ---------------------------------------------------------------------------

/**
 * Thrown when Slack returns a 4xx status code.
 * Signals to the retry wrapper that this error should NOT be retried.
 */
export class SlackNonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlackNonRetryableError";
  }
}

// Singleton — one shared instance across the app
export const slackService = new SlackService();
