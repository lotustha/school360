"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import NepaliDate from "nepali-date-converter";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const OnboardingSchema = z.object({
  schoolName: z.string().min(3, "School name is too short"),
  panNumber: z.string().length(9, "PAN must be exactly 9 digits"),
  phone: z.string().min(7, "Invalid phone number"),
  address: z.string().min(5, "Address is required"),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Only lowercase, numbers, and hyphens allowed"),
  logoUrl: z.string().optional(),
  themeColor: z.string().default("#10b981"),
  adminName: z.string().min(3, "Admin name is too short"),
  adminEmail: z.string().email("Invalid email address"),
  adminPassword: z.string().min(6, "Password must be at least 6 characters"),
  selectedModules: z.array(z.string()).default([]),
  studentCount: z.number().min(10).default(100),
});

const MODULE_PRICES: Record<string, number> = {
  FINANCE_TAX: 2000,
  EXAM_CAS: 1500,
  TRANSPORT_GPS: 500,
  MOBILE_APP: 833,
};

export async function registerSchoolAction(formData: FormData) {
  const rawData: any = {};
  for (const [key, value] of formData.entries()) {
    if (key !== "logo" && key !== "selectedModules") {
      rawData[key] = value;
    }
  }

  try {
    const modulesStr = formData.get("selectedModules") as string;
    rawData.selectedModules = JSON.parse(modulesStr || "[]");
  } catch {
    rawData.selectedModules = [];
  }

  rawData.studentCount = parseInt(rawData.studentCount as string) || 100;

  const logoFile = formData.get("logo") as File | null;
  let finalLogoUrl = null;

  if (logoFile && logoFile.size > 0) {
    try {
      const timestamp = Date.now();
      const ext = logoFile.name.split(".").pop() || "png";
      const filename = `${rawData.slug}-${timestamp}.${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads", "logos");
      await mkdir(uploadDir, { recursive: true });
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      await writeFile(path.join(uploadDir, filename), buffer);
      finalLogoUrl = `/uploads/logos/${filename}`;
    } catch (error) {
      console.error("LOGO_UPLOAD_ERROR", error);
    }
  }

  if (finalLogoUrl) rawData.logoUrl = finalLogoUrl;

  const result = OnboardingSchema.safeParse(rawData);
  if (!result.success) {
    return { success: false, error: "Validation failed", details: result.error.flatten() };
  }

  const data = result.data;

  try {
    const existingSchool = await prisma.school.findUnique({ where: { slug: data.slug } });
    if (existingSchool) return { success: false, error: "Subdomain already in use." };

    const existingUser = await prisma.user.findUnique({ where: { email: data.adminEmail } });
    if (existingUser) return { success: false, error: "Admin email already registered." };

    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

    const todayBS = new NepaliDate();
    const currentBSYear = todayBS.getYear();
    const nextBSYear = currentBSYear + 1;

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const newSchool = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: data.schoolName,
          slug: data.slug,
          panNumber: data.panNumber,
          phone: data.phone,
          address: data.address,
          logoUrl: data.logoUrl,
          themeColor: data.themeColor,
        },
      });

      await tx.user.create({
        data: {
          fullName: data.adminName,
          email: data.adminEmail,
          password: hashedPassword,
          role: "SCHOOL_ADMIN",
          schoolId: school.id,
        },
      });

      const startDate = new NepaliDate(currentBSYear, 0, 1).format("YYYY-MM-DD");
      const endDate = new NepaliDate(currentBSYear, 11, 30).format("YYYY-MM-DD");
      await tx.academicYear.create({
        data: {
          name: `${currentBSYear}-${nextBSYear}`,
          startDateBS: startDate,
          endDateBS: endDate,
          isCurrent: true,
          schoolId: school.id,
        },
      });

      const subscription = await tx.schoolSubscription.create({
        data: {
          schoolId: school.id,
          studentCount: data.studentCount,
          plan: "TRIAL",
          trialEndsAt,
        },
      });

      for (const moduleKey of data.selectedModules) {
        if (MODULE_PRICES[moduleKey] !== undefined) {
          await tx.schoolModule.create({
            data: {
              subscriptionId: subscription.id,
              moduleKey,
              isActive: true,
              monthlyPrice: MODULE_PRICES[moduleKey],
            },
          });
        }
      }

      return school;
    });

    return { success: true, slug: newSchool.slug };
  } catch (error: any) {
    console.error("ONBOARDING_TRANSACTION_CRASH:", error);
    return { success: false, error: "Critical infrastructure failure. Please contact support." };
  }
}
