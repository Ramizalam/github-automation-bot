import type { IActionStrategy } from "@/lib/actions/base.action";
import type { EventContext } from "@/types/webhook";

// =============================================================================
// AddLabelStrategy
// =============================================================================
// Adds a label to the pull request or issue that triggered the event.
//
// actionPayload shape: { label: string }
//
// GitHub API: POST /repos/{owner}/{repo}/issues/{issue_number}/labels
// Note: GitHub exposes PR labels via the Issues endpoint since PRs are issues.
// =============================================================================

export class AddLabelStrategy implements IActionStrategy {
  readonly actionType = "add_label";

  async execute(
    context: EventContext,
    actionPayload: Record<string, any>
  ): Promise<void> {
    const label: string = actionPayload.label;
    if (!label) {
      throw new Error("actionPayload.label is required for add_label");
    }

    // GitHub puts the issue/PR number in different places depending on event type
    const issueNumber =
      context.payload?.pull_request?.number ??
      context.payload?.issue?.number;
    const repoFullName: string = context.payload?.repository?.full_name;

    if (!issueNumber || !repoFullName) {
      throw new Error(
        "Cannot resolve issue number or repository from payload."
      );
    }

    // TODO: Retrieve access_token from Account table for this repository's owner
    // and pass it in the Authorization header below.
    console.log(
      `[AddLabelStrategy] add_label → ${repoFullName}#${issueNumber}: "${label}"`
    );

    // GitHub API call (ready to activate once access_token retrieval is wired):
    // const res = await fetch(
    //   `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/labels`,
    //   {
    //     method: "POST",
    //     headers: {
    //       Authorization: `Bearer ${accessToken}`,
    //       Accept: "application/vnd.github.v3+json",
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({ labels: [label] }),
    //   }
    // );
    // if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  }
}
