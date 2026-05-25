import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback_secret_for_dev";

export interface MobileJwtPayload {
  id: string;
  role: string;
  schoolId: string | null;
  schoolSlug: string | null;
}

export function signMobileToken(payload: MobileJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyMobileToken(token: string): MobileJwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as MobileJwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function getMobileSession(req: Request): MobileJwtPayload | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  return verifyMobileToken(token);
}
