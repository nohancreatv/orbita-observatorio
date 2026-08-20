import { useEffect } from "react";

const SITE_ORIGIN = "https://isswatcher-8zu9asw5.manus.space";
const DEFAULT_IMAGE = `${SITE_ORIGIN}/manus-storage/orbita-logo_99dcd0cb.png`;

type SeoHeadProps = { title: string; description: string; path: string; noIndex?: boolean };

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

export function SeoHead({ title, description, path, noIndex = false }: SeoHeadProps) {
  useEffect(() => {
    const canonicalUrl = new URL(path, SITE_ORIGIN).toString();
    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow");
    setMeta("property", "og:type", "website");
    setMeta("property", "og:locale", "pt_BR");
    setMeta("property", "og:site_name", "Órbita");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:image", DEFAULT_IMAGE);
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", DEFAULT_IMAGE);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = canonicalUrl;
  }, [description, noIndex, path, title]);

  return null;
}
