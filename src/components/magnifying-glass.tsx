import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

// A clean, hand-free magnifying glass: lens + a FULL vertical handle, no fingers, so it
// stays crisp at any zoom and its handle can submerge straight into Enola's raised fist.
// Colours match her art: warm brass ring, cream lens, wooden handle.
//
// Geometry (viewBox 100x195):
//   lens center (50, 50), ring radius 40, lens radius 32
//   handle is VERTICAL on x=50, running y=88 -> y=180. It runs THROUGH her fist and emerges
//   just below it, so her fingers wrap a continuous handle (no stub cut off inside the grip).
//   index.tsx aligns x=50 to her grip column and positions the fist over the handle's midrun.
export function MagnifyingGlass({ size = 100 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.95} viewBox="0 0 100 195">
      <Defs>
        <LinearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E8CBA0" />
          <Stop offset="0.5" stopColor="#B88951" />
          <Stop offset="1" stopColor="#7A5A32" />
        </LinearGradient>
        <LinearGradient id="wood" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#B07C42" />
          <Stop offset="0.5" stopColor="#E0A868" />
          <Stop offset="1" stopColor="#8B5E30" />
        </LinearGradient>
        <LinearGradient id="lens" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FBF3E7" />
          <Stop offset="1" stopColor="#E3D2BC" />
        </LinearGradient>
        {/* soft golden bloom — glowing at the brass ring, feathering out to nothing */}
        <RadialGradient id="glow" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0.68" stopColor="#F6CF7C" stopOpacity="0.9" />
          <Stop offset="0.80" stopColor="#EEBE5E" stopOpacity="0.6" />
          <Stop offset="1" stopColor="#EEBE5E" stopOpacity="0" />
        </RadialGradient>
        {/* golden aura down the handle — bright at the wood, feathering to nothing at the sides */}
        <LinearGradient id="handleGlow" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#EEBE5E" stopOpacity="0" />
          <Stop offset="0.5" stopColor="#F6CF7C" stopOpacity="0.75" />
          <Stop offset="1" stopColor="#EEBE5E" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* golden glow around the handle bar (drawn first, behind the wood) */}
      <Rect x="28" y="84" width="44" height="100" rx="22" fill="url(#handleGlow)" />
      {/* golden glow behind the lens so it reads as a shiny focal point, not a traced hand */}
      <Circle cx="50" cy="50" r="50" fill="url(#glow)" />

      {/* vertical wooden handle — runs through her fist and emerges just below it */}
      <Rect x="43" y="88" width="14" height="92" rx="7" fill="url(#wood)" />
      {/* brass collar joining ring to handle */}
      <Rect x="41" y="80" width="18" height="14" rx="4" fill="#8B5E30" />

      {/* brass ring */}
      <Circle cx="50" cy="50" r="40" fill="url(#brass)" />
      {/* glass lens */}
      <Circle cx="50" cy="50" r="32" fill="url(#lens)" />
      {/* highlight glints on the lens */}
      <Ellipse cx="39" cy="38" rx="13" ry="8" fill="#FFFFFF" opacity="0.85" transform="rotate(-25 39 38)" />
      <Ellipse cx="62" cy="60" rx="6" ry="4" fill="#FFFFFF" opacity="0.5" transform="rotate(-25 62 60)" />
    </Svg>
  );
}
