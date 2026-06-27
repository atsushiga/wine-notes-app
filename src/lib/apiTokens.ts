import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import {
  checkAndRecordSubjectUsage,
  createUsageSubjectKey,
  isUsageLimitError,
} from "@/lib/usageLimits";

export const API_TOKEN_PREFIX = "wnro_";

export type ApiTokenScope = "notes:read" | "images:read";

export type ApiTokenClaims = {
  id: string;
  tokenId: string;
  userId: string;
  scopes: ApiTokenScope[];
};

export type ApiTokenListItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

type ApiTokenRow = {
  id: string;
  user_id?: string | null;
  name?: string | null;
  token_id: string;
  token_hash?: string | null;
  token_prefix?: string | null;
  scopes: unknown;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at?: string | null;
  created_at?: string | null;
};

type ApiTokenErrorCode =
  | "api_token_secret_missing"
  | "expired_token"
  | "insufficient_scope"
  | "invalid_token"
  | "missing_token"
  | "rate_limited";

const TOKEN_ID_BYTES = 12;
const TOKEN_SECRET_BYTES = 32;
const TOKEN_PATTERN = /^wnro_([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{32,})$/;
const ALLOWED_SCOPES: ApiTokenScope[] = ["notes:read", "images:read"];

export class ApiTokenAuthError extends Error {
  constructor(
    public readonly code: ApiTokenErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiTokenAuthError";
  }
}

function apiTokenPepper() {
  const pepper = process.env.API_TOKEN_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pepper) {
    throw new ApiTokenAuthError(
      "api_token_secret_missing",
      503,
      "API token verification is not configured",
    );
  }

  return pepper;
}

function hashTokenSecret(tokenId: string, secret: string) {
  return createHmac("sha256", apiTokenPepper())
    .update(`${tokenId}.${secret}`)
    .digest("hex");
}

function secureCompareHex(actualHex: string, expectedHex: string) {
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  if (actual.length === 0 || actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

function parseToken(rawToken: string) {
  const match = rawToken.match(TOKEN_PATTERN);
  if (!match) return null;
  return {
    tokenId: match[1],
    secret: match[2],
  };
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token.trim();
}

export function isApiTokenScope(value: unknown): value is ApiTokenScope {
  return typeof value === "string" && ALLOWED_SCOPES.includes(value as ApiTokenScope);
}

export function normalizeApiTokenScopes(value: unknown): ApiTokenScope[] {
  const scopes = Array.isArray(value)
    ? value.filter(isApiTokenScope)
    : [];

  const uniqueScopes = Array.from(new Set(scopes));
  return uniqueScopes.length > 0 ? uniqueScopes : ["notes:read"];
}

export function createApiToken() {
  const tokenId = randomBytes(TOKEN_ID_BYTES).toString("base64url");
  const secret = randomBytes(TOKEN_SECRET_BYTES).toString("base64url");
  const token = `${API_TOKEN_PREFIX}${tokenId}.${secret}`;

  return {
    token,
    tokenId,
    tokenHash: hashTokenSecret(tokenId, secret),
    tokenPrefix: `${token.slice(0, 18)}...`,
  };
}

export function serializeApiTokenRow(row: ApiTokenRow): ApiTokenListItem {
  return {
    id: row.id,
    name: row.name || "API token",
    tokenPrefix: row.token_prefix || `${API_TOKEN_PREFIX}${row.token_id.slice(0, 8)}...`,
    scopes: normalizeApiTokenScopes(row.scopes),
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at || new Date(0).toISOString(),
  };
}

function assertTokenActive(row: ApiTokenRow) {
  if (row.revoked_at) {
    throw new ApiTokenAuthError("invalid_token", 401, "Invalid API token");
  }

  if (row.expires_at) {
    const expiresAt = Date.parse(row.expires_at);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      throw new ApiTokenAuthError("expired_token", 401, "API token has expired");
    }
  }
}

async function markTokenUsed(tokenId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenId);

  if (error) {
    console.warn("Failed to update API token last_used_at.", error.message);
  }
}

async function recordApiReadUsage(claims: ApiTokenClaims, metadata: Record<string, unknown>) {
  await checkAndRecordSubjectUsage(createUsageSubjectKey("api-token", claims.id), "api_read", {
    metadata: {
      ...metadata,
      userId: claims.userId,
      tokenId: claims.id,
    },
  });
}

export async function requireApiToken(
  request: NextRequest,
  requiredScope: ApiTokenScope,
  metadata: Record<string, unknown> = {},
): Promise<ApiTokenClaims> {
  const rawToken = bearerToken(request);
  if (!rawToken) {
    throw new ApiTokenAuthError("missing_token", 401, "Missing Bearer API token");
  }

  const parsed = parseToken(rawToken);
  if (!parsed) {
    throw new ApiTokenAuthError("invalid_token", 401, "Invalid API token");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, user_id, token_id, token_hash, scopes, expires_at, revoked_at")
    .eq("token_id", parsed.tokenId)
    .maybeSingle();

  if (error) {
    throw new Error(`API token lookup failed: ${error.message}`);
  }

  const row = data as ApiTokenRow | null;
  if (!row) {
    throw new ApiTokenAuthError("invalid_token", 401, "Invalid API token");
  }

  const presentedHash = hashTokenSecret(parsed.tokenId, parsed.secret);
  if (!row.user_id || !row.token_hash) {
    throw new Error("API token row is missing required authentication fields");
  }

  if (!secureCompareHex(presentedHash, row.token_hash)) {
    throw new ApiTokenAuthError("invalid_token", 401, "Invalid API token");
  }

  assertTokenActive(row);

  const scopes = normalizeApiTokenScopes(row.scopes);
  if (!scopes.includes(requiredScope)) {
    throw new ApiTokenAuthError("insufficient_scope", 403, "API token scope is insufficient");
  }

  const claims = {
    id: row.id,
    tokenId: row.token_id,
    userId: row.user_id,
    scopes,
  };

  await markTokenUsed(row.id);
  await recordApiReadUsage(claims, { ...metadata, requiredScope });

  return claims;
}

export function apiTokenErrorResponse(error: unknown) {
  if (error instanceof ApiTokenAuthError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (isUsageLimitError(error)) {
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: `Daily API read limit exceeded. Limit: ${error.dailyLimit}`,
        },
      },
      { status: 429 },
    );
  }

  return null;
}
