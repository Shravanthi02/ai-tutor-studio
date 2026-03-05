import { BookOpen } from "lucide-react";

interface TextAnswerProps {
  title: string;
  fullAnswer: string;
}

const TextAnswer = ({ title, fullAnswer }: TextAnswerProps) => {
  if (!fullAnswer) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 mt-10">
      <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-display font-semibold text-foreground">
            Written Explanation
          </h3>
        </div>
        <div className="prose prose-invert max-w-none">
          {fullAnswer.split("\n\n").map((paragraph, i) => (
            <p key={i} className="text-secondary-foreground font-body leading-relaxed mb-4 last:mb-0 text-sm md:text-base">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TextAnswer;
