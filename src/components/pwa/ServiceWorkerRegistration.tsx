"use client";

import { useEffect } from "react";

function isServiceWorkerSupported() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in window.navigator)) return false;
  return true;
}

function canRegisterServiceWorker() {
  if (!isServiceWorkerSupported()) return false;
  if (process.env.NODE_ENV !== "production") return false;

  const { hostname, protocol } = window.location;
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";

  return protocol === "https:" || isLocalhost;
}

async function clearLocalServiceWorkers() {
  if (!isServiceWorkerSupported()) return;

  const registrations = await window.navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (!("caches" in window)) return;

  const cacheNames = await window.caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith("wine-notes-"))
      .map((cacheName) => window.caches.delete(cacheName)),
  );
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      clearLocalServiceWorkers().catch((error) => {
        console.info("Service worker cleanup skipped:", error);
      });
      return;
    }

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
