/** Single-keyword lanes — multi-word queries AND-match and return few hits. */
export type TopicLane = {
  id: string;
  label: string;
  query: string;
  icon: string;
};

export const TOPIC_LANES: TopicLane[] = [
  { id: "israel", label: "Israel & Middle East", query: "israel", icon: "🇮🇱" },
  { id: "ai", label: "AI & ML", query: "ai", icon: "🤖" },
  { id: "space", label: "Space", query: "space", icon: "🚀" },
  { id: "tech", label: "Technology", query: "tech", icon: "💻" },
  { id: "car", label: "Cars & EV", query: "car", icon: "🚗" },
  { id: "crime", label: "Crime & Justice", query: "crime", icon: "⚖️" },
  { id: "market", label: "Markets", query: "market", icon: "📈" },
  { id: "health", label: "Health", query: "health", icon: "🏥" },
  { id: "fashion", label: "Fashion", query: "fashion", icon: "👗" },
  { id: "gaming", label: "Gaming", query: "gaming", icon: "🎮" },
  { id: "film", label: "Film & TV", query: "film", icon: "🎬" },
  { id: "china", label: "China", query: "china", icon: "🇨🇳" },
  { id: "ukraine", label: "Ukraine", query: "ukraine", icon: "🇺🇦" },
  { id: "science", label: "Science", query: "science", icon: "🔬" },
  // Distinct lanes — no overlap with geo/tech/entertainment clusters above
  { id: "war", label: "War & Conflict", query: "war", icon: "⚔️" },
  { id: "cyber", label: "Cybersecurity", query: "cyber", icon: "🔐" },
  { id: "music", label: "Music", query: "music", icon: "🎵" },
  { id: "tcm", label: "TCM & Alternative", query: "tcm", icon: "🌿" },
  { id: "sport", label: "Sports", query: "sport", icon: "⚽" },
  { id: "food", label: "Food & Dining", query: "food", icon: "🍽️" },
];

export const TOPIC_LANE_BY_ID = new Map(TOPIC_LANES.map((l) => [l.id, l]));
