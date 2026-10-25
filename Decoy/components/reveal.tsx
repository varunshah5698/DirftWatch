"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll-reveal wrapper used by the marketing pages.
 *
 * Content renders hidden and fades/slides in the first time it intersects the
 * viewport. Three safety nets keep it from ever trapping content invisible:
 * a fallback timer, an explicit no-script CSS rule (`.reveal` in globals.css)
 * and an immediate reveal when the user prefers reduced motion.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  /** Stagger delay in ms, applied via transition-delay. */
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section" | "header";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(el);
    // Fallback: never leave content hidden if the observer misbehaves.
    const timer = setTimeout(() => setShown(true), 1800);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Cast to a concrete tag: a bare React.ElementType is not guaranteed to be
  // valid JSX across @types/react versions, and the ref is cast to match.
  const Tag = as as "div";

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={`reveal ${className}`}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(22px)",
        transition: `opacity 640ms ease ${delay}ms, transform 640ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
}