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

// Generate images in parallel batches of 3 for speed
async function generateImagesParallel(
  scenes: Scene[],
  onProgress: (current: number) => void
): Promise<Scene[]> {
  const BATCH_SIZE = 3;
  const results: Scene[] = [...scenes];

  for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
    const batch = scenes.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (scene, batchIdx) => {
      const idx = i + batchIdx;
      try {
        const { data, error } = await supabase.functions.invoke("generate-scene-image", {
          body: { prompt: scene.imagePrompt },
        });
        if (!error && data?.imageUrl) {
          results[idx] = { ...scene, imageUrl: data.imageUrl };
        }
      } catch {
        // keep scene without image
      }
      onProgress(idx + 1);
    });

    await Promise.all(promises);

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < scenes.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
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
      const { data: explData, error: explError } = await supabase.functions.invoke("generate-explanation", {
        body: { question },
      });

      if (explError) throw new Error(explError.message || "Failed to generate explanation");
      if (explData?.error) throw new Error(explData.error);

      const expl = explData as Explanation;
      setExplanation(expl);
      setStatus("generating-images");
      setImageProgress({ current: 0, total: expl.scenes.length });

      // Generate images in parallel batches
      const scenesWithImages = await generateImagesParallel(expl.scenes, (current) => {
        setImageProgress({ current, total: expl.scenes.length });
      });

      const finalExplanation = { ...expl, scenes: scenesWithImages };
      setExplanation(finalExplanation);
      setImageProgress({ current: expl.scenes.length, total: expl.scenes.length });
      setStatus("ready");

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        question,
        title: expl.title,
        fullAnswer: expl.fullAnswer || "",
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
    setExplanation({ title: item.title, fullAnswer: item.fullAnswer, scenes: item.scenes });
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
