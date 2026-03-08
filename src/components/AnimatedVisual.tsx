import { useMemo, useEffect, useState } from "react";

/* ─── Theme database with richer visuals ─── */
const THEME_MAPS: { keywords: string[]; bg: string; shapes: string[]; accent: string; secondary: string }[] = [
  { keywords: ["plant","leaf","chlorophyll","photosynthesis","tree","flower","root","seed","grow","forest","vegetation","oxygen","carbon dioxide","glucose","stoma","xylem","phloem","cellulose"],
    bg: "#061a0c", shapes: ["🌿","🍃","☀️","🌱","🌳","💧","🌻","🌾"], accent: "34 197 94", secondary: "250 204 21" },
  { keywords: ["sun","light","energy","solar","star","heat","radiation","ray","bright","glow","spectrum","wavelength","photon"],
    bg: "#1a1000", shapes: ["☀️","⚡","✨","🔆","🌟","💫","🔥"], accent: "245 158 11", secondary: "251 191 36" },
  { keywords: ["water","ocean","river","rain","liquid","flow","wave","sea","ice","steam","evapor","condens","precipit","cloud","cycle","hydro"],
    bg: "#001220", shapes: ["💧","🌊","❄️","☁️","🌧️","🫧","🏔️"], accent: "59 130 246", secondary: "56 189 248" },
  { keywords: ["cell","dna","molecule","atom","protein","gene","nucleus","membrane","mitochon","chloroplast","ribosom","enzyme"],
    bg: "#120822", shapes: ["🧬","🔬","⚛️","🧫","🦠","💊"], accent: "168 85 247", secondary: "192 132 252" },
  { keywords: ["earth","planet","space","orbit","gravity","moon","universe","galaxy","cosmos","asteroid","comet","nebula"],
    bg: "#060612", shapes: ["🌍","🌙","⭐","🪐","🚀","☄️","🌌"], accent: "99 102 241", secondary: "129 140 248" },
  { keywords: ["fire","burn","combust","reaction","chemical","exotherm","endotherm","acid","base","catalyst","bond","oxidat"],
    bg: "#1a0606", shapes: ["🔥","⚗️","💥","🧪","🫧","⚡"], accent: "239 68 68", secondary: "251 146 60" },
  { keywords: ["electric","circuit","current","voltage","magnet","field","charge","electron","battery","wire","resistor","conduct"],
    bg: "#001a22", shapes: ["⚡","🔋","🧲","💡","🔌","📡"], accent: "6 182 212", secondary: "34 211 238" },
  { keywords: ["heart","blood","lung","brain","body","muscle","bone","digest","breath","nerve","immune","vein","artery","organ"],
    bg: "#1a0610", shapes: ["❤️","🫁","🧠","🦴","🩸","💪","🫀"], accent: "244 63 94", secondary: "251 113 133" },
  { keywords: ["math","number","equation","calcul","geometr","algebra","triangle","circle","angle","graph","formula","theorem"],
    bg: "#061a1a", shapes: ["📐","📊","🔢","➗","∞","π","📏"], accent: "20 184 166", secondary: "45 212 191" },
  { keywords: ["history","war","king","empire","ancient","civil","revolution","century","dynasty","battle","freedom","independ"],
    bg: "#1a1006", shapes: ["🏛️","⚔️","👑","📜","🗿","🏰","🛡️"], accent: "180 83 9", secondary: "217 119 6" },
  { keywords: ["computer","code","program","software","algorithm","data","binary","network","internet","server","digital"],
    bg: "#061206", shapes: ["💻","🖥️","⌨️","🌐","📡","🤖","💾"], accent: "34 197 94", secondary: "74 222 128" },
  { keywords: ["sound","music","frequency","vibrat","wave","audio","hear","echo","resonan","pitch"],
    bg: "#10062a", shapes: ["🎵","🔊","🎶","🎤","🎸","🎹","🎧"], accent: "139 92 246", secondary: "167 139 250" },
  { keywords: ["earthquake","tectonic","plate","seismic","fault","crust","mantle","lithosphere","subduct","converge","diverge"],
    bg: "#1a0a00", shapes: ["🌋","🪨","⛰️","💎","🌍","🔥","💥"], accent: "234 88 12", secondary: "251 146 60" },
  { keywords: ["weather","climate","temperature","wind","storm","tornado","hurricane","atmosphere","pressure","season"],
    bg: "#0a1220", shapes: ["🌤️","🌪️","⛈️","🌡️","💨","🌈","☁️"], accent: "96 165 250", secondary: "147 197 253" },
  { keywords: ["food","nutrition","vitamin","mineral","diet","calorie","carbohydrate","fat","protein","metabolism"],
    bg: "#1a1206", shapes: ["🍎","🥦","🍞","🥩","🥛","🧬","💪"], accent: "234 179 8", secondary: "250 204 21" },
  { keywords: ["animal","species","habitat","ecosystem","evolution","predator","prey","mammal","bird","fish","insect"],
    bg: "#0a1a0a", shapes: ["🐾","🦁","🐦","🐠","🦋","🌿","🏔️"], accent: "74 222 128", secondary: "34 197 94" },
];

const DEFAULT_THEME = { bg: "#0d1117", shapes: ["✨","💡","📚","🔍","🎓","📝","🧠"], accent: "148 163 184", secondary: "203 213 225" };

function getTheme(text: string) {
  const lower = text.toLowerCase();
  let best = { theme: DEFAULT_THEME as any, score: 0 };
  for (const theme of THEME_MAPS) {
    const score = theme.keywords.filter(kw => lower.includes(kw)).length;
    if (score > best.score) best = { theme, score };
  }
  return best.score > 0 ? best.theme : DEFAULT_THEME;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// Extract important words from text for visual labels
function extractKeywords(text: string): string[] {
  const stopWords = new Set(["the","a","an","is","are","was","were","in","on","at","to","for","of","and","or","but","this","that","these","those","it","its","they","them","by","with","from","as","into","through","which","where","when","how","what","who","each","every","all","both","can","will","be","has","have","had","do","does","did","not","no","so","if","then","than","very","also","just","about","more","most","some","any","other","such","called","known","used","like","many","make","help","take","give","come","go","get","said","say","new","way","use","would","could","should","may","might","must","need","see","look","find","know","two","three","one","first","second"]);
  return text.replace(/[.,!?;:()""''']/g, "").split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()))
    .slice(0, 8)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
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
    const t = setTimeout(() => setRevealed(true), 50);
    return () => clearTimeout(t);
  }, [animKey, text]);

  const r = useMemo(() => seededRandom(sceneIndex * 1000 + animKey), [sceneIndex, animKey]);

  // Floating particles
  const particles = useMemo(() => {
    const rand = seededRandom(sceneIndex * 1000 + animKey);
    return Array.from({ length: 16 }, (_, i) => {
      const layer = i < 5 ? "back" : i < 11 ? "mid" : "front";
      return {
        id: i, layer,
        emoji: theme.shapes[i % theme.shapes.length],
        x: 3 + rand() * 94, y: 3 + rand() * 94,
        size: layer === "back" ? 14 + rand() * 8 : layer === "mid" ? 20 + rand() * 12 : 28 + rand() * 16,
        duration: layer === "back" ? 14 + rand() * 6 : layer === "mid" ? 9 + rand() * 5 : 5 + rand() * 4,
        delay: -rand() * 10,
        driftX: (rand() - 0.5) * (layer === "front" ? 80 : 40),
        driftY: -15 - rand() * (layer === "front" ? 50 : 25),
      };
    });
  }, [text, sceneIndex, animKey, theme.shapes]);

  // Orbiting icons
  const orbiters = useMemo(() => {
    const rand = seededRandom(sceneIndex * 2000 + animKey);
    return Array.from({ length: 4 }, (_, i) => ({
      id: i,
      emoji: theme.shapes[(i + 1) % theme.shapes.length],
      radius: 55 + i * 35,
      duration: 10 + i * 4,
      delay: i * 1.5,
      size: 26 - i * 2,
    }));
  }, [text, sceneIndex, animKey, theme.shapes]);

  const ac = theme.accent;
  const sc = theme.secondary || ac;

  return (
    <div className="absolute inset-0 overflow-hidden" key={animKey} style={{ background: theme.bg }}>
      {/* Gradient mesh */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse 70% 50% at 20% 25%, rgba(${ac}, 0.18) 0%, transparent 70%),
          radial-gradient(ellipse 50% 70% at 80% 75%, rgba(${sc}, 0.12) 0%, transparent 60%)
        `,
        animation: "meshMove 14s ease-in-out infinite alternate",
      }} />

      {/* Pulsing rings */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: "-5%" }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="absolute rounded-full" style={{
            width: 100 + i * 80, height: 100 + i * 80,
            border: `1px solid rgba(${ac}, ${0.15 - i * 0.03})`,
            animation: `ringPulse ${6 + i * 2.5}s ease-in-out ${i}s infinite`,
          }} />
        ))}
      </div>

      {/* Floating particles */}
      {particles.map(p => (
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
          fontSize: 56, animation: "centralPulse 5s ease-in-out infinite",
          filter: `drop-shadow(0 0 20px rgba(${ac}, 0.5))`,
          opacity: revealed ? 0.4 : 0, transition: "opacity 0.8s ease",
        }}>
          {theme.shapes[0]}
        </div>
        {orbiters.map(o => (
          <div key={o.id} className="absolute pointer-events-none" style={{
            width: o.radius * 2, height: o.radius * 2,
            animation: `orbit ${o.duration}s linear ${o.delay}s infinite`,
            opacity: revealed ? 0.4 : 0, transition: `opacity 0.5s ease ${o.delay * 0.1}s`,
          }}>
            <div className="absolute select-none" style={{
              fontSize: o.size, top: 0, left: "50%", transform: "translateX(-50%)",
              filter: `drop-shadow(0 0 8px rgba(${ac}, 0.3))`,
              animation: `counterOrbit ${o.duration}s linear ${o.delay}s infinite`,
            }}>
              {o.emoji}
            </div>
          </div>
        ))}
      </div>

      {/* Keyword chips — key concepts from narration */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {keywords.slice(0, 6).map((word, i) => {
          const positions = [
            { x: 5, y: 8 }, { x: 68, y: 5 }, { x: 80, y: 35 },
            { x: 5, y: 55 }, { x: 50, y: 65 }, { x: 25, y: 80 },
          ];
          const pos = positions[i % positions.length];
          return (
            <div key={`${word}-${i}-${animKey}`}
              className="absolute px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider backdrop-blur-md border select-none uppercase"
              style={{
                left: `${pos.x}%`, top: `${pos.y}%`,
                background: `rgba(${ac}, 0.12)`,
                borderColor: `rgba(${ac}, 0.3)`,
                color: `rgba(${ac}, 0.9)`,
                textShadow: `0 0 14px rgba(${ac}, 0.4)`,
                opacity: revealed ? 0.85 : 0,
                transform: revealed ? "translateY(0) scale(1)" : "translateY(14px) scale(0.85)",
                transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${0.3 + i * 0.1}s`,
                animation: revealed ? `kwFloat ${7 + i * 0.7}s ease-in-out ${i * 0.3}s infinite` : "none",
              }}
            >
              {word}
            </div>
          );
        })}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)",
      }} />
    </div>
  );
};

export default AnimatedVisual;
