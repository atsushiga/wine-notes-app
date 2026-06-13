"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import BottomNav, { isNavigationHidden } from "@/components/bottom-nav";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { cn } from "@/lib/utils";

type NavigationFrameProps = {
    children: ReactNode;
};

export function NavigationFrame({ children }: NavigationFrameProps) {
    const pathname = usePathname();
    const showNavigation = !isNavigationHidden(pathname);

    return (
        <>
            <div
                className={cn(
                    "min-h-screen",
                    showNavigation && "md:pl-60"
                )}
            >
                <main
                    id="main-content"
                    tabIndex={-1}
                    className={cn(showNavigation && "pb-28 md:pb-0")}
                >
                    {children}
                </main>
            </div>
            <PwaInstallPrompt />
            {showNavigation ? <BottomNav /> : null}
        </>
    );
}
