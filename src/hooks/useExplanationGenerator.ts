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

export function useExplanationGenerator() {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [explanation, setExplanation] = useState<Explanation | null>(null);
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
        scenes: expl.scenes,
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
    history,
    generate,
    loadFromHistory,
    clearHistory,
    setPlaying,
  };
}
