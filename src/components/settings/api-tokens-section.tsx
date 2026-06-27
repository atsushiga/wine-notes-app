"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";

type ApiTokenScope = "notes:read" | "images:read";

type ApiTokenListItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

type TokenCreateResponse = {
  ok: boolean;
  token?: string;
  tokenInfo?: ApiTokenListItem;
  error?: string;
};

const EXPIRY_OPTIONS = [
  { label: "90日", value: "90" },
  { label: "1年", value: "365" },
  { label: "期限なし", value: "none" },
];

function expiresAtFromDays(value: string) {
  if (value === "none") return null;

  const days = Number(value);
  if (!Number.isFinite(days)) return null;

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function formatDate(value: string | null) {
  if (!value) return "なし";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function scopeLabel(scopes: ApiTokenScope[]) {
  return scopes.includes("images:read") ? "記録・画像" : "記録";
}

export default function ApiTokensSection() {
  const [tokens, setTokens] = useState<ApiTokenListItem[]>([]);
  const [name, setName] = useState("Personal access");
  const [expiryDays, setExpiryDays] = useState("365");
  const [allowImages, setAllowImages] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const scopes = useMemo<ApiTokenScope[]>(() => (
    allowImages ? ["notes:read", "images:read"] : ["notes:read"]
  ), [allowImages]);

  async function loadTokens() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/api-tokens", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "api_token_list_failed");
      }

      setTokens(payload.tokens || []);
    } catch (loadError) {
      console.error(loadError);
      setError("APIトークンの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTokens();
  }, []);

  function createToken() {
    setError(null);
    setCreatedToken(null);
    setBusy(true);

    void (async () => {
      try {
        const response = await fetch("/api/api-tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            scopes,
            expiresAt: expiresAtFromDays(expiryDays),
          }),
        });
        const payload = (await response.json()) as TokenCreateResponse;

        if (!response.ok || !payload.ok || !payload.token || !payload.tokenInfo) {
          throw new Error(payload.error || "api_token_create_failed");
        }

        setTokens((current) => [payload.tokenInfo!, ...current]);
        setCreatedToken(payload.token);
        setCopied(false);
      } catch (createError) {
        console.error(createError);
        setError("APIトークンの作成に失敗しました。");
      } finally {
        setBusy(false);
      }
    })();
  }

  function revokeToken(id: string) {
    setError(null);
    setBusy(true);

    void (async () => {
      try {
        const response = await fetch(`/api/api-tokens/${id}`, { method: "DELETE" });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "api_token_revoke_failed");
        }

        setTokens((current) => current.filter((token) => token.id !== id));
      } catch (revokeError) {
        console.error(revokeError);
        setError("APIトークンの失効に失敗しました。");
      } finally {
        setBusy(false);
      }
    })();
  }

  async function copyToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-[var(--primary-text)]" />
        <h2 className="text-base font-semibold text-[var(--text)]">APIアクセス</h2>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-[var(--text)]">
          名前
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-[var(--text)]">
            有効期限
            <select
              value={expiryDays}
              onChange={(event) => setExpiryDays(event.target.value)}
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-h-11 items-center gap-2 self-end rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)]">
            <input
              type="checkbox"
              checked={allowImages}
              onChange={(event) => setAllowImages(event.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            画像ファイルを許可
          </label>
        </div>

        <button
          type="button"
          onClick={createToken}
          disabled={busy || name.trim().length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={18} />
          作成
        </button>
      </div>

      {createdToken && (
        <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--text)]">新しいトークン</p>
            <button
              type="button"
              onClick={copyToken}
              className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
              aria-label="APIトークンをコピー"
              title="コピー"
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}
            </button>
          </div>
          <code className="mt-2 block max-h-28 overflow-auto break-all rounded-md bg-[var(--surface-2)] p-2 text-xs text-[var(--text)]">
            {createdToken}
          </code>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5 border-t border-[var(--border)]">
        {loading ? (
          <p className="py-4 text-sm text-[var(--text-muted)]">読み込み中</p>
        ) : tokens.length === 0 ? (
          <p className="py-4 text-sm text-[var(--text-muted)]">有効なAPIトークンはありません。</p>
        ) : (
          tokens.map((token) => (
            <div key={token.id} className="grid gap-3 border-b border-[var(--border)] py-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">{token.name}</p>
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                    {scopeLabel(token.scopes)}
                  </span>
                </div>
                <p className="mt-1 break-all text-xs text-[var(--text-muted)]">{token.tokenPrefix}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  期限 {formatDate(token.expiresAt)} / 最終利用 {formatDate(token.lastUsedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revokeToken(token.id)}
                disabled={busy}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={16} />
                失効
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
