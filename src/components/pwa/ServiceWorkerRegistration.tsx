"use client";

import { useEffect } from "react";

function canRegisterServiceWorker() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in window.navigator)) return false;

  const { hostname, protocol } = window.location;
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  return protocol === "https:" || isLocalhost;
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!canRegisterServiceWorker()) return;

    const register = async () => {
      try {
        const registration = await window.navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        await registration.update();
      } catch (error) {
        console.info("Service worker registration skipped:", error);
      }
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
