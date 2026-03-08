export interface Scene {
  text: string;
  imagePrompt: string;
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
