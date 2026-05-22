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

  // Root domain (derive www-prefixed alias from it so we don't hardcode any host)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const rootHosts = new Set([
    rootDomain,
    `www.${rootDomain}`,
    "localhost:3000",
  ]);

  // 2. DETECT SUBDOMAIN — anything with a dot that isn't the root, www-root, or an IP literal.
  const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::\d+)?$/.test(hostname);
  const isSubdomain = !isIP && !rootHosts.has(hostname) && hostname.includes(".");

  let response: NextResponse;

  // 3. SUBDOMAIN ROUTING (the school app). Use nextUrl.clone() so Next.js treats
  // the rewrite as a path-only rewrite — not a full-URL proxy. With new URL(..., req.url)
  // Next 16 picks up the forwarded `https` scheme and tries to internally fetch
  // https://localhost:3005/..., which fails with EPROTO when the upstream is plain HTTP.
  if (isSubdomain) {
    const subdomain = hostname.split(".")[0];

    if (url.pathname.startsWith(`/${subdomain}`)) {
      response = NextResponse.next();
    } else {
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = `/${subdomain}${url.pathname}`;
      response = NextResponse.rewrite(rewriteUrl);
    }
  } else {
    // 4. MAIN DOMAIN ROUTING (Marketing Site)
    // Since we use the (marketing) route group, the files are already 
    // at the root level of the app router. We just let it pass through.
    response = NextResponse.next();
  }

  return response;
}