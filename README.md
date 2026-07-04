# GitHub Automation Bot

A production-ready GitHub Automation Bot built with Next.js 15+, TypeScript, and Prisma. It receives webhook events from GitHub, evaluates them against user-defined JSON conditions, and securely executes automated actions such as adding labels, closing issues, and sending Slack notifications.

## Features

- **GitHub OAuth & Webhooks**: Authenticate users, connect repositories, and receive real-time webhook events.
- **Rule Engine**: A pure, stateless evaluator supporting dot-notation payload resolution and typed operators (equals, contains, startsWith, etc.).
- **Strategy-Pattern Actions**: Easily extensible action dispatching. Out-of-the-box support for Slack notifications, adding labels, and closing issues.
- **Server Sent Events (SSE)**: Real-time dashboard updates when events arrive or actions finish executing.
- **Clean Architecture**: Strict separation of concerns (Orchestrators, Rule Engine, Action Strategies, Route Handlers).
- **Prisma & Neon Postgres**: Robust relational database schema with deduplication and action logging.

## Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Database ORM**: Prisma 7
- **Database**: PostgreSQL (Neon Serverless)
- **Authentication**: NextAuth (Auth.js) v5
- **Styling**: TailwindCSS v4 + shadcn/ui
- **Live Updates**: Server Sent Events (SSE)

## Getting Started

See [docs/Deployment.md](docs/Deployment.md) for local setup and production deployment instructions.

## Documentation

- [Architecture & Design](docs/Architecture.md)
- [API Documentation](docs/API.md)
- [Testing Guide](docs/Testing.md)
- [Deployment Guide](docs/Deployment.md)
- [AI Notes](AI_NOTES.md)
