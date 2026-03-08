export interface Scene {
  scene_number: number;
  title: string;
  hook: string;
  text: string;
  narration: string;
  visuals: string[];
  imageUrls?: string[];
  animation: string;
  transition: string;
  // Legacy support
  imagePrompt?: string;
  imageUrl?: string;
}

export interface Explanation {
  title: string;
  fullAnswer: string;
  scenes: Scene[];
}

export interface HistoryItem {
  id: string;
  question: string;
  title: string;
  fullAnswer: string;
  timestamp: number;
  scenes: Scene[];
}

export type GenerationStatus = 
  | "idle" 
  | "generating-text" 
  | "generating-images" 
  | "ready" 
  | "playing" 
  | "error";
