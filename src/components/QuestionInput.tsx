import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GenerationStatus } from "@/types/scene";

interface QuestionInputProps {
  onSubmit: (question: string) => void;
  status: GenerationStatus;
}

const EXAMPLE_QUESTIONS = [
  "How does photosynthesis work?",
  "What causes earthquakes?",
  "How does the internet work?",
  "Why is the sky blue?",
];

const QuestionInput = ({ onSubmit, status }: QuestionInputProps) => {
  const [question, setQuestion] = useState("");
  const isLoading = status === "generating-text";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isLoading) {
      onSubmit(question.trim());
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="gradient-border rounded-xl">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask any question… e.g., How do black holes form?"
            className="w-full bg-card rounded-xl px-5 py-4 pr-36 text-foreground placeholder:text-muted-foreground resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/30 font-body"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        </div>
        <Button
          type="submit"
          disabled={!question.trim() || isLoading}
          className="absolute right-3 bottom-3 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-display font-semibold px-5"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Generate Video
            </>
          )}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => { setQuestion(q); }}
            className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors font-body"
            disabled={isLoading}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuestionInput;
