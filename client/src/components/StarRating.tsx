// StarRating component — renders filled/half/empty stars
import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  size?: number;
  showLabel?: boolean;
}

export default function StarRating({ rating, size = 14, showLabel = true }: StarRatingProps) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      stars.push(<Star key={i} size={size} className="star-filled" />);
    } else if (rating >= i - 0.5) {
      // Half star using clip
      stars.push(
        <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
          <Star size={size} className="star-empty absolute inset-0" />
          <span
            className="absolute inset-0 overflow-hidden"
            style={{ width: "50%" }}
          >
            <Star size={size} className="star-filled" />
          </span>
        </span>
      );
    } else {
      stars.push(<Star key={i} size={size} className="star-empty" />);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">{stars}</div>
      {showLabel && (
        <span className="text-xs font-semibold ml-1" style={{ color: "#303030" }}>{rating.toFixed(1)}</span>
      )}
    </div>
  );
}
