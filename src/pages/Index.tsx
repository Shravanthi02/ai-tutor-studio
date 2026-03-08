import HeroSection from "@/components/HeroSection";
import QuestionInput from "@/components/QuestionInput";
import ProgressIndicator from "@/components/ProgressIndicator";
import ScenePlayer from "@/components/ScenePlayer";
import TextAnswer from "@/components/TextAnswer";
import HistorySection from "@/components/HistorySection";
import { useExplanationGenerator } from "@/hooks/useExplanationGenerator";

const Index = () => {
  const {
    status,
    explanation,
    imageProgress,
    history,
    generate,
    loadFromHistory,
    clearHistory,
  } = useExplanationGenerator();

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <QuestionInput onSubmit={generate} status={status} />
      <ProgressIndicator
        status={status}
        currentStep={imageProgress.current}
        totalSteps={imageProgress.total}
      />
      {explanation && (status === "ready" || status === "playing") && (
        <>
          <ScenePlayer
            scenes={explanation.scenes}
            title={explanation.title}
          />
          <AnimatedTextVideo
            fullAnswer={explanation.fullAnswer || ""}
            title={explanation.title}
            scenes={explanation.scenes}
          />
          <TextAnswer
            title={explanation.title}
            fullAnswer={explanation.fullAnswer || ""}
          />
        </>
      )}
      <HistorySection
        items={history}
        onSelect={loadFromHistory}
        onClear={clearHistory}
      />
    </div>
  );
};

export default Index;
