import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Volume2, Lightbulb, Zap, Eye, Cog, Scale, Brain, Globe, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/types/scene";

interface ScenePlayerProps {
  scenes: Scene[];
  title: string;
  onComplete?: () => void;
}

const SCENE_ICONS = [Lightbulb, Zap, Eye, Cog, Scale, Brain, Globe, Star];

const GRADIENT_PALETTES = [
  "from-primary/20 via-secondary to-background",
  "from-accent/15 via-muted to-card",
  "from-primary/10 via-card to-secondary",
  "from-muted via-primary/10 to-background",
  "from-secondary via-accent/10 to-card",
  "from-card via-primary/15 to-muted",
  "from-primary/20 via-muted to-secondary",
  "from-accent/10 via-secondary to-background",
];

// --- Browser TTS with chunking ---
function speakReliably(text: string, onEnd: () => void): () => void {
  let cancelled = false;
  const synth = window.speechSynthesis;
  synth.cancel();

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentIdx = 0;

  const keepAlive = setInterval(() => {
    if (synth.speaking) { synth.pause(); synth.resume(); }
  }, 5000);

  function speakNext() {
    if (cancelled) { clearInterval(keepAlive); return; }
    if (currentIdx >= sentences.length) { clearInterval(keepAlive); onEnd(); return; }

    const u = new SpeechSynthesisUtterance(sentences[currentIdx].trim());
    u.rate = 0.9;
    u.pitch = 1;
    u.onend = () => { currentIdx++; setTimeout(speakNext, 150); };
    u.onerror = () => { currentIdx++; setTimeout(speakNext, 150); };
    synth.speak(u);
  }

  speakNext();
  return () => { cancelled = true; clearInterval(keepAlive); synth.cancel(); };
}

// --- Animated word-by-word text ---
const AnimatedSceneText = ({ text, isActive }: { text: string; isActive: boolean }) => {
  const words = useMemo(() => text.split(" "), [text]);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!isActive) { setVisibleCount(words.length); return; }
    setVisibleCount(0);
    const interval = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= words.length) { clearInterval(interval); return c; }
        return c + 1;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [text, isActive, words.length]);

  return (
    <p className="text-base md:text-lg font-body leading-relaxed text-foreground drop-shadow-lg max-w-3xl">
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block mr-[0.3em] transition-all duration-300"
          style={{
            opacity: i < visibleCount ? 1 : 0,
            transform: i < visibleCount ? "translateY(0)" : "translateY(8px)",
            filter: i < visibleCount ? "blur(0)" : "blur(3px)",
            transitionDelay: `${Math.max(0, (i - visibleCount + 3)) * 20}ms`,
          }}
        >
          {word}
        </span>
      ))}
    </p>
  );
};

// --- Gradient visual background with icon ---
const SceneVisualBackground = ({ sceneIndex, title }: { sceneIndex: number; title: string }) => {
  const Icon = SCENE_ICONS[sceneIndex % SCENE_ICONS.length];
  const gradient = GRADIENT_PALETTES[sceneIndex % GRADIENT_PALETTES.length];

  return (
    <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
      {/* Decorative circles */}
      <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-primary/5 blur-2xl" />
      <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full bg-accent/5 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/3 blur-3xl animate-pulse" />
      
      {/* Central icon */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-primary/10">
          <Icon className="w-10 h-10 text-primary" />
        </div>
        <span className="text-sm font-display text-muted-foreground/60 tracking-wider uppercase max-w-[200px] text-center">
          {title}
        </span>
      </div>
    </div>
  );
};

const ScenePlayer = ({ scenes, title, onComplete }: ScenePlayerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textAnimActive, setTextAnimActive] = useState(true);
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  const scene = scenes[currentIndex];

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; stopAll(); };
  }, []);

  const stopAll = useCallback(() => {
    if (cancelSpeechRef.current) { cancelSpeechRef.current(); cancelSpeechRef.current = null; }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const goToScene = useCallback((index: number) => {
    stopAll();
    setCurrentIndex(index);
    setAnimKey((k) => k + 1);
    setTextAnimActive(true);
  }, [stopAll]);

  const playScene = useCallback(async (sceneData: Scene, sceneIndex: number) => {
    if (!mountedRef.current) return;
    setIsSpeaking(true);
    setTextAnimActive(true);

    const narrationText = sceneData.narration || sceneData.text;

    const advanceToNext = () => {
      if (!mountedRef.current) return;
      setIsSpeaking(false);
      if (sceneIndex < scenes.length - 1) {
        goToScene(sceneIndex + 1);
      } else {
        setIsPlaying(false);
        onComplete?.();
      }
    };

    cancelSpeechRef.current = speakReliably(narrationText, advanceToNext);
  }, [scenes.length, goToScene, onComplete]);

  useEffect(() => {
    if (!isPlaying) return;
    playScene(scene, currentIndex);
    return () => stopAll();
  }, [isPlaying, currentIndex]);

  // Auto-play on mount
  useEffect(() => {
    const t = setTimeout(() => setIsPlaying(true), 500);
    return () => { clearTimeout(t); stopAll(); };
  }, []);

  const togglePlay = () => { if (isPlaying) stopAll(); setIsPlaying(!isPlaying); };
  const restart = () => { goToScene(0); setIsPlaying(true); };

  const nextScene = useCallback(() => {
    if (currentIndex < scenes.length - 1) goToScene(currentIndex + 1);
    else { stopAll(); setIsPlaying(false); onComplete?.(); }
  }, [currentIndex, scenes.length, goToScene, stopAll, onComplete]);

  const prevScene = useCallback(() => {
    if (currentIndex > 0) goToScene(currentIndex - 1);
  }, [currentIndex, goToScene]);

  return (
    <div className="max-w-4xl mx-auto px-4 mt-10">
      <h2 className="text-2xl font-display font-bold text-center mb-6">{title}</h2>

      {/* Video viewport */}
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border aspect-video shadow-lg shadow-background/50">
        {/* Gradient background */}
        <div className="absolute inset-0">
          <SceneVisualBackground sceneIndex={currentIndex} title={scene?.title || ""} />
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />

        {/* Scene title badge */}
        {scene?.title && (
          <div className="absolute top-4 left-4 z-10">
            <span className="text-xs font-display font-semibold tracking-wider uppercase text-primary bg-primary/10 backdrop-blur-sm border border-primary/20 px-3 py-1 rounded-full">
              {scene.title}
            </span>
          </div>
        )}

        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30">
            <Volume2 className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">Speaking</span>
          </div>
        )}

        {/* Hook text */}
        {scene?.hook && (
          <div key={`hook-${animKey}`} className="absolute top-14 left-0 right-0 px-6 scene-enter z-10">
            <p className="text-xs md:text-sm font-display text-primary/80 italic text-center">
              {scene.hook}
            </p>
          </div>
        )}

        {/* Animated text overlay */}
        <div key={`text-${animKey}`} className="absolute bottom-0 left-0 right-0 p-6 md:p-8 scene-enter">
          <AnimatedSceneText text={scene?.text || ""} isActive={textAnimActive} />
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground font-body">
            <span>Scene {currentIndex + 1} of {scenes.length}</span>
            <span className="text-primary/60">{scene?.animation}</span>
          </div>
        </div>
      </div>

      {/* Scene dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {scenes.map((_, i) => (
          <button
            key={i}
            onClick={() => goToScene(i)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === currentIndex
                ? "w-8 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                : i < currentIndex
                ? "w-3 bg-primary/40"
                : "w-3 bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <Button variant="ghost" size="icon" onClick={restart} className="text-muted-foreground hover:text-foreground">
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={prevScene} disabled={currentIndex === 0} className="text-muted-foreground hover:text-foreground">
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button onClick={togglePlay} size="icon" className="w-12 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={nextScene} disabled={currentIndex === scenes.length - 1} className="text-muted-foreground hover:text-foreground">
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ScenePlayer;
