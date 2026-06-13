"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import BottomNav, { isNavigationHidden } from "@/components/bottom-nav";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";

type NavigationFrameProps = {
    children: ReactNode;
};

export function NavigationFrame({ children }: NavigationFrameProps) {
    const pathname = usePathname();
    const showNavigation = !isNavigationHidden(pathname);

    return (
        <>
            <div
                id="main-content"
                tabIndex={-1}
                className={showNavigation ? "md:pl-56" : undefined}
            >
                {children}
            </div>
            <PwaInstallPrompt />
            {showNavigation ? <BottomNav /> : null}
        </>
    );
}
