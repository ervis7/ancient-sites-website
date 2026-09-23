"use client";

import { MouseEvent as ReactMouseEvent, useEffect, useState } from "react";

const profileBackgroundSelector = [
  ".accountPanelBackground",
  ".leaderboardEntryBackground",
  ".friendProfileBackground",
].join(",");

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function InterfaceEffects() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("explore-theme");
    const initialTheme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  useEffect(() => {
    const cleanups = new Set<() => void>();

    const attachBackgroundParallax = (background: Element) => {
      if (
        !(background instanceof HTMLElement) ||
        background.dataset.parallaxReady
      ) {
        return;
      }
      const windowElement = background.parentElement;
      if (!windowElement) return;

      background.dataset.parallaxReady = "true";
      background.classList.add("profileBackgroundParallax");
      let animationFrame = 0;

      const move = (event: PointerEvent) => {
        if (
          event.pointerType === "touch" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          return;
        }
        const bounds = windowElement.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const horizontal =
          (event.clientX - bounds.left) / bounds.width - 0.5;
        const vertical =
          (event.clientY - bounds.top) / bounds.height - 0.5;

        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(() => {
          background.style.setProperty(
            "--background-shift-x",
            `${horizontal * -8}px`,
          );
          background.style.setProperty(
            "--background-shift-y",
            `${vertical * -6}px`,
          );
        });
      };

      const reset = () => {
        window.cancelAnimationFrame(animationFrame);
        background.style.setProperty("--background-shift-x", "0px");
        background.style.setProperty("--background-shift-y", "0px");
      };

      windowElement.addEventListener("pointermove", move);
      windowElement.addEventListener("pointerleave", reset);
      cleanups.add(() => {
        window.cancelAnimationFrame(animationFrame);
        windowElement.removeEventListener("pointermove", move);
        windowElement.removeEventListener("pointerleave", reset);
      });
    };

    const scan = () =>
      document
        .querySelectorAll(profileBackgroundSelector)
        .forEach(attachBackgroundParallax);

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  function toggleTheme(event: ReactMouseEvent<HTMLButtonElement>) {
    event.currentTarget.blur();
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem("explore-theme", nextTheme);
  }

  return (
    <button
      type="button"
      className="themeToggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.7 8.7 0 1 0 20.5 15.2Z" />
        </svg>
      )}
    </button>
  );
}
