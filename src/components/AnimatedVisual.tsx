import { useMemo } from "react";

// Keyword-to-theme mapping for educational topics
const THEME_MAPS: { keywords: string[]; gradient: string; shapes: string[]; accentColor: string }[] = [
  {
    keywords: ["plant", "leaf", "chlorophyll", "photosynthesis", "tree", "flower", "root", "seed", "grow", "forest", "vegetation"],
    gradient: "from-emerald-900/80 via-green-800/60 to-teal-900/80",
    shapes: ["🌿", "🍃", "☀️", "🌱"],
    accentColor: "34 197 94",
  },
  {
    keywords: ["sun", "light", "energy", "solar", "star", "heat", "radiation", "ray", "bright", "glow"],
    gradient: "from-amber-900/80 via-orange-800/60 to-yellow-900/80",
    shapes: ["☀️", "⚡", "✨", "🔆"],
    accentColor: "245 158 11",
  },
  {
    keywords: ["water", "ocean", "river", "rain", "liquid", "flow", "wave", "sea", "ice", "steam", "evapor", "condens"],
    gradient: "from-blue-900/80 via-cyan-800/60 to-sky-900/80",
    shapes: ["💧", "🌊", "❄️", "🫧"],
    accentColor: "59 130 246",
  },
  {
    keywords: ["cell", "dna", "molecule", "atom", "protein", "gene", "nucleus", "membrane", "mitochon", "organ"],
    gradient: "from-purple-900/80 via-violet-800/60 to-indigo-900/80",
    shapes: ["🧬", "🔬", "⚛️", "🧫"],
    accentColor: "168 85 247",
  },
  {
    keywords: ["earth", "planet", "space", "orbit", "gravity", "moon", "universe", "galaxy", "cosmos", "asteroid"],
    gradient: "from-slate-900/80 via-indigo-900/60 to-violet-950/80",
    shapes: ["🌍", "🌙", "⭐", "🪐"],
    accentColor: "99 102 241",
  },
  {
    keywords: ["fire", "burn", "combust", "reaction", "chemical", "exotherm", "endotherm", "acid", "base"],
    gradient: "from-red-900/80 via-orange-900/60 to-amber-950/80",
    shapes: ["🔥", "⚗️", "💥", "🧪"],
    accentColor: "239 68 68",
  },
  {
    keywords: ["electric", "circuit", "current", "voltage", "magnet", "field", "charge", "electron", "battery", "wire"],
    gradient: "from-cyan-900/80 via-blue-900/60 to-indigo-950/80",
    shapes: ["⚡", "🔋", "🧲", "💡"],
    accentColor: "6 182 212",
  },
  {
    keywords: ["heart", "blood", "lung", "brain", "body", "muscle", "bone", "digest", "breath", "nerve", "immune"],
    gradient: "from-rose-900/80 via-red-900/60 to-pink-950/80",
    shapes: ["❤️", "🫁", "🧠", "🦴"],
    accentColor: "244 63 94",
  },
  {
    keywords: ["math", "number", "equation", "calcul", "geometr", "algebra", "triangle", "circle", "angle", "graph"],
    gradient: "from-teal-900/80 via-emerald-900/60 to-cyan-950/80",
    shapes: ["📐", "📊", "🔢", "➗"],
    accentColor: "20 184 166",
  },
  {
    keywords: ["history", "war", "king", "empire", "ancient", "civil", "revolution", "century", "dynasty", "battle"],
    gradient: "from-amber-950/80 via-stone-900/60 to-yellow-950/80",
    shapes: ["🏛️", "⚔️", "👑", "📜"],
    accentColor: "180 83 9",
  },
];

const DEFAULT_THEME = {
  gradient: "from-slate-900/80 via-gray-800/60 to-zinc-900/80",
  shapes: ["✨", "💡", "📚", "🔍"],
  accentColor: "148 163 184",
};

function getTheme(text: string) {
  const lower = text.toLowerCase();
  for (const theme of THEME_MAPS) {
    if (theme.keywords.some((kw) => lower.includes(kw))) return theme;
  }
  return DEFAULT_THEME;
}

// Deterministic pseudo-random from index
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

interface AnimatedVisualProps {
  text: string;
  sceneIndex: number;
  animKey: number;
}

const AnimatedVisual = ({ text, sceneIndex, animKey }: AnimatedVisualProps) => {
  const theme = useMemo(() => getTheme(text), [text]);
  const particles = useMemo(() => {
    const rand = seededRandom(sceneIndex * 1000 + animKey);
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      emoji: theme.shapes[i % theme.shapes.length],
      x: rand() * 100,
      y: rand() * 100,
      size: 16 + rand() * 24,
      duration: 6 + rand() * 8,
      delay: rand() * -10,
      driftX: (rand() - 0.5) * 60,
      driftY: -30 - rand() * 40,
    }));
  }, [text, sceneIndex, animKey, theme.shapes]);

  // Animated concentric rings
  const rings = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => ({
      id: i,
      size: 200 + i * 150,
      duration: 8 + i * 4,
      delay: i * 1.5,
    }));
  }, []);

  return (
    <div className={`absolute inset-0 overflow-hidden bg-gradient-to-br ${theme.gradient}`} key={animKey}>
      {/* Animated gradient mesh */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, rgba(${theme.accentColor}, 0.4) 0%, transparent 60%),
                       radial-gradient(ellipse at 70% 80%, rgba(${theme.accentColor}, 0.2) 0%, transparent 50%)`,
          animation: "meshMove 10s ease-in-out infinite alternate",
        }}
      />

      {/* Pulsing rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        {rings.map((ring) => (
          <div
            key={ring.id}
            className="absolute rounded-full border opacity-10"
            style={{
              width: ring.size,
              height: ring.size,
              borderColor: `rgba(${theme.accentColor}, 0.3)`,
              animation: `ringPulse ${ring.duration}s ease-in-out ${ring.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Floating emoji particles */}
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
          }}
        >
          {p.emoji}
        </div>
      ))}

      {/* Central large icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="text-7xl md:text-8xl opacity-20"
          style={{ animation: "centralPulse 4s ease-in-out infinite" }}
        >
          {theme.shapes[0]}
        </div>
      </div>

      {/* Scan line effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(${theme.accentColor}, 0.02) 2px,
            rgba(${theme.accentColor}, 0.02) 4px
          )`,
        }}
      />
    </div>
  );
};

export default AnimatedVisual;
