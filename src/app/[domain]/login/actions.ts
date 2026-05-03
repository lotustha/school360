"use server";

import { prisma } from "@/lib/prisma";

// Note: The 'authenticate' action was removed because NextAuth v4 
// requires login to be handled client-side (see login-form.tsx).

/**
 * Fetches School Data based on Subdomain
 * Used by the Server Page (page.tsx) to populate branding.
 */
export async function getSchoolFromSubdomain(domain: string) {
  if (!domain) return null;
  
  // Normalize domain handling for localhost vs production
  // e.g. "padmodaya.localhost:3000" -> "padmodaya"
  const subdomain = domain.split('.')[0]; 
  
  try {
    const school = await prisma.school.findUnique({
      where: { slug: subdomain },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        slug: true,
      }
    });

    return school;
  } catch (error) {
    console.error("Failed to fetch school:", error);
    return null;
  }
}