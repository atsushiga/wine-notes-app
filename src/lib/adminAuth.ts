import type { User } from "@supabase/supabase-js";
import { AuthenticationRequiredError, requireAuthenticatedUser } from "@/lib/serverAuth";

export class AdminAuthorizationError extends Error {
  status = 403;

  constructor(message = "Admin access required") {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isConfiguredAdminEmail(email?: string | null) {
  if (!email) return false;
  const admins = configuredAdminEmails();
  return admins.length > 0 && admins.includes(email.trim().toLowerCase());
}

export async function requireAdminUser(): Promise<User> {
  const user = await requireAuthenticatedUser();

  if (!isConfiguredAdminEmail(user.email)) {
    throw new AdminAuthorizationError(
      configuredAdminEmails().length === 0
        ? "ADMIN_EMAILS is not configured"
        : "Admin access required",
    );
  }

  return user;
}

export function adminAuthErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return { status: error.status, body: { ok: false, error: "authentication_required" } };
  }

  if (error instanceof AdminAuthorizationError) {
    return { status: error.status, body: { ok: false, error: "admin_access_required" } };
  }

  return null;
}
