import type { IActionStrategy } from "@/lib/actions/base.action";
import type { EventContext } from "@/types/webhook";
import { slackService } from "@/lib/slack/slack.service";

// =============================================================================
// SendSlackStrategy (refactored)
// =============================================================================
//
// This strategy is now a thin adapter between the action pipeline and the
// SlackService. All complexity (retry logic, Block Kit formatting, error
// classification) lives in SlackService and its formatters.
//
// actionPayload shape: { message: string }
//
//   `message` is a template string supporting {{field.path}} interpolation:
//   Example: "PR {{pull_request.number}} opened by {{sender.login}}"
//
//   For known event types (pull_request, issues, push), the SlackService
//   overrides the raw text with a rich Block Kit layout. The template is
//   still used as the notification preview text ("fallback").
// =============================================================================

export class SendSlackStrategy implements IActionStrategy {
  readonly actionType = "send_slack_message";

  async execute(
    context: EventContext,
    actionPayload: Record<string, any>
  ): Promise<void> {
    const template: string = actionPayload.message;
    if (!template) {
      throw new Error(
        "actionPayload.message is required for send_slack_message. " +
        'Example: { "message": "PR {{pull_request.number}} opened by {{sender.login}}" }'
      );
    }

    // Delegates entirely to SlackService:
    //   1. Selects the correct Block Kit formatter by event type
    //   2. Interpolates {{field.path}} tokens as fallback text
    //   3. POSTs to SLACK_WEBHOOK_URL with retry on transient failures
    //   4. Throws on final failure — ActionService logs it as FAILED in ActionLog
    await slackService.sendForEvent(context, template);
  }
}
