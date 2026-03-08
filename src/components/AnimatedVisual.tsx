import { useMemo, useEffect, useState } from "react";

/* ─── Theme database ─── */
const THEME_MAPS: { keywords: string[]; bg: string; shapes: string[]; accent: string; secondaryAccent: string }[] = [
  { keywords: ["plant","leaf","chlorophyll","photosynthesis","tree","flower","root","seed","grow","forest","vegetation","oxygen","carbon dioxide","glucose","stoma","xylem","phloem"],
    bg: "#071a0e", shapes: ["🌿","🍃","☀️","🌱","🌳","💧","🌻"], accent: "34 197 94", secondaryAccent: "250 204 21" },
  { keywords: ["sun","light","energy","solar","star","heat","radiation","ray","bright","glow","spectrum","wavelength","photon","infrared","ultraviolet"],
    bg: "#1a1000", shapes: ["☀️","⚡","✨","🔆","🌟","💫"], accent: "245 158 11", secondaryAccent: "251 191 36" },
  { keywords: ["water","ocean","river","rain","liquid","flow","wave","sea","ice","steam","evapor","condens","precipit","cloud","cycle","hydro","moisture"],
    bg: "#001220", shapes: ["💧","🌊","❄️","☁️","🌧️","🫧"], accent: "59 130 246", secondaryAccent: "56 189 248" },
  { keywords: ["cell","dna","molecule","atom","protein","gene","nucleus","membrane","mitochon","chloroplast","ribosom","enzyme","amino"],
    bg: "#120822", shapes: ["🧬","🔬","⚛️","🧫","🦠"], accent: "168 85 247", secondaryAccent: "192 132 252" },
  { keywords: ["earth","planet","space","orbit","gravity","moon","universe","galaxy","cosmos","asteroid","solar system","telescope","comet","nebula"],
    bg: "#060612", shapes: ["🌍","🌙","⭐","🪐","🚀","☄️"], accent: "99 102 241", secondaryAccent: "129 140 248" },
  { keywords: ["fire","burn","combust","reaction","chemical","exotherm","endotherm","acid","base","catalyst","bond","oxidat","redox"],
    bg: "#1a0606", shapes: ["🔥","⚗️","💥","🧪","🫧"], accent: "239 68 68", secondaryAccent: "251 146 60" },
  { keywords: ["electric","circuit","current","voltage","magnet","field","charge","electron","battery","wire","resistor","conduct","ampere","ohm"],
    bg: "#001a22", shapes: ["⚡","🔋","🧲","💡","🔌"], accent: "6 182 212", secondaryAccent: "34 211 238" },
  { keywords: ["heart","blood","lung","brain","body","muscle","bone","digest","breath","nerve","immune","vein","artery","organ","tissue","respir"],
    bg: "#1a0610", shapes: ["❤️","🫁","🧠","🦴","🩸","💪"], accent: "244 63 94", secondaryAccent: "251 113 133" },
  { keywords: ["math","number","equation","calcul","geometr","algebra","triangle","circle","angle","graph","formula","theorem","integral","derivative"],
    bg: "#061a1a", shapes: ["📐","📊","🔢","➗","∞","π"], accent: "20 184 166", secondaryAccent: "45 212 191" },
  { keywords: ["history","war","king","empire","ancient","civil","revolution","century","dynasty","battle","freedom","independ","colony","medieval"],
    bg: "#1a1006", shapes: ["🏛️","⚔️","👑","📜","🗿","🏰"], accent: "180 83 9", secondaryAccent: "217 119 6" },
  { keywords: ["computer","code","program","software","algorithm","data","binary","network","internet","server","digital","processor","memory"],
    bg: "#061206", shapes: ["💻","🖥️","⌨️","🌐","📡","🤖"], accent: "34 197 94", secondaryAccent: "74 222 128" },
  { keywords: ["sound","music","frequency","vibrat","wave","audio","hear","echo","resonan","decibel","pitch","amplitude"],
    bg: "#10062a", shapes: ["🎵","🔊","🎶","🎤","🎸","🎹"], accent: "139 92 246", secondaryAccent: "167 139 250" },
  { keywords: ["volcano","earthquake","tectonic","lava","magma","crust","mantle","plate","seismic","fault","eruption"],
    bg: "#1a0a00", shapes: ["🌋","🪨","🔥","💎","⛰️"], accent: "234 88 12", secondaryAccent: "251 146 60" },
  { keywords: ["weather","climate","temperature","wind","storm","tornado","hurricane","atmosphere","pressure","humid","season"],
    bg: "#0a1220", shapes: ["🌤️","🌪️","⛈️","🌡️","💨","🌈"], accent: "96 165 250", secondaryAccent: "147 197 253" },
];

const DEFAULT_THEME = { bg: "#0d1117", shapes: ["✨","💡","📚","🔍","🎓"], accent: "148 163 184", secondaryAccent: "203 213 225" };

function getTheme(text: string) {
  const lower = text.toLowerCase();
  let best = { theme: DEFAULT_THEME as typeof THEME_MAPS[0] | typeof DEFAULT_THEME, score: 0 };
  for (const theme of THEME_MAPS) {
    const score = theme.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > best.score) best = { theme, score };
  }
  return best.score > 0 ? best.theme : DEFAULT_THEME;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// Extract meaningful visual keywords from text
function extractKeyPhrases(text: string): string[] {
  const stopWords = new Set(["the","a","an","is","are","was","were","in","on","at","to","for","of","and","or","but","this","that","these","those","it","its","they","them","by","with","from","as","into","through","which","where","when","how","what","who","each","every","all","both","can","will","be","has","have","had","do","does","did","not","no","so","if","then","than","very","also","just","about","more","most","some","any","other","such","called","known","used","like","many","make","help","take","give","come","go","get","said","say","new","way","use","would","could","should","may","might","must","need","see","look","find","know"]);
  const words = text.replace(/[.,!?;:()""''']/g, "").split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));
  // Pick up to 6 spaced-out meaningful words
  const count = Math.min(6, words.length);
  if (count === 0) return [];
  const step = Math.max(1, Math.floor(words.length / count));
  return Array.from({ length: count }, (_, i) => words[Math.min(i * step, words.length - 1)]).filter(Boolean);
}

interface AnimatedVisualProps {
  text: string;
  sceneIndex: number;
  animKey: number;
}

const AnimatedVisual = ({ text, sceneIndex, animKey }: AnimatedVisualProps) => {
  const theme = useMemo(() => getTheme(text), [text]);
  const keywords = useMemo(() => extractKeyPhrases(text), [text]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
    const t = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(t);
  }, [animKey, text]);

  // Layered particles
  const particles = useMemo(() => {
    const r = seededRandom(sceneIndex * 1000 + animKey);
    return Array.from({ length: 20 }, (_, i) => {
      const layer = i < 7 ? "back" : i < 14 ? "mid" : "front";
      return {
        id: i, layer,
        emoji: theme.shapes[i % theme.shapes.length],
        x: 3 + r() * 94, y: 3 + r() * 94,
        size: layer === "back" ? 12 + r() * 10 : layer === "mid" ? 18 + r() * 14 : 26 + r() * 18,
        opacity: layer === "back" ? 0.12 : layer === "mid" ? 0.3 : 0.55,
        duration: layer === "back" ? 14 + r() * 6 : layer === "mid" ? 9 + r() * 5 : 5 + r() * 4,
        delay: -r() * 10,
        driftX: (r() - 0.5) * (layer === "front" ? 90 : 45),
        driftY: -15 - r() * (layer === "front" ? 50 : 25),
      };
    });
  }, [text, sceneIndex, animKey, theme.shapes]);

  // Orbiters
  const orbiters = useMemo(() => {
    const r = seededRandom(sceneIndex * 2000 + animKey);
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      emoji: theme.shapes[i % theme.shapes.length],
      radius: 60 + i * 40,
      duration: 10 + i * 5,
      delay: i * 1.5,
      size: 30 - i * 3,
    }));
  }, [text, sceneIndex, animKey, theme.shapes]);

  // Flow lines SVG
  const flowLines = useMemo(() => {
    const r = seededRandom(sceneIndex * 3000 + animKey);
    return Array.from({ length: 6 }, (_, i) => {
      const startX = r() * 100;
      const startY = r() * 100;
      return {
        id: i,
        path: `M ${startX} ${startY} Q ${startX + (r() - 0.5) * 60} ${startY + (r() - 0.5) * 60} ${r() * 100} ${r() * 100}`,
        duration: 3 + r() * 4,
        delay: r() * 3,
      };
    });
  }, [sceneIndex, animKey]);

  const ac = theme.accent;
  const sc = "secondaryAccent" in theme ? (theme as any).secondaryAccent : ac;

  return (
    <div className="absolute inset-0 overflow-hidden" key={animKey} style={{ background: theme.bg }}>
      {/* Gradient mesh */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse 70% 50% at 20% 25%, rgba(${ac}, 0.18) 0%, transparent 70%),
          radial-gradient(ellipse 50% 70% at 80% 75%, rgba(${sc}, 0.12) 0%, transparent 60%),
          radial-gradient(ellipse 90% 90% at 50% 50%, rgba(${ac}, 0.04) 0%, transparent 80%)
        `,
        animation: "meshMove 14s ease-in-out infinite alternate",
      }} />

      {/* Flow lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: 0.06 }}>
        {flowLines.map((l) => (
          <path key={l.id} d={l.path} fill="none" stroke={`rgba(${ac}, 0.6)`} strokeWidth="0.3"
            strokeDasharray="2 1.5"
            style={{ animation: `connectionFlow ${l.duration}s linear ${l.delay}s infinite` }} />
        ))}
      </svg>

      {/* Expanding rings */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: "-5%" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: 100 + i * 90, height: 100 + i * 90,
            border: `1px solid rgba(${ac}, ${0.18 - i * 0.03})`,
            animation: `ringPulse ${6 + i * 2.5}s ease-in-out ${i * 1}s infinite`,
          }} />
        ))}
      </div>

      {/* Floating particles */}
      {particles.map((p) => (
        <div key={p.id} className="absolute pointer-events-none select-none" style={{
          left: `${p.x}%`, top: `${p.y}%`, fontSize: p.size, opacity: 0,
          animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite`,
          ["--drift-x" as any]: `${p.driftX}px`, ["--drift-y" as any]: `${p.driftY}px`,
          filter: p.layer === "back" ? "blur(2px)" : p.layer === "mid" ? "blur(0.5px)" : "none",
          zIndex: p.layer === "back" ? 1 : p.layer === "mid" ? 2 : 3,
        }}>
          {p.emoji}
        </div>
      ))}

      {/* Central orbiting system */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: "-8%" }}>
        <div style={{
          fontSize: 72, animation: "centralPulse 5s ease-in-out infinite",
          filter: `drop-shadow(0 0 24px rgba(${ac}, 0.5))`,
          opacity: revealed ? 0.45 : 0, transition: "opacity 0.8s ease",
        }}>
          {theme.shapes[0]}
        </div>
        {orbiters.map((o) => (
          <div key={o.id} className="absolute pointer-events-none" style={{
            width: o.radius * 2, height: o.radius * 2,
            animation: `orbit ${o.duration}s linear ${o.delay}s infinite`,
            opacity: revealed ? 0.45 : 0, transition: `opacity 0.6s ease ${o.delay * 0.15}s`,
          }}>
            <div className="absolute select-none" style={{
              fontSize: o.size, top: 0, left: "50%", transform: "translateX(-50%)",
              filter: `drop-shadow(0 0 10px rgba(${ac}, 0.35))`,
              animation: `counterOrbit ${o.duration}s linear ${o.delay}s infinite`,
            }}>
              {o.emoji}
            </div>
          </div>
        ))}
      </div>

      {/* Keyword labels — directly from narration text */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {keywords.map((word, i) => {
          const positions = [
            { x: 6, y: 10 }, { x: 70, y: 6 }, { x: 82, y: 40 },
            { x: 8, y: 60 }, { x: 55, y: 70 }, { x: 30, y: 85 },
          ];
          const pos = positions[i % positions.length];
          return (
            <div key={`${word}-${i}`} className="absolute px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide backdrop-blur-md border select-none uppercase" style={{
              left: `${pos.x}%`, top: `${pos.y}%`,
              background: `rgba(${ac}, 0.12)`,
              borderColor: `rgba(${ac}, 0.25)`,
              color: `rgba(${ac}, 0.85)`,
              textShadow: `0 0 12px rgba(${ac}, 0.3)`,
              opacity: revealed ? 0.8 : 0,
              transform: revealed ? "translateY(0) scale(1)" : "translateY(16px) scale(0.85)",
              transition: `all 0.7s cubic-bezier(0.16,1,0.3,1) ${0.4 + i * 0.12}s`,
              animation: `kwFloat ${7 + i * 0.8}s ease-in-out ${i * 0.4}s infinite`,
            }}>
              {word}
            </div>
          );
        })}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)",
      }} />
    </div>
  );
};

export default AnimatedVisual;
