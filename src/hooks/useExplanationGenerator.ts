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

// Generate ALL images for all scenes in parallel batches
async function generateImagesParallel(
  scenes: Scene[],
  onProgress: (current: number) => void
): Promise<Scene[]> {
  const BATCH_SIZE = 4;
  const results: Scene[] = scenes.map((s) => ({ ...s, imageUrls: [] }));

  // Build a flat list of all image generation tasks
  const tasks: { sceneIdx: number; promptIdx: number; prompt: string; sceneText: string }[] = [];
  for (let si = 0; si < scenes.length; si++) {
    const prompts = scenes[si].imagePrompts || [scenes[si].imagePrompt];
    for (let pi = 0; pi < prompts.length; pi++) {
      tasks.push({ sceneIdx: si, promptIdx: pi, prompt: prompts[pi], sceneText: scenes[si].text });
    }
  }

  let completed = 0;

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (task) => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-scene-image", {
          body: { prompt: task.prompt, sceneText: task.sceneText },
        });
        if (!error && data?.imageUrl) {
          if (!results[task.sceneIdx].imageUrls) {
            results[task.sceneIdx].imageUrls = [];
          }
          // Ensure correct index
          results[task.sceneIdx].imageUrls![task.promptIdx] = data.imageUrl;
          // Set first image as main imageUrl for backward compat
          if (task.promptIdx === 0) {
            results[task.sceneIdx].imageUrl = data.imageUrl;
          }
        }
      } catch {
        // keep without image
      }
      completed++;
      onProgress(completed);
    });

    await Promise.all(promises);

    if (i + BATCH_SIZE < tasks.length) {
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
