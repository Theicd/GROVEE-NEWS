import { useArticleImage } from "../hooks/useArticleImage";

type ArticleMediaProps = {
  articleId: string;
  url: string;
  title: string;
  image?: string;
  variant?: "post" | "card";
};

export function ArticleMedia({
  articleId,
  url,
  title,
  image = "",
  variant = "post",
}: ArticleMediaProps) {
  const src = useArticleImage(articleId, url, image);

  if (variant === "card") {
    return (
      <div className="gn-card__media">
        {src ? (
          <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : (
          <div className="gn-card__placeholder" aria-hidden="true" />
        )}
      </div>
    );
  }

  if (!src) return null;

  return (
    <a
      className="gn-post__media"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open article: ${title}`}
    >
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} />
    </a>
  );
}
