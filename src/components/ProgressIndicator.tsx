import type { GenerationStatus } from "@/types/scene";

interface ProgressIndicatorProps {
  status: GenerationStatus;
}

const STATUS_LABELS: Record<GenerationStatus, string> = {
  idle: "",
  "generating-text": "Crafting explanation…",
  ready: "Ready to play!",
  playing: "Now playing",
  error: "Something went wrong",
};

const ProgressIndicator = ({ status }: ProgressIndicatorProps) => {
  if (status === "idle") return null;

  const progress = status === "generating-text" ? 50 : status === "ready" || status === "playing" ? 100 : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 mt-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground font-body">
          {STATUS_LABELS[status]}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressIndicator;
