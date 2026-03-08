import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/types/scene";

interface ScenePlayerProps {
  scenes: Scene[];
  title: string;
  onComplete?: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Robust browser SpeechSynthesis with chunking and keepalive
function speakReliably(text: string, onEnd: () => void): () => void {
  let cancelled = false;
  const synth = window.speechSynthesis;
  synth.cancel();

  // Chrome bug: speech cuts off after ~15s. Split into sentences.
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentIdx = 0;

  // Chrome also pauses speech if not kept alive
  const keepAlive = setInterval(() => {
    if (synth.speaking) {
      synth.pause();
      synth.resume();
    }
  }, 5000);

  function speakNext() {
    if (cancelled) {
      clearInterval(keepAlive);
      return;
    }
    if (currentIdx >= sentences.length) {
      clearInterval(keepAlive);
      onEnd();
      return;
    }

    const u = new SpeechSynthesisUtterance(sentences[currentIdx].trim());
    u.rate = 0.9;
    u.pitch = 1;

    u.onend = () => {
      currentIdx++;
      // Small gap between sentences for natural pacing
      setTimeout(speakNext, 150);
    };

    u.onerror = (e) => {
      console.warn("Speech error on sentence", currentIdx, e);
      currentIdx++;
      setTimeout(speakNext, 150);
    };

    synth.speak(u);
  }

  speakNext();

  return () => {
    cancelled = true;
    clearInterval(keepAlive);
    synth.cancel();
  };
}

// ElevenLabs TTS is currently disabled (account blocked on free tier).
// Set to true once you have a paid ElevenLabs plan.
const ELEVENLABS_ENABLED = false;

async function fetchElevenLabsAudio(text: string): Promise<string | null> {
  if (!ELEVENLABS_ENABLED) return null;
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
        body: JSON.stringify({ text }),
      }
    );
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size < 1000) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

const ScenePlayer = ({ scenes, title, onComplete }: ScenePlayerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const audioCache = useRef<Map<number, string | null>>(new Map());
  const mountedRef = useRef(true);

  const scene = scenes[currentIndex];

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAll();
    };
  }, []);

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
      cancelSpeechRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const goToScene = useCallback((index: number) => {
    stopAll();
    setCurrentIndex(index);
    setAnimKey((k) => k + 1);
  }, [stopAll]);

  // Preload ElevenLabs audio
  const preloadAudio = useCallback(async (index: number) => {
    if (audioCache.current.has(index) || index >= scenes.length) return;
    audioCache.current.set(index, null); // mark as loading
    const url = await fetchElevenLabsAudio(scenes[index].text);
    audioCache.current.set(index, url);
  }, [scenes]);

  const playScene = useCallback(async (text: string, sceneIndex: number) => {
    if (!mountedRef.current) return;
    setIsSpeaking(true);

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

    // Try ElevenLabs first
    let audioUrl = audioCache.current.get(sceneIndex);
    if (audioUrl === undefined) {
      audioUrl = await fetchElevenLabsAudio(text);
      audioCache.current.set(sceneIndex, audioUrl);
    }

    if (audioUrl && mountedRef.current) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = advanceToNext;
      audio.onerror = () => {
        // Fall back to browser speech
        console.warn("Audio playback failed, using browser speech");
        cancelSpeechRef.current = speakReliably(text, advanceToNext);
      };
      try {
        await audio.play();
        preloadAudio(sceneIndex + 1);
        return;
      } catch {
        // autoplay blocked or failed
      }
    }

    // Fallback: reliable browser speech
    if (mountedRef.current) {
      cancelSpeechRef.current = speakReliably(text, advanceToNext);
    }
  }, [scenes.length, goToScene, onComplete, preloadAudio]);

  // Auto-play scene when playing state or index changes
  useEffect(() => {
    if (!isPlaying) return;
    playScene(scene.text, currentIndex);
    return () => stopAll();
  }, [isPlaying, currentIndex]);

  // Auto-start + preload on mount
  useEffect(() => {
    preloadAudio(0);
    preloadAudio(1);
    preloadAudio(2);
    const t = setTimeout(() => setIsPlaying(true), 500);
    return () => {
      clearTimeout(t);
      stopAll();
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) stopAll();
    setIsPlaying(!isPlaying);
  };

  const restart = () => {
    goToScene(0);
    setIsPlaying(true);
  };

  const nextScene = useCallback(() => {
    if (currentIndex < scenes.length - 1) {
      goToScene(currentIndex + 1);
    } else {
      stopAll();
      setIsPlaying(false);
      onComplete?.();
    }
  }, [currentIndex, scenes.length, goToScene, stopAll, onComplete]);

  const prevScene = useCallback(() => {
    if (currentIndex > 0) goToScene(currentIndex - 1);
  }, [currentIndex, goToScene]);

  return (
    <div className="max-w-4xl mx-auto px-4 mt-10">
      <h2 className="text-2xl font-display font-bold text-center mb-6">{title}</h2>

      <div className="relative rounded-2xl overflow-hidden bg-card border border-border aspect-video">
        <div className="absolute inset-0 overflow-hidden">
          {scene.imageUrl ? (
            <img key={animKey} src={scene.imageUrl} alt={scene.text} className="w-full h-full object-cover ken-burns" />
          ) : (
            <div className="w-full h-full shimmer" />
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

        {isSpeaking && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30">
            <Volume2 className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">Speaking</span>
          </div>
        )}

        <div key={`text-${animKey}`} className="absolute bottom-0 left-0 right-0 p-6 md:p-8 scene-enter">
          <p className="text-base md:text-lg font-body leading-relaxed text-foreground drop-shadow-lg max-w-3xl">
            {scene.text}
          </p>
          <div className="mt-3 text-xs text-muted-foreground font-body">
            Scene {currentIndex + 1} of {scenes.length}
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-1.5 mt-4">
        {scenes.map((_, i) => (
          <button
            key={i}
            onClick={() => goToScene(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentIndex ? "w-8 bg-primary" : i < currentIndex ? "w-3 bg-primary/40" : "w-3 bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 mt-4">
        <Button variant="ghost" size="icon" onClick={restart} className="text-muted-foreground hover:text-foreground">
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={prevScene} disabled={currentIndex === 0} className="text-muted-foreground hover:text-foreground">
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button onClick={togglePlay} size="icon" className="w-12 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
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
