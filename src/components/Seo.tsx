import { useEffect } from "react";

/**
 * Per-page document metadata for the public site. The SPA shipped a
 * single <title>/<meta description> for every route, which reads as
 * duplicate pages to search engines. This swaps them on mount (and
 * mirrors og:/twitter: tags so shared links carry the right text).
 *
 * Titles/descriptions are intentionally English-only: the site's
 * audience is international and search traffic is expected in English.
 */
type Props = {
  title: string;
  description?: string;
};

const setMeta = (selector: string, content: string) => {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) el.setAttribute("content", content);
};

const Seo = ({ title, description }: Props) => {
  useEffect(() => {
    document.title = title;
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[name="twitter:title"]', title);
    if (description) {
      setMeta('meta[name="description"]', description);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[name="twitter:description"]', description);
    }
  }, [title, description]);

  return null;
};

export default Seo;
