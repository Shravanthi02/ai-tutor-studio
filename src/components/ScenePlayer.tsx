import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/types/scene";

interface ScenePlayerProps {
  scenes: Scene[];
  title: string;
  onComplete?: () => void;
}

const SCENE_DURATION = 5000; // 5 seconds per scene

const ScenePlayer = ({ scenes, title, onComplete }: ScenePlayerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const scene = scenes[currentIndex];

  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1;
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }, []);

  const goToScene = useCallback((index: number) => {
    setCurrentIndex(index);
    setAnimKey((k) => k + 1);
  }, []);

  const nextScene = useCallback(() => {
    if (currentIndex < scenes.length - 1) {
      goToScene(currentIndex + 1);
    } else {
      setIsPlaying(false);
      window.speechSynthesis.cancel();
      onComplete?.();
    }
  }, [currentIndex, scenes.length, goToScene, onComplete]);

  const prevScene = useCallback(() => {
    if (currentIndex > 0) goToScene(currentIndex - 1);
  }, [currentIndex, goToScene]);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) return;
    speak(scene.text);
    timerRef.current = setTimeout(nextScene, SCENE_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIndex, scene.text, speak, nextScene]);

  // Auto-play on mount
  useEffect(() => {
    const t = setTimeout(() => setIsPlaying(true), 500);
    return () => {
      clearTimeout(t);
      window.speechSynthesis.cancel();
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(!isPlaying);
  };

  const restart = () => {
    goToScene(0);
    setIsPlaying(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 mt-10">
      <h2 className="text-2xl font-display font-bold text-center mb-6">{title}</h2>

      {/* Player */}
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border aspect-video">
        {/* Scene image with Ken Burns */}
        <div className="absolute inset-0 overflow-hidden">
          {scene.imageUrl ? (
            <img
              key={animKey}
              src={scene.imageUrl}
              alt={scene.text}
              className="w-full h-full object-cover ken-burns"
            />
          ) : (
            <div className="w-full h-full shimmer" />
          )}
        </div>

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

        {/* Text overlay */}
        <div
          key={`text-${animKey}`}
          className="absolute bottom-0 left-0 right-0 p-6 md:p-8 scene-enter"
        >
          <p className="text-base md:text-lg font-body leading-relaxed text-foreground drop-shadow-lg max-w-3xl">
            {scene.text}
          </p>
          <div className="mt-3 text-xs text-muted-foreground font-body">
            Scene {currentIndex + 1} of {scenes.length}
          </div>
        </div>
      </div>

      {/* Scene timeline dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {scenes.map((_, i) => (
          <button
            key={i}
            onClick={() => goToScene(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentIndex
                ? "w-8 bg-primary"
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
        <Button
          onClick={togglePlay}
          size="icon"
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
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
