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
    scenes: item.scenes.map(({ scene_number, title, hook, text, narration, visuals, animation, transition }) => ({
      scene_number, title, hook, text, narration, visuals, animation, transition,
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

// Generate images for all visual prompts across all scenes
async function generateAllImages(
  scenes: Scene[],
  onProgress: (current: number, total: number) => void
): Promise<Scene[]> {
  const BATCH_SIZE = 6;
  const results: Scene[] = scenes.map((s) => ({ ...s, imageUrls: [] }));

  // Flatten all visual prompts with scene/visual indices
  const tasks: { sceneIdx: number; visualIdx: number; prompt: string }[] = [];
  scenes.forEach((scene, si) => {
    scene.visuals.forEach((prompt, vi) => {
      tasks.push({ sceneIdx: si, visualIdx: vi, prompt });
    });
  });

  const total = tasks.length;
  let completed = 0;
  onProgress(0, total);

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (task) => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-scene-image", {
          body: { prompt: task.prompt },
        });
        if (!error && data?.imageUrl) {
          if (!results[task.sceneIdx].imageUrls) results[task.sceneIdx].imageUrls = [];
          // Ensure array is properly sized
          while (results[task.sceneIdx].imageUrls!.length <= task.visualIdx) {
            results[task.sceneIdx].imageUrls!.push("");
          }
          results[task.sceneIdx].imageUrls![task.visualIdx] = data.imageUrl;
        }
      } catch {
        // keep without image
      }
      completed++;
      onProgress(completed, total);
    });

    await Promise.all(promises);

    if (i + BATCH_SIZE < tasks.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Set first imageUrl for backward compat
  results.forEach((scene) => {
    if (scene.imageUrls?.length) {
      scene.imageUrl = scene.imageUrls[0];
    }
  });

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

      const totalVisuals = expl.scenes.reduce((sum, s) => sum + (s.visuals?.length || 0), 0);
      setImageProgress({ current: 0, total: totalVisuals });

      const scenesWithImages = await generateAllImages(expl.scenes, (current, total) => {
        setImageProgress({ current, total });
      });

      const finalExplanation = { ...expl, scenes: scenesWithImages };
      setExplanation(finalExplanation);
      setImageProgress({ current: totalVisuals, total: totalVisuals });
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
