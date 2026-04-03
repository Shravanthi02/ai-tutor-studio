import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/types/scene";

interface ScenePlayerProps {
  scenes: Scene[];
  title: string;
  onComplete?: () => void;
}

const ANIMATION_MAP: Record<string, string> = {
  "slow zoom in": "ken-burns-1",
  "zoom out reveal": "ken-burns-4",
  "pan left to right": "ken-burns-3",
  "parallax movement": "ken-burns-2",
  "slow tilt upward": "ken-burns-1",
};

const TRANSITION_MAP: Record<string, string> = {
  "fade": "crossfade-in",
  "cross dissolve": "crossfade-in",
  "cinematic zoom": "cinematic-zoom-in",
  "slide transition": "slide-in-scene",
  "parallax reveal": "parallax-reveal",
};

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

// --- Multi-visual crossfade layer ---
const KENBURNS_STYLES: Record<string, React.CSSProperties> = {
  "ken-burns-1": { animation: "kenBurns1 10s ease-in-out forwards" },
  "ken-burns-2": { animation: "kenBurns2 10s ease-in-out forwards" },
  "ken-burns-3": { animation: "kenBurns3 10s ease-in-out forwards" },
  "ken-burns-4": { animation: "kenBurns4 10s ease-in-out forwards" },
};

const MultiVisualLayer = ({
  imageUrls,
  currentVisualIndex,
  animationClass,
  transitionClass,
}: {
  imageUrls: string[];
  currentVisualIndex: number;
  animationClass: string;
  transitionClass: string;
}) => {
  const currentUrl = imageUrls[currentVisualIndex];
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    if (!currentUrl) return;
    let cancelled = false;
    let attempt = 0;
    const maxRetries = 5;

    const tryLoad = () => {
      if (cancelled) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { if (!cancelled) setLoaded(true); };
      img.onerror = () => {
        if (cancelled) return;
        attempt++;
        if (attempt < maxRetries) {
          setTimeout(tryLoad, 5000 * attempt);
        }
      };
      // Add cache-bust on retries to force fresh request
      img.src = attempt === 0 ? currentUrl : `${currentUrl}&_r=${attempt}`;
    };
    tryLoad();

    return () => { cancelled = true; };
  }, [currentUrl]);

  if (!currentUrl) return <div className="w-full h-full shimmer" />;

  const animationDuration = imageUrls.length > 1 ? "3.8s" : "10s";
  const kbStyle = loaded
    ? ({
        ...(KENBURNS_STYLES[animationClass] || KENBURNS_STYLES["ken-burns-1"]),
        animationDuration,
        willChange: "transform",
      } as React.CSSProperties)
    : {};

  return (
    <div className={`w-full h-full ${transitionClass}`}>
      {!loaded && <div className="absolute inset-0 shimmer" />}
      <img
        key={`${currentVisualIndex}-${currentUrl}-${animationClass}`}
        src={currentUrl}
        alt=""
        style={kbStyle}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
};

const ScenePlayer = ({ scenes, title, onComplete }: ScenePlayerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textAnimActive, setTextAnimActive] = useState(true);
  const [currentVisualIdx, setCurrentVisualIdx] = useState(0);
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const visualTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scene = scenes[currentIndex];
  const imageUrls = scene?.imageUrls?.filter(Boolean) || (scene?.imageUrl ? [scene.imageUrl] : []);
  const animClass = ANIMATION_MAP[scene?.animation] || "ken-burns-1";
  const transClass = TRANSITION_MAP[scene?.transition] || "crossfade-in";

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; stopAll(); };
  }, []);

  // Cycle through visuals within a scene
  useEffect(() => {
    if (visualTimerRef.current) clearInterval(visualTimerRef.current);
    setCurrentVisualIdx(0);

    if (imageUrls.length > 1) {
      visualTimerRef.current = setInterval(() => {
        setCurrentVisualIdx((prev) => {
          if (prev >= imageUrls.length - 1) {
            if (visualTimerRef.current) clearInterval(visualTimerRef.current);
            return prev;
          }
          return prev + 1;
        });
      }, 4000);
    }

    return () => {
      if (visualTimerRef.current) clearInterval(visualTimerRef.current);
    };
  }, [currentIndex, imageUrls.length]);

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
    setCurrentVisualIdx(0);
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
        {/* Multi-visual layer */}
        <div className="absolute inset-0 overflow-hidden">
          <MultiVisualLayer
            key={`visual-${currentIndex}-${currentVisualIdx}-${animClass}`}
            imageUrls={imageUrls}
            currentVisualIndex={currentVisualIdx}
            animationClass={animClass}
            transitionClass={transClass}
          />
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

        {/* Visual indicator dots */}
        {imageUrls.length > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {imageUrls.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i === currentVisualIdx ? "bg-primary scale-125" : "bg-foreground/30"
                }`}
              />
            ))}
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
