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
                    showNavigation && "h-dvh overflow-hidden md:h-auto md:overflow-visible md:pl-60"
                )}
            >
                <main
                    id="main-content"
                    tabIndex={-1}
                    className={cn(showNavigation && "h-[calc(100dvh-5.75rem-env(safe-area-inset-bottom))] overflow-y-auto pb-6 md:h-auto md:overflow-visible md:pb-0")}
                >
                    {children}
                </main>
            </div>
            <PwaInstallPrompt />
            {showNavigation ? <BottomNav /> : null}
        </>
    );
}
