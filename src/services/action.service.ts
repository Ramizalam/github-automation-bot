import type { Rule } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { ActionResult, EventContext, SupportedActionType } from "@/types/webhook";

// =============================================================================
// Action Service
// =============================================================================
//
// RESPONSIBILITY: Execute the side effect defined by a matched rule and record
// the result in the ActionLog table.
//
// This service is the ONLY layer in the system allowed to perform outbound
// network calls (GitHub API, Slack webhooks, etc.).
//
// Each action type is implemented as a private async function. The public
// `executeAction()` function dispatches to the correct handler by `actionType`.
// Unknown action types are caught and logged as FAILED without throwing, so
// one bad rule never blocks other rules from executing.
//
// WHY LOG EVERYTHING? The ActionLog table gives operators full visibility
// into what the bot did, when, and why. If an action fails, the error
// message is stored so it can be debugged without parsing server logs.
// =============================================================================

// -----------------------------------------------------------------------------
// Action Handlers
// Each handler receives the rule's actionPayload (typed) and the event context.
// It returns a success message or throws on failure.
// -----------------------------------------------------------------------------

/**
 * add_label: Adds a label to the pull request or issue that triggered the event.
 *
 * actionPayload shape: { label: string }
 *
 * GitHub API used: PATCH /repos/{owner}/{repo}/issues/{issue_number}/labels
 * Note: GitHub uses the same endpoint for PR labels since PRs are issues.
 */
async function handleAddLabel(
  payload: Record<string, any>,
  actionPayload: Record<string, any>
): Promise<string> {
  const label: string = actionPayload.label;
  if (!label) throw new Error("actionPayload.label is required for add_label");

  // The issue/PR number is always at payload.pull_request.number or payload.issue.number
  const issueNumber =
    payload?.pull_request?.number ?? payload?.issue?.number;
  const repoFullName: string = payload?.repository?.full_name;

  if (!issueNumber || !repoFullName) {
    throw new Error("Cannot resolve issue number or repository from payload.");
  }

  // TODO: In a future iteration, fetch the user's GitHub access_token from the
  // Account table and use it here instead of a hardcoded placeholder.
  // For now, this stub validates the structure and logs the attempt.
  console.log(`[ActionService] add_label → ${repoFullName}#${issueNumber}: "${label}"`);

  // Placeholder: actual GitHub API call would go here:
  // await fetch(`https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/labels`, {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${accessToken}`, ... },
  //   body: JSON.stringify({ labels: [label] }),
  // });

  return `Label "${label}" would be added to ${repoFullName}#${issueNumber}`;
}

/**
 * send_slack_message: Sends a notification to the configured Slack channel.
 *
 * actionPayload shape: { message: string }
 *
 * Supports simple {{field}} template substitution from the event payload.
 * Example: "New PR opened: {{pull_request.title}} by {{sender.login}}"
 *
 * Uses the SLACK_WEBHOOK_URL environment variable.
 */
async function handleSendSlackMessage(
  payload: Record<string, any>,
  actionPayload: Record<string, any>
): Promise<string> {
  const messageTemplate: string = actionPayload.message;
  if (!messageTemplate) {
    throw new Error("actionPayload.message is required for send_slack_message");
  }

  // Simple {{field.path}} template interpolation
  const message = messageTemplate.replace(
    /\{\{([\w.]+)\}\}/g,
    (_, fieldPath: string) => {
      const value = fieldPath
        .split(".")
        .reduce((obj: any, key: string) => obj?.[key], payload);
      return value != null ? String(value) : `{{${fieldPath}}}`;
    }
  );

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackWebhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL environment variable is not set.");
  }

  const res = await fetch(slackWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });

  if (!res.ok) {
    throw new Error(`Slack API responded with ${res.status}: ${res.statusText}`);
  }

  return `Slack message sent: "${message}"`;
}

/**
 * close_issue: Closes the issue or pull request that triggered the event.
 *
 * actionPayload shape: {}
 */
async function handleCloseIssue(
  payload: Record<string, any>,
  _actionPayload: Record<string, any>
): Promise<string> {
  const issueNumber =
    payload?.pull_request?.number ?? payload?.issue?.number;
  const repoFullName: string = payload?.repository?.full_name;

  if (!issueNumber || !repoFullName) {
    throw new Error("Cannot resolve issue number or repository from payload.");
  }

  console.log(`[ActionService] close_issue → ${repoFullName}#${issueNumber}`);

  // Placeholder: actual GitHub API call:
  // await fetch(`https://api.github.com/repos/${repoFullName}/issues/${issueNumber}`, {
  //   method: "PATCH",
  //   headers: { Authorization: `Bearer ${accessToken}`, ... },
  //   body: JSON.stringify({ state: "closed" }),
  // });

  return `Issue ${repoFullName}#${issueNumber} would be closed`;
}

// -----------------------------------------------------------------------------
// Dispatcher
// -----------------------------------------------------------------------------

/**
 * Public API: Execute the action defined by a matched rule.
 *
 * Dispatches to the correct handler by `rule.actionType`, wraps the result
 * in an ActionLog record, and returns an ActionResult.
 *
 * Never throws — all errors are caught and returned as FAILED results so one
 * broken rule never prevents other rules from executing.
 */
export async function executeAction(
  rule: Rule,
  context: EventContext
): Promise<ActionResult> {
  const actionPayload = rule.actionPayload as Record<string, any>;
  const actionType = rule.actionType as SupportedActionType;

  let status: "SUCCESS" | "FAILED" = "SUCCESS";
  let errorMessage: string | undefined;

  try {
    switch (actionType) {
      case "add_label":
        await handleAddLabel(context.payload, actionPayload);
        break;
      case "send_slack_message":
        await handleSendSlackMessage(context.payload, actionPayload);
        break;
      case "close_issue":
        await handleCloseIssue(context.payload, actionPayload);
        break;
      default:
        throw new Error(`Unknown actionType: "${actionType}"`);
    }
  } catch (err: any) {
    status = "FAILED";
    errorMessage = err?.message ?? "Unknown error";
    console.error(`[ActionService] Action "${actionType}" failed for rule ${rule.id}:`, errorMessage);
  }

  // Persist the result to ActionLog regardless of success or failure
  await prisma.actionLog.create({
    data: {
      actionType,
      status,
      errorMessage: errorMessage ?? null,
      eventId: context.eventId,
      ruleId: rule.id,
    },
  });

  return { ruleId: rule.id, actionType, status, errorMessage };
}
