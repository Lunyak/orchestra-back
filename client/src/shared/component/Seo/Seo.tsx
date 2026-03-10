import { FC, ReactNode, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { isAbsoluteUrl } from "../../model/siteAssets";

type JsonLd = Record<string, any> | Array<Record<string, any>>;

export type SeoProps = {
  title: string;
  description?: string;
  /**
   * Canonical path starting with "/".
   * Example: "/события/заклятие"
   */
  canonicalPath?: string;
  /**
   * Absolute or relative image URL.
   * If relative, will be prefixed with current origin.
   */
  imageUrl?: string;
  /**
   * OpenGraph type. Defaults to "website".
   */
  ogType?: "website" | "article";
  /**
   * Adds `<meta name="robots" content="noindex, nofollow">`
   */
  noindex?: boolean;
  jsonLd?: JsonLd;
  children?: ReactNode;
};

function getOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location?.origin || "";
}

function toAbsoluteUrl(origin: string, url: string): string {
  const u = (url ?? "").trim();
  if (!u) return "";
  if (isAbsoluteUrl(u)) return u;
  if (!origin) return "";
  return u.startsWith("/") ? `${origin}${u}` : `${origin}/${u}`;
}

export const Seo: FC<SeoProps> = ({
  title,
  description,
  canonicalPath,
  imageUrl,
  ogType = "website",
  noindex,
  jsonLd,
  children,
}) => {
  const origin = getOrigin();

  const canonicalUrl = useMemo(() => {
    const p = (canonicalPath ?? "").trim();
    if (!origin || !p) return "";
    return p.startsWith("/") ? `${origin}${p}` : `${origin}/${p}`;
  }, [origin, canonicalPath]);

  const resolvedImage = useMemo(() => {
    const img = (imageUrl ?? "").trim();
    if (!img) return "";
    return toAbsoluteUrl(origin, img);
  }, [origin, imageUrl]);

  const jsonLdNodes = useMemo(() => {
    if (!jsonLd) return null;
    const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    return items
      .filter(Boolean)
      .map((x, idx) => (
        <script key={idx} type="application/ld+json">
          {JSON.stringify(x)}
        </script>
      ));
  }, [jsonLd]);

  // Meta tags should be single-line; keep page rendering multiline separately.
  const metaDescription = (description ?? "").replace(/\s+/g, " ").trim();

  return (
    <>
      <Helmet>
        <title>{title}</title>
        {metaDescription && <meta name="description" content={metaDescription} />}

        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
        {noindex && <meta name="robots" content="noindex, nofollow" />}

        <meta property="og:type" content={ogType} />
        <meta property="og:locale" content="ru_RU" />
        <meta property="og:site_name" content="Дофамин" />
        <meta property="og:title" content={title} />
        {metaDescription && <meta property="og:description" content={metaDescription} />}
        {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
        {resolvedImage && <meta property="og:image" content={resolvedImage} />}

        <meta name="twitter:card" content={resolvedImage ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={title} />
        {metaDescription && <meta name="twitter:description" content={metaDescription} />}
        {resolvedImage && <meta name="twitter:image" content={resolvedImage} />}

        {jsonLdNodes}
      </Helmet>
      {children}
    </>
  );
};

