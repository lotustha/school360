import { NextRequest, NextResponse } from "next/server";

/**
 * School360 Proxy Logic — subdomain routing only.
 * Auth runs through NextAuth (JWT strategy in `src/auth.ts`); no Supabase
 * session refresh is needed in middleware.
 */
export default async function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // 1. ALWAYS IGNORE INTERNAL ASSETS & API
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.includes(".") 
  ) {
    return NextResponse.next();
  }

  // Define the root domain
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

  // 2. DETECT IF THIS IS A SUBDOMAIN
  // We check if the hostname is NOT the root domain, NOT a local IP, and contains a dot.
  const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::\d+)?$/.test(hostname);
  
  const isSubdomain = 
    !isIP &&
    hostname !== rootDomain && 
    hostname !== "www.school360.com.np" &&
    hostname !== "school360.com.np" &&
    hostname !== "localhost:3000" &&
    hostname.includes(".");

  let response: NextResponse;

  // 3. SUBDOMAIN ROUTING (The School App)
  if (isSubdomain) {
    const subdomain = hostname.split(".")[0];
    
    // Prevent infinite loops
    if (url.pathname.startsWith(`/${subdomain}`)) {
      response = NextResponse.next();
    } else {
      // Rewrite to the internal tenant folder
      response = NextResponse.rewrite(
        new URL(`/${subdomain}${url.pathname}${url.search}`, req.url)
      );
    }
  } else {
    // 4. MAIN DOMAIN ROUTING (Marketing Site)
    // Since we use the (marketing) route group, the files are already 
    // at the root level of the app router. We just let it pass through.
    response = NextResponse.next();
  }

  return response;
}