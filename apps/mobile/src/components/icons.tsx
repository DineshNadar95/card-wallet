import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type IconProps = { color: ColorValue; size?: number };

const base = (size: number, color: ColorValue) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

// Paths from design/Main.dc.html.
export function HomeIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M4 11l8-7 8 7" />
      <Path d="M6 10v9h12v-9" />
    </Svg>
  );
}

export function CardsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Rect x="3" y="6" width="18" height="13" rx="2.5" />
      <Path d="M3 10h18" />
    </Svg>
  );
}

export function OffersIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Path d="M20.6 13.4 11 3.8H4v7l9.6 9.6a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8z" />
      <Circle cx="7.5" cy="7.5" r="1.3" />
    </Svg>
  );
}

export function CompareIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size, color)}>
      <Rect x="3" y="4" width="7" height="16" rx="1.5" />
      <Rect x="14" y="4" width="7" height="16" rx="1.5" />
    </Svg>
  );
}
