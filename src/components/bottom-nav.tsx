"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
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

export function isNavigationHidden(pathname: string) {
    return (
        pathname === "/login" ||
        pathname === "/signup" ||
        pathname === "/set-password" ||
        pathname === "/terms" ||
        pathname === "/privacy" ||
        pathname === "/contact" ||
        pathname === "/reset-password" ||
        pathname.startsWith("/reset-password/") ||
        pathname === "/ai-explainer/result" ||
        pathname.startsWith("/ai-explainer/result/") ||
        pathname.startsWith("/auth/")
    );
}

function useNavigationState() {
    const pathname = usePathname();
    const [pendingNavigation, setPendingNavigation] = useState<{ href: string; from: string } | null>(null);
    const pendingHref = pendingNavigation?.from === pathname ? pendingNavigation.href : null;

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setPendingNavigation(null);
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [pathname]);

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

    return { handleNavClick, isActive, pendingHref };
}

function DesktopSidebar() {
    const { handleNavClick, isActive, pendingHref } = useNavigationState();

    return (
        <aside
            aria-label="主要ナビゲーション"
            className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-6 md:flex md:flex-col"
        >
            {pendingHref ? (
                <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-[var(--color-wine-red-soft)]">
                    <div className="bottom-nav-progress h-full w-1/3 rounded-full bg-[var(--primary)]" />
                </div>
            ) : null}

            <Link
                href="/"
                className="mb-8 block rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
                <span className="font-wine block text-2xl font-semibold leading-none tracking-normal text-[var(--text)]">
                    WineNotes
                </span>
                <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-gold)]">
                    Digital Sommelier
                </span>
            </Link>

            <div className="flex flex-1 flex-col gap-1.5">
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
                                "group relative flex h-11 items-center gap-3 rounded-lg border border-transparent px-3 text-sm font-medium transition-[background-color,border-color,color,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                                active
                                    ? "border-[var(--color-wine-red)]/25 bg-[var(--color-wine-red-soft)] text-[var(--text)]"
                                    : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
                                pending && "scale-[0.98] border-[var(--color-wine-red)]/25 bg-[var(--color-wine-red-soft)] text-[var(--text)]"
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "absolute left-0 top-2 h-7 w-0.5 rounded-full transition-opacity",
                                    active ? "bg-[var(--primary)] opacity-100" : "opacity-0"
                                )}
                            />
                            <Icon size={20} aria-hidden="true" className={active ? "text-[var(--primary)]" : undefined} />
                            <span>{label}</span>
                            {pending ? (
                                <LoaderCircle size={15} aria-hidden="true" className="ml-auto animate-spin text-[var(--primary)] motion-reduce:animate-pulse" />
                            ) : null}
                            {pending ? <span className="sr-only">移動中</span> : null}
                        </Link>
                    );
                })}
            </div>
        </aside>
    );
}

function MobileBottomNav() {
    const { handleNavClick, isActive, pendingHref } = useNavigationState();

    return (
        <nav
            aria-label="主要ナビゲーション"
            className="app-navigation fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-50 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--sidebar-bg)]/92 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden"
        >
            {pendingHref ? (
                <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-[var(--color-wine-red-soft)]">
                    <div className="bottom-nav-progress h-full w-1/3 rounded-full bg-[var(--primary)]" />
                </div>
            ) : null}
            <div className="grid h-16 grid-cols-5">
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
                                "relative flex h-full min-w-0 flex-col items-center justify-center gap-1 overflow-hidden px-1 text-center transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset",
                                active
                                    ? "bg-[var(--color-wine-red-soft)] text-[var(--primary)]"
                                    : "text-[var(--text-muted)] hover:text-[var(--text)]",
                                pending && "scale-[0.98] bg-[var(--color-wine-red-soft)] text-[var(--primary)]"
                            )}
                        >
                            <span className="relative flex h-6 w-6 items-center justify-center">
                                <Icon
                                    size={20}
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
                            <span className="truncate text-[11px] font-semibold leading-none">{label}</span>
                            {pending ? <span className="sr-only">移動中</span> : null}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

export default function BottomNav() {
    const pathname = usePathname();

    if (isNavigationHidden(pathname)) {
        return null;
    }

    return (
        <>
            <DesktopSidebar />
            <MobileBottomNav />
        </>
    );
}
