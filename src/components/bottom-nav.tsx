"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotebookPen, List, BarChart2, Settings, Sparkles } from "lucide-react";

export default function BottomNav() {
    const pathname = usePathname();
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

    return (
        <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-[var(--card-bg)] shadow-lg z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                <Link
                    href="/"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive("/") ? "text-[var(--primary)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                >
                    <NotebookPen size={24} />
                    <span className="text-xs font-medium">記録</span>
                </Link>
                <Link
                    href="/ai-explainer"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive("/ai-explainer")
                        ? "text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                >
                    <Sparkles size={24} />
                    <span className="text-xs font-medium">AI解説</span>
                </Link>
                <Link
                    href="/tasting-notes"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive("/tasting-notes")
                        ? "text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                >
                    <List size={24} />
                    <span className="text-xs font-medium">一覧</span>
                </Link>
                <Link
                    href="/statistics"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive("/statistics")
                        ? "text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                >
                    <BarChart2 size={24} />
                    <span className="text-xs font-medium">統計</span>
                </Link>
                <Link
                    href="/settings"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive("/settings")
                        ? "text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                >
                    <Settings size={24} />
                    <span className="text-xs font-medium">設定</span>
                </Link>
            </div>
        </div>
    );
}
