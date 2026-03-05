import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Explanation, Scene, GenerationStatus, HistoryItem } from "@/types/scene";
import { toast } from "sonner";

const HISTORY_KEY = "ai-learning-history";

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
}

export function useExplanationGenerator() {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 });
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);

  const generate = useCallback(async (question: string) => {
    setStatus("generating-text");
    setExplanation(null);

    try {
      // Step 1: Generate explanation
      const { data: explData, error: explError } = await supabase.functions.invoke("generate-explanation", {
        body: { question },
      });

      if (explError) throw new Error(explError.message || "Failed to generate explanation");
      if (explData?.error) throw new Error(explData.error);

      const expl = explData as Explanation;
      setExplanation(expl);
      setStatus("generating-images");
      setImageProgress({ current: 0, total: expl.scenes.length });

      // Step 2: Generate images for each scene (sequentially to avoid rate limits)
      const scenesWithImages: Scene[] = [];
      for (let i = 0; i < expl.scenes.length; i++) {
        setImageProgress({ current: i, total: expl.scenes.length });

        try {
          const { data: imgData, error: imgError } = await supabase.functions.invoke("generate-scene-image", {
            body: { prompt: expl.scenes[i].imagePrompt },
          });

          if (imgError || imgData?.error) {
            console.warn(`Image ${i} failed, using placeholder`);
            scenesWithImages.push({ ...expl.scenes[i] });
          } else {
            scenesWithImages.push({ ...expl.scenes[i], imageUrl: imgData.imageUrl });
          }
        } catch {
          scenesWithImages.push({ ...expl.scenes[i] });
        }

        // Small delay between image requests
        if (i < expl.scenes.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      const finalExplanation = { ...expl, scenes: scenesWithImages };
      setExplanation(finalExplanation);
      setImageProgress({ current: expl.scenes.length, total: expl.scenes.length });
      setStatus("ready");

      // Save to history
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        question,
        title: expl.title,
        timestamp: Date.now(),
        scenes: scenesWithImages,
      };
      const newHistory = [item, ...history.filter((h) => h.question !== question)];
      setHistory(newHistory);
      saveHistory(newHistory);

    } catch (e: any) {
      console.error("Generation error:", e);
      toast.error(e.message || "Failed to generate explanation");
      setStatus("error");
    }
  }, [history]);

  const loadFromHistory = useCallback((item: HistoryItem) => {
    setExplanation({ title: item.title, scenes: item.scenes });
    setStatus("ready");
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  const setPlaying = useCallback(() => setStatus("playing"), []);

  return {
    status,
    explanation,
    imageProgress,
    history,
    generate,
    loadFromHistory,
    clearHistory,
    setPlaying,
  };
}
