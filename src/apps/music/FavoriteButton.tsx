import { useState } from "react";
import { Icon } from "./icons";

export function FavoriteButton({ title, favorite, onToggle }: {
  title: string;
  favorite: boolean;
  onToggle: () => void;
}) {
  const [burst, setBurst] = useState(0);
  return <button
    type="button"
    aria-label={`${favorite ? "取消喜欢" : "喜欢"} ${title}`}
    aria-pressed={favorite}
    className={`nm-favorite${favorite ? " selected" : ""}`}
    onClick={() => { if (!favorite) setBurst((value) => value + 1); onToggle(); }}
  >
    <span key={burst} className={burst ? "nm-heart-pop" : ""}><Icon name="heart" size={19} /></span>
    {burst > 0 && <span key={`burst-${burst}`} className="nm-heart-burst" aria-hidden="true" onAnimationEnd={() => setBurst(0)}>
      <i>♥</i><i>♥</i><i>♥</i><i>♥</i>
    </span>}
  </button>;
}
