import { createElement, Fragment, type CSSProperties, type ElementType, type HTMLAttributes } from "react";

type RevealSegment = { text: string; emphasis?: boolean };

type RevealTextProps = Omit<HTMLAttributes<HTMLElement>, "children" | "className"> & {
  as?: ElementType;
  className?: string;
  delay?: number;
  segments: RevealSegment[];
};

/**
 * Título word-by-word. A animação é disparada pelo TextReveal editorial mais
 * próximo, mantendo o observer único por bloco e evitando trabalho por palavra.
 */
export function RevealText({ as = "h2", className = "", delay = 0, segments, style, ...props }: RevealTextProps & { style?: CSSProperties }) {
  const words = segments.flatMap(segment => segment.text.trim().split(/\s+/).filter(Boolean).map(word => ({ word, emphasis: segment.emphasis })));
  const label = words.map(({ word }) => word).join(" ");

  return createElement(
    as,
    { ...props, className: ["text-reveal-words", className].filter(Boolean).join(" "), "aria-label": label, style: { ...style, "--word-reveal-delay": `${Math.max(0, delay)}ms` } },
    words.map(({ word, emphasis }, index) => (
      <Fragment key={`${word}-${index}`}>
        {index > 0 ? " " : null}
        <span className="word-reveal" aria-hidden="true" style={{ "--word-delay": `${index * 42}ms` } as CSSProperties}>
          <span className="word-reveal__inner">{emphasis ? <em>{word}</em> : word}</span>
        </span>
      </Fragment>
    )),
  );
}
