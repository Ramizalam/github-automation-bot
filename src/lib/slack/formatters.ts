import type { EventContext } from "@/types/webhook";
import type { SlackMessage, SectionBlock, ActionsBlock } from "@/lib/slack/slack.types";

// =============================================================================
// Slack Message Formatters
// =============================================================================
//
// Pure functions that build rich Slack Block Kit messages for each GitHub
// event type. No I/O — given an EventContext, they return a SlackMessage.
//
// WHY BLOCK KIT?
//   Plain text like "PR opened by octocat" is easy to miss in a busy channel.
//   Block Kit lets us format key info as scannable fields, add direct links,
//   and maintain a consistent visual identity for all bot notifications.
//
// FALLBACK TEXT:
//   Every SlackMessage MUST have a `text` field — it's displayed in:
//   - Desktop/mobile notification previews (before opening Slack)
//   - Clients that don't support Block Kit
//   - Screen readers
// =============================================================================

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a mrkdwn field with a bold label on the first line. */
function field(label: string, value: string): { type: "mrkdwn"; text: string } {
  return { type: "mrkdwn", text: `*${label}*\n${value}` };
}

/** Builds a standard "View on GitHub" button block. */
function viewButton(url: string, label = "View on GitHub"): ActionsBlock {
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: label, emoji: true },
        url,
        style: "primary",
        action_id: "view_on_github",
      },
    ],
  };
}

/** Capitalises the first letter of a string. */
function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------------------
// Event Formatters
// ---------------------------------------------------------------------------

/**
 * pull_request — opened, closed, merged, reopened, review_requested, etc.
 *
 * Slack preview: "🔀 PR #42 (Fix login bug) opened by octocat"
 */
function formatPullRequest(context: EventContext): SlackMessage {
  const pr = context.payload?.pull_request ?? {};
  const repo: string = context.payload?.repository?.full_name ?? "unknown/repo";
  const action = capitalise(context.action ?? "updated");
  const merged: boolean = pr.merged === true;

  const emoji = merged ? "✅" : action === "Opened" ? "🔀" : "🔁";
  const title = `${emoji} Pull Request ${merged ? "Merged" : action}`;
  const fallback = `${title}: #${pr.number} "${pr.title}" in ${repo} by ${pr.user?.login}`;

  const fields: SectionBlock["fields"] = [
    field("Repository", `\`${repo}\``),
    field("Author", `<${pr.user?.html_url}|@${pr.user?.login}>`),
    field("Branch", `\`${pr.head?.ref}\` → \`${pr.base?.ref}\``),
    field("Status", merged ? "✅ Merged" : action),
  ];

  return {
    text: fallback,
    blocks: [
      { type: "header", text: { type: "plain_text", text: title, emoji: true } },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*<${pr.html_url}|#${pr.number}: ${pr.title}>*` },
      },
      { type: "section", fields },
      { type: "divider" },
      viewButton(pr.html_url, "View Pull Request"),
    ],
  };
}

/**
 * issues — opened, closed, reopened, labeled, assigned, etc.
 *
 * Slack preview: "🐛 Issue #15 (Login fails on mobile) opened by octocat"
 */
function formatIssue(context: EventContext): SlackMessage {
  const issue = context.payload?.issue ?? {};
  const repo: string = context.payload?.repository?.full_name ?? "unknown/repo";
  const action = capitalise(context.action ?? "updated");

  const emoji = action === "Opened" ? "🐛" : action === "Closed" ? "✅" : "🔔";
  const title = `${emoji} Issue ${action}`;
  const fallback = `${title}: #${issue.number} "${issue.title}" in ${repo} by ${issue.user?.login}`;

  const labels: string = issue.labels
    ?.map((l: any) => `\`${l.name}\``)
    .join(", ") || "None";

  return {
    text: fallback,
    blocks: [
      { type: "header", text: { type: "plain_text", text: title, emoji: true } },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*<${issue.html_url}|#${issue.number}: ${issue.title}>*` },
      },
      {
        type: "section",
        fields: [
          field("Repository", `\`${repo}\``),
          field("Author", `<${issue.user?.html_url}|@${issue.user?.login}>`),
          field("Status", action),
          field("Labels", labels),
        ],
      },
      { type: "divider" },
      viewButton(issue.html_url, "View Issue"),
    ],
  };
}

/**
 * push — commits pushed to a branch.
 *
 * Slack preview: "🚀 3 commits pushed to main in owner/repo by octocat"
 */
function formatPush(context: EventContext): SlackMessage {
  const payload = context.payload;
  const repo: string = payload?.repository?.full_name ?? "unknown/repo";
  const pusher: string = payload?.pusher?.name ?? payload?.sender?.login ?? "unknown";
  const ref: string = payload?.ref ?? "";
  const branch = ref.replace("refs/heads/", "");
  const commits: any[] = payload?.commits ?? [];
  const compareUrl: string = payload?.compare ?? payload?.repository?.html_url;

  const count = commits.length;
  const commitSummary = commits
    .slice(0, 3)
    .map((c: any) => `• \`${c.id?.slice(0, 7)}\` ${c.message?.split("\n")[0]}`)
    .join("\n");
  const more = count > 3 ? `\n_...and ${count - 3} more_` : "";

  const fallback = `🚀 ${count} commit${count !== 1 ? "s" : ""} pushed to ${branch} in ${repo} by ${pusher}`;

  return {
    text: fallback,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🚀 New Push", emoji: true },
      },
      {
        type: "section",
        fields: [
          field("Repository", `\`${repo}\``),
          field("Branch", `\`${branch}\``),
          field("Pushed by", `@${pusher}`),
          field("Commits", `${count}`),
        ],
      },
      ...(commitSummary
        ? [
            {
              type: "section" as const,
              text: { type: "mrkdwn" as const, text: commitSummary + more },
            },
          ]
        : []),
      { type: "divider" },
      viewButton(compareUrl, "View Changes"),
    ],
  };
}

// ---------------------------------------------------------------------------
// Fallback Formatter — plain text with {{field}} interpolation
// ---------------------------------------------------------------------------

/**
 * Resolves `{{field.path}}` tokens from the event payload using dot-notation.
 */
function interpolate(template: string, payload: Record<string, any>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, fieldPath: string) => {
    const value = fieldPath
      .split(".")
      .reduce((obj: any, key: string) => obj?.[key], payload);
    return value != null ? String(value) : `{{${fieldPath}}}`;
  });
}

/**
 * Fallback for unknown event types — renders the user-provided template
 * with `{{field.path}}` interpolation and sends as plain text.
 */
function formatFallback(
  context: EventContext,
  template: string
): SlackMessage {
  const text = interpolate(template, context.payload);
  return { text };
}

// ---------------------------------------------------------------------------
// Public API — dispatch by event type
// ---------------------------------------------------------------------------

/**
 * Build a SlackMessage for a GitHub webhook event.
 *
 * @param context  - Immutable event context from the pipeline
 * @param template - User-provided message template (used as fallback text
 *                   and for unknown event types)
 */
export function formatSlackMessage(
  context: EventContext,
  template: string
): SlackMessage {
  switch (context.eventType) {
    case "pull_request":
      return formatPullRequest(context);
    case "issues":
      return formatIssue(context);
    case "push":
      return formatPush(context);
    default:
      return formatFallback(context, template);
  }
}
