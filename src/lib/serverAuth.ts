import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export class AuthenticationRequiredError extends Error {
  status = 401;

  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}

export function isAuthenticationRequiredError(error: unknown): error is AuthenticationRequiredError {
  return error instanceof AuthenticationRequiredError;
}
