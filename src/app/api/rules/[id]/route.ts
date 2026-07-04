import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { isActive } = await req.json();

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    // Verify the rule belongs to the current user before updating
    const rule = await prisma.rule.findFirst({
      where: { id, repository: { userId: session.user.id } },
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const updated = await prisma.rule.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ success: true, isActive: updated.isActive });
  } catch (error: any) {
    console.error("PATCH /api/rules/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
