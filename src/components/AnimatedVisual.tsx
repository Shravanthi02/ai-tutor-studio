import { useMemo, useEffect, useState } from "react";

/* ─── Theme database for fallback animated backgrounds ─── */
const THEME_MAPS: { keywords: string[]; bg: string; accent: string }[] = [
  { keywords: ["plant","leaf","photosynthesis","tree","flower","oxygen","glucose"], bg: "#061a0c", accent: "34 197 94" },
  { keywords: ["sun","light","energy","solar","star","radiation"], bg: "#1a1000", accent: "245 158 11" },
  { keywords: ["water","ocean","river","rain","wave","sea","ice"], bg: "#001220", accent: "59 130 246" },
  { keywords: ["cell","dna","molecule","atom","protein","gene"], bg: "#120822", accent: "168 85 247" },
  { keywords: ["earth","planet","space","orbit","gravity","moon","galaxy"], bg: "#060612", accent: "99 102 241" },
  { keywords: ["fire","burn","reaction","chemical","acid"], bg: "#1a0606", accent: "239 68 68" },
  { keywords: ["electric","circuit","current","voltage","magnet"], bg: "#001a22", accent: "6 182 212" },
  { keywords: ["heart","blood","lung","brain","body","muscle","bone"], bg: "#1a0610", accent: "244 63 94" },
  { keywords: ["earthquake","tectonic","plate","seismic","fault","volcano"], bg: "#1a0a00", accent: "234 88 12" },
  { keywords: ["animal","species","habitat","ecosystem","evolution"], bg: "#0a1a0a", accent: "74 222 128" },
];

const DEFAULT_THEME = { bg: "#0d1117", accent: "148 163 184" };

function getTheme(text: string) {
  const lower = text.toLowerCase();
  let best = { theme: DEFAULT_THEME as any, score: 0 };
  for (const theme of THEME_MAPS) {
    const score = theme.keywords.filter(kw => lower.includes(kw)).length;
    if (score > best.score) best = { theme, score };
  }
  return best.score > 0 ? best.theme : DEFAULT_THEME;
}

interface AnimatedVisualProps {
  text: string;
  sceneIndex: number;
  animKey: number;
  imageUrl?: string;
}

const AnimatedVisual = ({ text, sceneIndex, animKey, imageUrl }: AnimatedVisualProps) => {
  const theme = useMemo(() => getTheme(text), [text]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [imageUrl, animKey]);

  const ac = theme.accent;

  // If we have a generated image, show it with Ken Burns effect
  if (imageUrl && !imgError) {
    return (
      <div className="absolute inset-0 overflow-hidden" key={animKey} style={{ background: theme.bg }}>
        <img
          src={imageUrl}
          alt=""
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{
            opacity: imgLoaded ? 1 : 0,
            animation: imgLoaded ? `kenBurns ${15 + (sceneIndex % 3) * 5}s ease-in-out infinite alternate` : "none",
          }}
        />
        {/* Loading shimmer while image loads */}
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `rgba(${ac}, 0.4)`, borderTopColor: "transparent" }} />
          </div>
        )}
      </div>
    );
  }

  // Fallback: themed gradient background
  return (
    <div className="absolute inset-0 overflow-hidden" key={animKey} style={{ background: theme.bg }}>
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse 70% 50% at 30% 40%, rgba(${ac}, 0.2) 0%, transparent 70%),
          radial-gradient(ellipse 50% 70% at 70% 60%, rgba(${ac}, 0.1) 0%, transparent 60%)
        `,
        animation: "meshMove 14s ease-in-out infinite alternate",
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)",
      }} />
    </div>
  );
};

export default AnimatedVisual;
