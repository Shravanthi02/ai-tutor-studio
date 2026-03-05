import { Sparkles } from "lucide-react";

const HeroSection = () => {
  return (
    <div className="text-center py-12 md:py-20 px-4">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border mb-6">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">AI-Powered Learning</span>
      </div>
      <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-display tracking-tight mb-4 glow-text">
        AI Animated
        <br />
        <span className="text-primary">Learning Assistant</span>
      </h1>
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
        Ask any question and watch it come alive as an animated explanation.
        Your personal AI teacher that turns concepts into visual stories.
      </p>
    </div>
  );
};

export default HeroSection;
