import { useEffect, useState } from "react";
import { fetchArticleImage } from "../extract/articleImage";
import { patchArticleImage } from "../storage/db";

export function useArticleImage(articleId: string, articleUrl: string, existing = ""): string {
  const [resolved, setResolved] = useState(existing);

  useEffect(() => {
    if (existing) {
      setResolved(existing);
      return;
    }
    if (!articleUrl) return;

    let cancelled = false;
    void fetchArticleImage(articleUrl).then((image) => {
      if (cancelled || !image) return;
      setResolved(image);
      if (articleId) void patchArticleImage(articleId, image);
    });

    return () => {
      cancelled = true;
    };
  }, [articleId, articleUrl, existing]);

  return existing || resolved;
}
