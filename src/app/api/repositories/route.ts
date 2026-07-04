import { auth } from "@/lib/auth";
import { getAvailableRepositories, connectRepository } from "@/services/repository.service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repos = await getAvailableRepositories(session.user.id);
    return NextResponse.json(repos);
  } catch (error: any) {
    console.error("GET /api/repositories error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const repo = await connectRepository(session.user.id, {
      githubId: body.githubId,
      name: body.name,
      fullName: body.fullName,
      url: body.url,
    });

    return NextResponse.json({ success: true, repo }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/repositories error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
