"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { BarChart2, List, LoaderCircle, NotebookPen, Settings, Sparkles, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
    href: string;
    label: string;
    Icon: LucideIcon;
};

const navItems: NavItem[] = [
    { href: "/", label: "記録", Icon: NotebookPen },
    { href: "/ai-explainer", label: "AI解説", Icon: Sparkles },
    { href: "/tasting-notes", label: "一覧", Icon: List },
    { href: "/statistics", label: "統計", Icon: BarChart2 },
    { href: "/settings", label: "設定", Icon: Settings },
];

function shouldIgnoreNavigationClick(event: MouseEvent<HTMLAnchorElement>) {
    return (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
        );
    }

export default function BottomNav() {
    const pathname = usePathname();
    const [pendingNavigation, setPendingNavigation] = useState<{ href: string; from: string } | null>(null);
    const pendingHref = pendingNavigation?.from === pathname ? pendingNavigation.href : null;
    const shouldHideNav =
        pathname === "/login" ||
        pathname === "/signup" ||
        pathname === "/set-password" ||
        pathname === "/ai-explainer/result" ||
        pathname.startsWith("/ai-explainer/result/") ||
        pathname.startsWith("/auth/");

    if (shouldHideNav) {
        return null;
    }

    const isActive = (path: string) => {
        if (path === "/") return pathname === "/";
        return pathname === path || pathname.startsWith(`${path}/`);
    };

    const handleNavClick = (href: string, event: MouseEvent<HTMLAnchorElement>) => {
        if (shouldIgnoreNavigationClick(event) || isActive(href)) {
            setPendingNavigation(null);
            return;
        }

        setPendingNavigation({ href, from: pathname });
    };

    return (
        <nav
            aria-label="主要ナビゲーション"
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--card-bg)] shadow-lg pb-safe"
        >
            {pendingHref ? (
                <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-[var(--accent-muted)]">
                    <div className="bottom-nav-progress h-full w-1/3 rounded-full bg-[var(--primary)]" />
                </div>
            ) : null}
            <div className="flex justify-around items-center h-16">
                {navItems.map(({ href, label, Icon }) => {
                    const active = isActive(href);
                    const pending = pendingHref === href && !active;

                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? "page" : undefined}
                            aria-busy={pending || undefined}
                            onClick={(event) => handleNavClick(href, event)}
                            className={cn(
                                "relative flex h-full w-full flex-col items-center justify-center space-y-1 overflow-hidden transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset",
                                active
                                    ? "text-[var(--primary)]"
                                    : "text-[var(--text-muted)] hover:text-[var(--text)]",
                                pending && "scale-[0.98] bg-[var(--accent-muted)] text-[var(--primary)]"
                            )}
                        >
                            <span className="relative flex h-7 w-7 items-center justify-center">
                                <Icon
                                    size={24}
                                    aria-hidden="true"
                                    className={cn(
                                        "transition-transform duration-150",
                                        pending && "scale-90 opacity-60"
                                    )}
                                />
                                {pending ? (
                                    <LoaderCircle
                                        size={16}
                                        aria-hidden="true"
                                        className="absolute -right-1 -top-1 animate-spin text-[var(--primary)] motion-reduce:animate-pulse"
                                    />
                                ) : null}
                            </span>
                            <span className="text-xs font-medium">{label}</span>
                            {pending ? <span className="sr-only">移動中</span> : null}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
