import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/types/scene";

interface ScenePlayerProps {
  scenes: Scene[];
  title: string;
  onComplete?: () => void;
}

const FALLBACK_SCENE_DURATION = 5000;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const ScenePlayer = ({ scenes, title, onComplete }: ScenePlayerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<number, string>>(new Map());

  const scene = scenes[currentIndex];

  // Preload audio for upcoming scenes
  const preloadAudio = useCallback(async (index: number) => {
    if (audioCache.current.has(index) || index >= scenes.length) return;
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({ text: scenes[index].text }),
        }
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        audioCache.current.set(index, url);
      }
    } catch (e) {
      console.warn("Failed to preload audio for scene", index, e);
    }
  }, [scenes]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsSpeaking(false);
    // Also stop browser speech as fallback cleanup
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(async (text: string, sceneIndex: number, onEnd: () => void) => {
    setIsSpeaking(true);

    // Try ElevenLabs first
    try {
      let audioUrl = audioCache.current.get(sceneIndex);

      if (!audioUrl) {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
            body: JSON.stringify({ text }),
          }
        );

        if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

        const blob = await response.blob();
        audioUrl = URL.createObjectURL(blob);
        audioCache.current.set(sceneIndex, audioUrl);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        onEnd();
      };

      audio.onerror = () => {
        console.warn("Audio playback failed, using fallback");
        setIsSpeaking(false);
        fallbackSpeak(text, onEnd);
      };

      await audio.play();

      // Preload next scene
      preloadAudio(sceneIndex + 1);
      return;
    } catch (e) {
      console.warn("ElevenLabs TTS failed, falling back to browser speech:", e);
    }

    // Fallback to browser SpeechSynthesis
    fallbackSpeak(text, onEnd);
  }, [preloadAudio]);

  const fallbackSpeak = useCallback((text: string, onEnd: () => void) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1;
    u.onend = () => {
      setIsSpeaking(false);
      onEnd();
    };
    window.speechSynthesis.speak(u);

    // Fallback timer in case onend doesn't fire
    timerRef.current = setTimeout(() => {
      setIsSpeaking(false);
      onEnd();
    }, FALLBACK_SCENE_DURATION);
  }, []);

  const goToScene = useCallback((index: number) => {
    stopAudio();
    setCurrentIndex(index);
    setAnimKey((k) => k + 1);
  }, [stopAudio]);

  const nextScene = useCallback(() => {
    if (currentIndex < scenes.length - 1) {
      goToScene(currentIndex + 1);
    } else {
      stopAudio();
      setIsPlaying(false);
      onComplete?.();
    }
  }, [currentIndex, scenes.length, goToScene, stopAudio, onComplete]);

  const prevScene = useCallback(() => {
    if (currentIndex > 0) goToScene(currentIndex - 1);
  }, [currentIndex, goToScene]);

  // Play current scene when playing
  useEffect(() => {
    if (!isPlaying) return;

    speak(scene.text, currentIndex, () => {
      // Auto-advance to next scene when narration ends
      if (currentIndex < scenes.length - 1) {
        goToScene(currentIndex + 1);
      } else {
        setIsPlaying(false);
        onComplete?.();
      }
    });

    return () => {
      stopAudio();
    };
  }, [isPlaying, currentIndex]);

  // Preload first few scenes on mount
  useEffect(() => {
    preloadAudio(0);
    preloadAudio(1);
    preloadAudio(2);

    const t = setTimeout(() => setIsPlaying(true), 500);
    return () => {
      clearTimeout(t);
      stopAudio();
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
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

        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30">
            <Volume2 className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">Speaking</span>
          </div>
        )}

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
