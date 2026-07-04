import type { IActionStrategy } from "@/lib/actions/base.action";
import type { EventContext } from "@/types/webhook";

// =============================================================================
// CloseIssueStrategy
// =============================================================================
// Closes the issue or pull request that triggered the event.
//
// actionPayload shape: {} (no configuration needed)
//
// GitHub API: PATCH /repos/{owner}/{repo}/issues/{issue_number}
//             body: { state: "closed" }
// =============================================================================

export class CloseIssueStrategy implements IActionStrategy {
  readonly actionType = "close_issue";

  async execute(
    context: EventContext,
    _actionPayload: Record<string, any>
  ): Promise<void> {
    const issueNumber =
      context.payload?.pull_request?.number ??
      context.payload?.issue?.number;
    const repoFullName: string = context.payload?.repository?.full_name;

    if (!issueNumber || !repoFullName) {
      throw new Error(
        "Cannot resolve issue number or repository from payload."
      );
    }

    // TODO: Retrieve access_token from Account table for this repository's owner.
    console.log(
      `[CloseIssueStrategy] close_issue → ${repoFullName}#${issueNumber}`
    );

    // GitHub API call (ready to activate once access_token retrieval is wired):
    // const res = await fetch(
    //   `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}`,
    //   {
    //     method: "PATCH",
    //     headers: {
    //       Authorization: `Bearer ${accessToken}`,
    //       Accept: "application/vnd.github.v3+json",
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({ state: "closed" }),
    //   }
    // );
    // if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  }
}
