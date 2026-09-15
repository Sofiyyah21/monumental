import { useCallback, useEffect, useState } from "react";

const routeChangeEvent = "monumental-route-change";

function currentPath() {
  return window.location.pathname;
}

export function navigate(path: string, replace = false) {
  if (window.location.pathname === path) {
    return;
  }

  if (replace) {
    window.history.replaceState(null, "", path);
  } else {
    window.history.pushState(null, "", path);
  }
  window.dispatchEvent(new Event(routeChangeEvent));
}

export function useBrowserRoute() {
  const [pathname, setPathname] = useState(currentPath);

  useEffect(() => {
    const sync = () => setPathname(currentPath());

    window.addEventListener("popstate", sync);
    window.addEventListener(routeChangeEvent, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(routeChangeEvent, sync);
    };
  }, []);

  const goTo = useCallback((path: string) => navigate(path), []);
  const replaceWith = useCallback((path: string) => navigate(path, true), []);

  return { pathname, navigate: goTo, replace: replaceWith };
}
