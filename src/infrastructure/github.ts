export async function fetchUserRepositories(accessToken: string) {
  // API Request Explained:
  // We call GET /user/repos to fetch all repositories that the authenticated user has access to.
  // The 'visibility=all' ensures we see both public and private repos.
  // The 'affiliation=owner,collaborator,organization_member' ensures we get repos where the user is an owner, a collaborator, or an org member.
  const res = await fetch("https://api.github.com/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&per_page=100", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status}: ${res.statusText}`);
  }

  const repos = await res.json();
  return repos.map((repo: any) => ({
    githubId: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    private: repo.private,
  }));
}
