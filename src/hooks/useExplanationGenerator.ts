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
  const lite = items.slice(0, 20).map((item) => ({
    ...item,
    scenes: item.scenes.map(({ text, imagePrompt, imagePrompts }) => ({
      text,
      imagePrompt,
      imagePrompts,
    })),
  }));
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(lite));
  } catch {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(lite.slice(0, 5)));
    } catch {
      localStorage.removeItem(HISTORY_KEY);
    }
  }
}

// Generate ONE image per scene in parallel batches
async function generateImagesParallel(
  scenes: Scene[],
  onProgress: (current: number) => void
): Promise<Scene[]> {
  const BATCH_SIZE = 4;
  const results: Scene[] = scenes.map((s) => ({ ...s }));

  let completed = 0;

  for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
    const batch = scenes.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (scene, batchIdx) => {
      const idx = i + batchIdx;
      try {
        const { data, error } = await supabase.functions.invoke("generate-scene-image", {
          body: { prompt: scene.imagePrompt, sceneText: scene.text },
        });
        if (!error && data?.imageUrl) {
          results[idx].imageUrl = data.imageUrl;
        }
      } catch {
        // keep without image
      }
      completed++;
      onProgress(completed);
    });

    await Promise.all(promises);

    if (i + BATCH_SIZE < scenes.length) {
      await new Promise((r) => setTimeout(r, 300));
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

      if (explError) {
        const errorMsg = explData?.error || explError.message || "Failed to generate explanation";
        throw new Error(errorMsg);
      }
      if (explData?.error) throw new Error(explData.error);

      const expl = explData as Explanation;
      setExplanation(expl);
      setStatus("generating-images");

      // Generate 2-3 images per scene
      const totalImages = expl.scenes.reduce((sum, s) => {
        const prompts = s.imagePrompts || [s.imagePrompt];
        return sum + prompts.length;
      }, 0);
      setImageProgress({ current: 0, total: totalImages });

      const scenesWithImages = await generateImagesParallel(expl.scenes, (current) => {
        setImageProgress({ current, total: totalImages });
      });

      const finalExplanation = { ...expl, scenes: scenesWithImages };
      setExplanation(finalExplanation);
      setImageProgress({ current: totalImages, total: totalImages });
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
