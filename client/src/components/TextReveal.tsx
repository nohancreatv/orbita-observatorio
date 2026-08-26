import { motion, useInView, useReducedMotion } from "framer-motion";
import { useMemo, useRef, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from "react";

type TextRevealProps = Omit<HTMLAttributes<HTMLElement>, "style" | "className"> & {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  delay?: number;
  style?: CSSProperties;
};

/**
 * Entrada editorial acionada apenas quando o bloco cruza o viewport.
 * O componente não observa cada filho e não é usado para telemetria dinâmica
 * ou para o Canvas 3D, mantendo o custo de runtime baixo.
 */
export function TextReveal({ as = "div", children, className = "", delay = 0, style, ...props }: TextRevealProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(elementRef, { once: true, amount: 0.12, margin: "0px 0px -8% 0px" });
  const prefersReducedMotion = useReducedMotion();
  const shouldShow = Boolean(prefersReducedMotion) || isInView;
  const MotionElement = useMemo(() => motion.create(as), [as]);
  const safeDelay = Math.max(0, delay) / 1000;

  return (
    <MotionElement
      {...props}
      ref={elementRef}
      className={["text-reveal", shouldShow ? "is-visible" : "", className].filter(Boolean).join(" ")}
      style={style}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
      animate={shouldShow ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.58, delay: safeDelay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </MotionElement>
  );
}
