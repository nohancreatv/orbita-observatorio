type AdSlotProps = {
  placement: "sidebar-left" | "sidebar-right" | "feed-mobile";
  className?: string;
};

const placementCopy: Record<AdSlotProps["placement"], string> = {
  "sidebar-left": "Lateral esquerda",
  "sidebar-right": "Lateral direita",
  "feed-mobile": "Conteúdo patrocinado",
};

/**
 * Inventário publicitário estável e livre de scripts de terceiros.
 * A integração com Google Ads deve preencher este contêiner somente após a
 * configuração do publisher ID e da política de consentimento.
 */
export function AdSlot({ placement, className = "" }: AdSlotProps) {
  return <section className={`ad-slot ad-slot--${placement} ${className}`} data-ad-slot={placement} aria-label={`Espaço publicitário: ${placementCopy[placement]}`}>
    <span className="ad-slot__eyebrow">Espaço publicitário</span>
    <span className="ad-slot__placement">{placementCopy[placement]}</span>
  </section>;
}
