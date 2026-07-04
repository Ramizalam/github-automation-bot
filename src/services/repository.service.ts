import prisma from "@/lib/prisma";
import { fetchUserRepositories } from "@/infrastructure/github";
import crypto from "crypto";

export async function getAvailableRepositories(userId: string) {
  // 1. Get the user's GitHub access token from the database
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
  });

  if (!account?.access_token) {
    throw new Error("GitHub account not linked or missing access token");
  }

  // 2. Fetch all repositories the user has access to from GitHub API
  const githubRepos = await fetchUserRepositories(account.access_token);

  // 3. Fetch repositories already connected in our database
  const connectedRepos = await prisma.repository.findMany({
    where: { userId },
    select: { githubId: true },
  });

  const connectedIds = new Set(connectedRepos.map((r) => r.githubId));

  // 4. Return both available (unconnected) and already connected repos
  const available = githubRepos.filter((repo: any) => !connectedIds.has(repo.githubId));
  const connected = githubRepos.filter((repo: any) => connectedIds.has(repo.githubId));

  return { available, connected };
}

export async function connectRepository(userId: string, repoData: { githubId: number, name: string, fullName: string, url: string }) {
  // Verify it doesn't already exist
  const existing = await prisma.repository.findUnique({
    where: { githubId: repoData.githubId },
  });

  if (existing) {
    throw new Error("Repository already connected");
  }

  // Generate a secure random webhook secret
  const webhookSecret = crypto.randomBytes(32).toString("hex");

  // Save to database
  const repo = await prisma.repository.create({
    data: {
      githubId: repoData.githubId,
      name: repoData.name,
      fullName: repoData.fullName,
      url: repoData.url,
      webhookSecret,
      userId,
    },
  });

  return repo;
}
