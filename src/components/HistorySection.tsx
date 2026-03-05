import { Clock, Trash2 } from "lucide-react";
import type { HistoryItem } from "@/types/scene";

interface HistorySectionProps {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

const HistorySection = ({ items, onSelect, onClear }: HistorySectionProps) => {
  if (items.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 mt-16 mb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">
            Previous Questions
          </h3>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="text-left p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors group"
          >
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
              {item.question}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{item.title} · {item.scenes.length} scenes</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HistorySection;
