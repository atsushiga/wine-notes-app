"use client";

import { usePathname } from "next/navigation";
import { Download, Share2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallPlatform = "ios-chrome" | "ios-safari" | "ios-other" | "android" | "desktop";

const DISMISS_KEY = "wine-notes-pwa-install-dismissed-at";
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function getInstallPlatform(): InstallPlatform {
  const ua = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

  if (isIOS && /CriOS/.test(ua)) return "ios-chrome";
  if (isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) return "ios-safari";
  if (isIOS) return "ios-other";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function hasRecentDismissal() {
  try {
    const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) return false;
    return Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures in private browsing modes.
  }
}

function getGuidance(platform: InstallPlatform, canPrompt: boolean) {
  if (canPrompt) {
    return {
      icon: Download,
      title: "アプリとして追加",
      body: "ホーム画面からすぐ開けます。",
      actionLabel: "追加",
    };
  }

  if (platform === "ios-chrome") {
    return {
      icon: Share2,
      title: "ホーム画面に追加",
      body: "Chromeの共有ボタンから「ホーム画面に追加」を選択できます。",
      actionLabel: null,
    };
  }

  if (platform === "ios-safari") {
    return {
      icon: Share2,
      title: "ホーム画面に追加",
      body: "共有メニューから「ホーム画面に追加」を選択できます。",
      actionLabel: null,
    };
  }

  if (platform === "ios-other") {
    return {
      icon: Share2,
      title: "ホーム画面に追加",
      body: "ブラウザの共有メニューから「ホーム画面に追加」を選択できます。",
      actionLabel: null,
    };
  }

  return {
    icon: Download,
    title: "ホーム画面に追加",
    body: "ブラウザメニューから追加できます。",
    actionLabel: null,
  };
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [visible, setVisible] = useState(false);

  const isAuthPath =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/set-password" ||
    pathname.startsWith("/auth/");

  useEffect(() => {
    if (isStandaloneMode() || hasRecentDismissal()) return;

    const currentPlatform = getInstallPlatform();
    const shouldShowManualGuidance =
      currentPlatform === "ios-chrome" ||
      currentPlatform === "ios-safari" ||
      currentPlatform === "ios-other";

    const timer = window.setTimeout(() => {
      setPlatform(currentPlatform);
      if (shouldShowManualGuidance) {
        setVisible(true);
      }
    }, 1200);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPlatform(getInstallPlatform());
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const guidance = useMemo(() => {
    if (!platform) return null;
    return getGuidance(platform, Boolean(deferredPrompt));
  }, [deferredPrompt, platform]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (choice.outcome === "accepted") {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    rememberDismissal();
    setVisible(false);
  };

  if (!visible || !guidance || isAuthPath) {
    return null;
  }

  const Icon = guidance.icon;

  return (
    <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-3 text-[var(--text)] shadow-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--app-bg)] text-[var(--primary-text)]">
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">{guidance.title}</p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{guidance.body}</p>
        </div>
        {guidance.actionLabel && (
          <button
            type="button"
            onClick={handleInstall}
            className="min-h-10 rounded-lg bg-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary-foreground)]"
          >
            {guidance.actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          aria-label="閉じる"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
