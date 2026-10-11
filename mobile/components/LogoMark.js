import React from 'react';
import Svg, { Rect, Path, Circle } from 'react-native-svg';

const MARK_COLOR = '#B07CC0';
const BADGE_COLOR = '#0B0B10';

/** SOS-Vidha brand mark: "SOS" over a map pin and folded map, on a dark badge. Decorative. */
export default function LogoMark({ size = 40, rounded = true }) {
  const stroke = { stroke: MARK_COLOR, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect width="100" height="100" rx={rounded ? 22 : 0} fill={BADGE_COLOR} />

      <Path d="M37 16 C34 12 25 12 24 18 C23 24 37 24 36 31 C35 37 25 37 22 32" {...stroke} />
      <Circle cx="50" cy="24" r="10" {...stroke} />
      <Path d="M48 28 Q53 31 56 25" {...stroke} />
      <Path d="M76 16 C73 12 64 12 63 18 C62 24 76 24 75 31 C74 37 64 37 61 32" {...stroke} />

      <Path d="M50 61 C46 56 43.5 52.5 43.5 48.5 A6.5 6.5 0 1 1 56.5 48.5 C56.5 52.5 54 56 50 61 Z" {...stroke} />
      <Circle cx="50" cy="48.5" r="2.2" {...stroke} />

      <Path d="M30 61 L44 61 M56 61 L70 61 L80 84 L20 84 L30 61" {...stroke} />
      <Path d="M26 70 L42 70 L41 84" {...stroke} />
      <Path d="M42 76 L60 76" {...stroke} />
      <Path d="M58 61 L59 70 L74 70" {...stroke} />
      <Path d="M61 70 L63 84" {...stroke} />
    </Svg>
  );
}
