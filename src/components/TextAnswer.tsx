import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import type { Scene } from "@/types/scene";

interface TextAnswerProps {
  title: string;
  fullAnswer: string;
  scenes?: Scene[];
}

const AnimatedParagraph = ({ text, delay, images }: { text: string; delay: number; images?: string[] }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`mb-6 last:mb-0 transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <p className="text-secondary-foreground font-body leading-relaxed text-sm md:text-base">
        {text}
      </p>
      {images && images.length > 0 && (
        <div className={`mt-3 grid gap-2 ${images.length >= 3 ? "grid-cols-3" : images.length === 2 ? "grid-cols-2" : "grid-cols-1 max-w-md"}`}>
          {images.map((url, i) => (
            <div
              key={i}
              className={`rounded-lg overflow-hidden border border-border transition-all duration-500 ${
                visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
              style={{ transitionDelay: `${delay + 200 + i * 150}ms` }}
            >
              <img
                src={url}
                alt={`Illustration ${i + 1}`}
                className="w-full h-auto object-cover aspect-video"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TextAnswer = ({ title, fullAnswer, scenes }: TextAnswerProps) => {
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeaderVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!fullAnswer) return null;

  const paragraphs = fullAnswer.split("\n\n").filter(Boolean);

  // Map scene images to paragraphs (distribute evenly)
  const getImagesForParagraph = (index: number): string[] => {
    if (!scenes || scenes.length === 0) return [];
    // Distribute scenes across paragraphs
    const scenesPerParagraph = Math.max(1, Math.ceil(scenes.length / paragraphs.length));
    const startScene = index * scenesPerParagraph;
    const endScene = Math.min(startScene + scenesPerParagraph, scenes.length);
    
    const images: string[] = [];
    for (let i = startScene; i < endScene; i++) {
      const sceneImages = scenes[i]?.imageUrls?.filter(Boolean) || 
        (scenes[i]?.imageUrl ? [scenes[i].imageUrl!] : []);
      images.push(...sceneImages);
    }
    return images.slice(0, 3); // Max 3 images per paragraph
  };

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
            <AnimatedParagraph
              key={i}
              text={paragraph}
              delay={300 + i * 250}
              images={getImagesForParagraph(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TextAnswer;
