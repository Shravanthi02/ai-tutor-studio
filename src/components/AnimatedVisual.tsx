import { useMemo, useEffect, useState } from "react";

// Keyword-to-theme mapping for educational topics
const THEME_MAPS: {
  keywords: string[];
  bg: string;
  shapes: string[];
  accent: string;
  svgScene: string;
}[] = [
  {
    keywords: ["plant", "leaf", "chlorophyll", "photosynthesis", "tree", "flower", "root", "seed", "grow", "forest", "vegetation", "oxygen", "carbon dioxide", "glucose"],
    bg: "#0a2e1a",
    shapes: ["🌿", "🍃", "☀️", "🌱", "🌳", "💧"],
    accent: "34 197 94",
    svgScene: "nature",
  },
  {
    keywords: ["sun", "light", "energy", "solar", "star", "heat", "radiation", "ray", "bright", "glow", "spectrum", "wavelength"],
    bg: "#2a1a00",
    shapes: ["☀️", "⚡", "✨", "🔆", "🌟"],
    accent: "245 158 11",
    svgScene: "energy",
  },
  {
    keywords: ["water", "ocean", "river", "rain", "liquid", "flow", "wave", "sea", "ice", "steam", "evapor", "condens", "precipit", "cloud", "cycle"],
    bg: "#001a2e",
    shapes: ["💧", "🌊", "❄️", "🫧", "☁️", "🌧️"],
    accent: "59 130 246",
    svgScene: "water",
  },
  {
    keywords: ["cell", "dna", "molecule", "atom", "protein", "gene", "nucleus", "membrane", "mitochon", "organ", "chloroplast", "ribosom"],
    bg: "#1a0a2e",
    shapes: ["🧬", "🔬", "⚛️", "🧫"],
    accent: "168 85 247",
    svgScene: "micro",
  },
  {
    keywords: ["earth", "planet", "space", "orbit", "gravity", "moon", "universe", "galaxy", "cosmos", "asteroid", "solar system", "telescope"],
    bg: "#0a0a1e",
    shapes: ["🌍", "🌙", "⭐", "🪐", "🚀", "☄️"],
    accent: "99 102 241",
    svgScene: "space",
  },
  {
    keywords: ["fire", "burn", "combust", "reaction", "chemical", "exotherm", "endotherm", "acid", "base", "catalyst", "bond"],
    bg: "#2e0a0a",
    shapes: ["🔥", "⚗️", "💥", "🧪"],
    accent: "239 68 68",
    svgScene: "chemistry",
  },
  {
    keywords: ["electric", "circuit", "current", "voltage", "magnet", "field", "charge", "electron", "battery", "wire", "resistor", "conduct"],
    bg: "#001a2a",
    shapes: ["⚡", "🔋", "🧲", "💡"],
    accent: "6 182 212",
    svgScene: "electric",
  },
  {
    keywords: ["heart", "blood", "lung", "brain", "body", "muscle", "bone", "digest", "breath", "nerve", "immune", "vein", "artery"],
    bg: "#2e0a1a",
    shapes: ["❤️", "🫁", "🧠", "🦴", "🩸"],
    accent: "244 63 94",
    svgScene: "body",
  },
  {
    keywords: ["math", "number", "equation", "calcul", "geometr", "algebra", "triangle", "circle", "angle", "graph", "formula", "theorem"],
    bg: "#0a2a2a",
    shapes: ["📐", "📊", "🔢", "➗", "∑", "π"],
    accent: "20 184 166",
    svgScene: "math",
  },
  {
    keywords: ["history", "war", "king", "empire", "ancient", "civil", "revolution", "century", "dynasty", "battle", "freedom", "independ"],
    bg: "#2a1a0a",
    shapes: ["🏛️", "⚔️", "👑", "📜", "🗿"],
    accent: "180 83 9",
    svgScene: "history",
  },
  {
    keywords: ["computer", "code", "program", "software", "algorithm", "data", "binary", "network", "internet", "server", "digital"],
    bg: "#0a1a0a",
    shapes: ["💻", "🖥️", "⌨️", "🌐", "📡"],
    accent: "34 197 94",
    svgScene: "tech",
  },
  {
    keywords: ["sound", "music", "frequency", "vibrat", "wave", "audio", "hear", "echo", "resonan"],
    bg: "#1a0a2a",
    shapes: ["🎵", "🔊", "🎶", "🎤"],
    accent: "139 92 246",
    svgScene: "sound",
  },
];

const DEFAULT_THEME = {
  bg: "#0d1117",
  shapes: ["✨", "💡", "📚", "🔍", "🎓"],
  accent: "148 163 184",
  svgScene: "default",
};

function getTheme(text: string) {
  const lower = text.toLowerCase();
  // Score each theme by matching keyword count for best fit
  let best = { theme: DEFAULT_THEME, score: 0 };
  for (const theme of THEME_MAPS) {
    const score = theme.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > best.score) best = { theme, score };
  }
  return best.score > 0 ? best.theme : DEFAULT_THEME;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// Extract 3-5 key words from text for display
function extractKeywords(text: string): string[] {
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "for", "of", "and", "or", "but", "this", "that", "these", "those", "it", "its", "they", "them", "by", "with", "from", "as", "into", "through", "which", "where", "when", "how", "what", "who", "each", "every", "all", "both", "can", "will", "be", "has", "have", "had", "do", "does", "did", "not", "no", "so", "if", "then", "than", "very", "also", "just", "about", "more", "most", "some", "any", "other", "such"]);
  const words = text.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase()));
  // Pick evenly spaced words
  const count = Math.min(5, words.length);
  const step = Math.max(1, Math.floor(words.length / count));
  return Array.from({ length: count }, (_, i) => words[i * step]).filter(Boolean).map((w) => w.replace(/[.,!?;:]/g, ""));
}

interface AnimatedVisualProps {
  text: string;
  sceneIndex: number;
  animKey: number;
}

const AnimatedVisual = ({ text, sceneIndex, animKey }: AnimatedVisualProps) => {
  const theme = useMemo(() => getTheme(text), [text]);
  const keywords = useMemo(() => extractKeywords(text), [text]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(t);
  }, [animKey, text]);

  const rand = useMemo(() => seededRandom(sceneIndex * 1000 + animKey), [sceneIndex, animKey]);

  // Create layered particles with varied behaviors
  const particles = useMemo(() => {
    const r = seededRandom(sceneIndex * 1000 + animKey);
    return Array.from({ length: 18 }, (_, i) => {
      const layer = i < 6 ? "back" : i < 12 ? "mid" : "front";
      const sizeMap = { back: 14 + r() * 12, mid: 20 + r() * 16, front: 28 + r() * 20 };
      const opacityMap = { back: 0.15, mid: 0.35, front: 0.6 };
      return {
        id: i,
        layer,
        emoji: theme.shapes[i % theme.shapes.length],
        x: 5 + r() * 90,
        y: 5 + r() * 90,
        size: sizeMap[layer],
        opacity: opacityMap[layer],
        duration: layer === "back" ? 12 + r() * 6 : layer === "mid" ? 8 + r() * 5 : 5 + r() * 4,
        delay: r() * -8,
        driftX: (r() - 0.5) * (layer === "front" ? 80 : 40),
        driftY: -20 - r() * (layer === "front" ? 60 : 30),
        rotate: r() * 360,
        rotateEnd: (r() - 0.5) * 180,
      };
    });
  }, [text, sceneIndex, animKey, theme.shapes]);

  // Orbiting elements around center
  const orbiters = useMemo(() => {
    const r = seededRandom(sceneIndex * 2000 + animKey);
    return Array.from({ length: 4 }, (_, i) => ({
      id: i,
      emoji: theme.shapes[i % theme.shapes.length],
      radius: 80 + i * 45,
      duration: 12 + i * 6,
      delay: i * 2,
      size: 28 - i * 3,
      startAngle: r() * 360,
    }));
  }, [text, sceneIndex, animKey, theme.shapes]);

  // Flowing connection lines
  const connections = useMemo(() => {
    const r = seededRandom(sceneIndex * 3000 + animKey);
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x1: r() * 100,
      y1: r() * 100,
      x2: r() * 100,
      y2: r() * 100,
      duration: 4 + r() * 4,
      delay: r() * 3,
    }));
  }, [sceneIndex, animKey]);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      key={animKey}
      style={{ background: theme.bg }}
    >
      {/* Deep gradient layers */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 25% 30%, rgba(${theme.accent}, 0.15) 0%, transparent 70%),
            radial-gradient(ellipse 60% 80% at 75% 70%, rgba(${theme.accent}, 0.1) 0%, transparent 60%),
            radial-gradient(ellipse 100% 100% at 50% 50%, rgba(${theme.accent}, 0.05) 0%, transparent 80%)
          `,
          animation: "meshMove 12s ease-in-out infinite alternate",
        }}
      />

      {/* SVG connection lines */}
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.08 }}>
        {connections.map((c) => (
          <line
            key={c.id}
            x1={`${c.x1}%`}
            y1={`${c.y1}%`}
            x2={`${c.x2}%`}
            y2={`${c.y2}%`}
            stroke={`rgba(${theme.accent}, 0.5)`}
            strokeWidth="1"
            strokeDasharray="8 4"
            style={{
              animation: `connectionFlow ${c.duration}s linear ${c.delay}s infinite`,
            }}
          />
        ))}
      </svg>

      {/* Pulsing rings - more visible */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: "-10%" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 120 + i * 100,
              height: 120 + i * 100,
              border: `1.5px solid rgba(${theme.accent}, ${0.2 - i * 0.04})`,
              animation: `ringPulse ${7 + i * 3}s ease-in-out ${i * 1.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Background floating particles (depth layer) */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute pointer-events-none select-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: p.size,
            opacity: 0,
            animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite`,
            ["--drift-x" as any]: `${p.driftX}px`,
            ["--drift-y" as any]: `${p.driftY}px`,
            filter: p.layer === "back" ? "blur(2px)" : p.layer === "mid" ? "blur(0.5px)" : "none",
            zIndex: p.layer === "back" ? 1 : p.layer === "mid" ? 2 : 3,
          }}
        >
          {p.emoji}
        </div>
      ))}

      {/* Central orbiting display */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: "-10%" }}>
        {/* Central icon - large and clear */}
        <div
          className="relative"
          style={{
            fontSize: 64,
            animation: "centralPulse 5s ease-in-out infinite",
            filter: "drop-shadow(0 0 20px rgba(" + theme.accent + ", 0.4))",
            opacity: revealed ? 0.5 : 0,
            transition: "opacity 0.8s ease",
          }}
        >
          {theme.shapes[0]}
        </div>

        {/* Orbiting elements */}
        {orbiters.map((o) => (
          <div
            key={o.id}
            className="absolute pointer-events-none"
            style={{
              width: o.radius * 2,
              height: o.radius * 2,
              animation: `orbit ${o.duration}s linear ${o.delay}s infinite`,
              opacity: revealed ? 0.5 : 0,
              transition: `opacity 0.6s ease ${o.delay * 0.2}s`,
            }}
          >
            <div
              className="absolute select-none"
              style={{
                fontSize: o.size,
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                filter: `drop-shadow(0 0 8px rgba(${theme.accent}, 0.3))`,
                animation: `counterOrbit ${o.duration}s linear ${o.delay}s infinite`,
              }}
            >
              {o.emoji}
            </div>
          </div>
        ))}
      </div>

      {/* Keyword labels floating */}
      <div className="absolute inset-0 pointer-events-none">
        {keywords.map((word, i) => {
          const positions = [
            { x: 8, y: 12 },
            { x: 72, y: 8 },
            { x: 85, y: 45 },
            { x: 10, y: 65 },
            { x: 60, y: 72 },
          ];
          const pos = positions[i % positions.length];
          return (
            <div
              key={`${word}-${i}`}
              className="absolute px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border select-none"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                background: `rgba(${theme.accent}, 0.1)`,
                borderColor: `rgba(${theme.accent}, 0.2)`,
                color: `rgba(${theme.accent}, 0.8)`,
                opacity: revealed ? 0.7 : 0,
                transform: revealed ? "translateY(0) scale(1)" : "translateY(12px) scale(0.9)",
                transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${0.3 + i * 0.15}s`,
                animation: `kwFloat ${6 + i}s ease-in-out ${i * 0.5}s infinite`,
              }}
            >
              {word}
            </div>
          );
        })}
      </div>

      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />
    </div>
  );
};

export default AnimatedVisual;
