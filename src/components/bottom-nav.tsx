"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List } from "lucide-react";

export default function BottomNav() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white shadow-lg z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                <Link
                    href="/"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive("/") ? "text-rose-600" : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <Home size={24} />
                    <span className="text-xs font-medium">記録</span>
                </Link>
                <Link
                    href="/tasting-notes"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive("/tasting-notes")
                            ? "text-rose-600"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <List size={24} />
                    <span className="text-xs font-medium">一覧</span>
                </Link>
            </div>
        </div>
    );
}
