import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TextAnswerProps {
  title: string;
  fullAnswer: string;
}

const AnimatedParagraph = ({ text, delay }: { text: string; delay: number }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <p
      ref={ref}
      className={`text-secondary-foreground font-body leading-relaxed mb-4 last:mb-0 text-sm md:text-base transition-all duration-700 ease-out ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4"
      }`}
    >
      {text}
    </p>
  );
};

const TextAnswer = ({ title, fullAnswer }: TextAnswerProps) => {
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeaderVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!fullAnswer) return null;

  const paragraphs = fullAnswer.split("\n\n").filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-4 mt-10">
      <div
        className={`rounded-2xl bg-card border border-border p-6 md:p-8 transition-all duration-500 ease-out ${
          headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-display font-semibold text-foreground">
            Written Explanation
          </h3>
        </div>
        <div className="prose prose-invert max-w-none">
          {paragraphs.map((paragraph, i) => (
            <AnimatedParagraph key={i} text={paragraph} delay={300 + i * 250} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TextAnswer;
