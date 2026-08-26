import { createElement, useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from "react";

type TextRevealStyle = CSSProperties & { "--text-reveal-delay"?: string };

type TextRevealProps = Omit<HTMLAttributes<HTMLElement>, "style" | "className"> & {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  delay?: number;
  style?: CSSProperties;
};

/**
 * Revela blocos editoriais apenas quando entram no campo de visão.
 * O estado reduzido de movimento é respeitado pelo CSS e pelo observer.
 */
export function TextReveal({ as = "div", children, className = "", delay = 0, style, ...props }: TextRevealProps) {
  const elementRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rect = element.getBoundingClientRect();
    const isInitiallyVisible = rect.bottom > 0 && rect.top < window.innerHeight * 0.98;
    if (prefersReducedMotion || !("IntersectionObserver" in window) || isInitiallyVisible) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setIsVisible(true);
      observer.unobserve(entry.target);
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const revealStyle: TextRevealStyle = { ...style, "--text-reveal-delay": `${Math.max(0, delay)}ms` };
  const combinedClassName = ["text-reveal", isVisible ? "is-visible" : "", className].filter(Boolean).join(" ");

  return createElement(as, { ...props, ref: elementRef, className: combinedClassName, style: revealStyle }, children);
}
