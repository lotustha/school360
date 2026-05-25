import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signMobileToken } from "@/lib/mobile-auth";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
  selectedSchoolId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { identifier, password, selectedSchoolId } = parsed.data;

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier }
        ]
      },
      include: {
        school: { select: { id: true, name: true, slug: true, logoUrl: true, themeColor: true } },
      },
    });

    if (users.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const authenticatedUsers = [];
    for (const user of users) {
      let passwordsMatch = await bcrypt.compare(password, user.password);
      if (!passwordsMatch) {
         passwordsMatch = password === user.password;
      }
      if (passwordsMatch) {
        authenticatedUsers.push(user);
      }
    }

    if (authenticatedUsers.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (authenticatedUsers.length > 1 && !selectedSchoolId) {
      const schools = authenticatedUsers.map(u => ({
        id: u.school?.id,
        name: u.school?.name,
        slug: u.school?.slug,
        logoUrl: u.school?.logoUrl,
        themeColor: u.school?.themeColor,
        userId: u.id
      })).filter(s => s.id);
      
      return NextResponse.json({ 
        requiresSchoolSelection: true, 
        schools 
      });
    }

    let targetUser = authenticatedUsers[0];
    if (selectedSchoolId) {
      const matched = authenticatedUsers.find(u => u.schoolId === selectedSchoolId);
      if (!matched) {
        return NextResponse.json({ error: "Invalid school selection" }, { status: 400 });
      }
      targetUser = matched;
    }

    const token = signMobileToken({
      id: targetUser.id,
      role: targetUser.role,
      schoolId: targetUser.schoolId,
      schoolSlug: targetUser.school?.slug || null,
    });

    return NextResponse.json({
      token,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.fullName,
        role: targetUser.role,
        schoolId: targetUser.schoolId,
        school: targetUser.school,
      },
    });
  } catch (error) {
    console.error("Mobile Login Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
