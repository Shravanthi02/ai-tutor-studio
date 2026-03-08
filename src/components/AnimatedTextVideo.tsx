import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Play, Pause, RotateCcw, Volume2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/types/scene";

interface AnimatedTextVideoProps {
  fullAnswer: string;
  title: string;
  scenes: Scene[];
}

const KEN_BURNS_CLASSES = ["ken-burns-1", "ken-burns-2", "ken-burns-3", "ken-burns-4"];

function splitIntoSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+/g) || [text]).map((s) => s.trim()).filter(Boolean);
}

function speakSentence(text: string, onEnd: () => void): () => void {
  let cancelled = false;
  const synth = window.speechSynthesis;
  synth.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.85;
  u.pitch = 1;
  u.onend = () => { if (!cancelled) onEnd(); };
  u.onerror = () => { if (!cancelled) onEnd(); };

  const keepAlive = setInterval(() => {
    if (synth.speaking) { synth.pause(); synth.resume(); }
  }, 5000);

  synth.speak(u);

  return () => {
    cancelled = true;
    clearInterval(keepAlive);
    synth.cancel();
  };
}

const AnimatedTextVideo = ({ fullAnswer, title, scenes }: AnimatedTextVideoProps) => {
  const sentences = useMemo(() => splitIntoSentences(fullAnswer), [fullAnswer]);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map sentences to background images from scenes
  const bgImageIndex = useMemo(() => {
    if (!scenes.length) return 0;
    return Math.floor((currentSentence / sentences.length) * scenes.length);
  }, [currentSentence, sentences.length, scenes.length]);

  const currentBgImage = scenes[Math.min(bgImageIndex, scenes.length - 1)]?.imageUrl;
  const kbClass = KEN_BURNS_CLASSES[bgImageIndex % KEN_BURNS_CLASSES.length];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRef.current?.();
      window.speechSynthesis.cancel();
    };
  }, []);

  const stopSpeech = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const playSentence = useCallback((index: number) => {
    if (!mountedRef.current || index >= sentences.length) {
      setIsPlaying(false);
      setIsSpeaking(false);
      return;
    }

    setCurrentSentence(index);
    setIsSpeaking(true);

    cancelRef.current = speakSentence(sentences[index], () => {
      if (!mountedRef.current) return;
      // Small pause between sentences
      setTimeout(() => {
        if (mountedRef.current) playSentence(index + 1);
      }, 400);
    });
  }, [sentences]);

  useEffect(() => {
    if (!isPlaying) return;
    playSentence(currentSentence);
    return () => stopSpeech();
  }, [isPlaying]);

  const togglePlay = () => {
    if (isPlaying) {
      stopSpeech();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  };

  const restart = () => {
    stopSpeech();
    setCurrentSentence(0);
    setIsPlaying(true);
  };

  const progress = sentences.length > 0 ? ((currentSentence + 1) / sentences.length) * 100 : 0;

  // Group sentences into visible context (show a window of sentences)
  const windowSize = 5;
  const windowStart = Math.max(0, currentSentence - 2);
  const windowEnd = Math.min(sentences.length, windowStart + windowSize);
  const visibleSentences = sentences.slice(windowStart, windowEnd);

  return (
    <div className="max-w-4xl mx-auto px-4 mt-10">
      <div className="flex items-center gap-2 mb-4 justify-center">
        <BookOpen className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-display font-semibold text-foreground">
          Animated Explanation
        </h3>
      </div>

      {/* Video viewport */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden bg-card border border-border aspect-video shadow-lg shadow-background/50"
      >
        {/* Background image */}
        <div className="absolute inset-0 overflow-hidden" key={bgImageIndex}>
          {currentBgImage ? (
            <img
              src={currentBgImage}
              alt=""
              className={`w-full h-full object-cover ${kbClass} transition-opacity duration-1000 opacity-40`}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-background" />
          )}
        </div>

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/70 to-background/50" />

        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 z-10">
            <Volume2 className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">Narrating</span>
          </div>
        )}

        {/* Title */}
        <div className="absolute top-4 left-4 z-10">
          <span className="text-xs text-primary font-display font-semibold tracking-wider uppercase">
            {title}
          </span>
        </div>

        {/* Animated text content */}
        <div className="absolute inset-0 flex items-center justify-center p-8 md:p-12 z-10">
          <div className="max-w-2xl w-full space-y-3">
            {visibleSentences.map((sentence, i) => {
              const globalIndex = windowStart + i;
              const isCurrent = globalIndex === currentSentence;
              const isPast = globalIndex < currentSentence;
              const isFuture = globalIndex > currentSentence;

              return (
                <p
                  key={globalIndex}
                  className={`font-body leading-relaxed transition-all duration-500 ease-out ${
                    isCurrent
                      ? "text-lg md:text-xl text-foreground font-medium scale-100 opacity-100"
                      : isPast
                      ? "text-sm md:text-base text-muted-foreground opacity-40 scale-95 -translate-y-1"
                      : "text-sm md:text-base text-muted-foreground opacity-20 scale-95 translate-y-1"
                  }`}
                  style={{
                    textShadow: isCurrent ? "0 0 30px hsl(var(--primary) / 0.2)" : "none",
                  }}
                >
                  {isCurrent && (
                    <span className="inline-block w-1 h-4 bg-primary rounded-full mr-2 align-middle animate-pulse" />
                  )}
                  {sentence}
                </p>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30 z-10">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Sentence counter */}
        <div className="absolute bottom-3 right-4 z-10">
          <span className="text-xs text-muted-foreground font-body">
            {currentSentence + 1} / {sentences.length}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={restart}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          onClick={togglePlay}
          size="icon"
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </Button>
      </div>
    </div>
  );
};

export default AnimatedTextVideo;
