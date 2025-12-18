import { useState } from 'react';
import { BookOpen, Brain, Loader2, Check, X, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface TopicSummaryProps {
  topicName: string;
  subjectName: string;
  unitName: string;
  summary: string | null;
  quiz: QuizQuestion[] | null;
  onGenerateContent?: () => void;
  isGenerating?: boolean;
}

// Inline Quiz Component
function TopicQuiz({ quiz, topicName, onClose }: { quiz: QuizQuestion[]; topicName: string; onClose?: () => void }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const question = quiz[currentQuestion];

  const handleSelectAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    if (index === question.correctIndex) setScore(score + 1);
  };

  const handleNext = () => {
    if (currentQuestion < quiz.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowAnswer(false);
    } else {
      setCompleted(true);
    }
  };

  const handleRetry = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowAnswer(false);
    setScore(0);
    setCompleted(false);
  };

  if (completed) {
    const percentage = Math.round((score / quiz.length) * 100);
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className={cn("h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4",
            percentage >= 80 ? "bg-success/10" : percentage >= 60 ? "bg-warning/10" : "bg-destructive/10")}>
            <span className={cn("text-3xl font-bold",
              percentage >= 80 ? "text-success" : percentage >= 60 ? "text-warning" : "text-destructive")}>
              {percentage}%
            </span>
          </div>
          <h3 className="font-serif text-xl font-semibold mb-2">Quiz Complete!</h3>
          <p className="text-muted-foreground mb-4">You scored {score} out of {quiz.length} questions</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={handleRetry}>Try Again</Button>
            {onClose && <Button onClick={onClose}>Done</Button>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">Question {currentQuestion + 1} of {quiz.length}</Badge>
          <Badge variant="outline">Score: {score}/{currentQuestion + (selectedAnswer !== null ? 1 : 0)}</Badge>
        </div>
        <CardTitle className="text-lg mt-2">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrect = index === question.correctIndex;
          const showResult = selectedAnswer !== null;

          return (
            <button key={index} onClick={() => handleSelectAnswer(index)} disabled={selectedAnswer !== null}
              className={cn("w-full p-3 rounded-lg border text-left transition-all hover:border-primary/50",
                showResult && isCorrect && "bg-success/10 border-success",
                showResult && isSelected && !isCorrect && "bg-destructive/10 border-destructive",
                !showResult && isSelected && "border-primary bg-primary/5",
                !showResult && !isSelected && "border-border")}>
              <div className="flex items-center gap-3">
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium",
                  showResult && isCorrect && "bg-success text-success-foreground",
                  showResult && isSelected && !isCorrect && "bg-destructive text-destructive-foreground",
                  !showResult && "bg-muted")}>
                  {showResult ? (isCorrect ? <Check className="h-3 w-3" /> : isSelected ? <X className="h-3 w-3" /> : String.fromCharCode(65 + index))
                    : String.fromCharCode(65 + index)}
                </div>
                <span className="flex-1">{option}</span>
              </div>
            </button>
          );
        })}

        {selectedAnswer !== null && (
          <div className="pt-4 space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAnswer(!showAnswer)} className="text-muted-foreground">
              {showAnswer ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showAnswer ? 'Hide' : 'Show'} Explanation
            </Button>
            {showAnswer && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 text-primary mt-0.5" />
                  <p className="text-sm text-muted-foreground">{question.explanation}</p>
                </div>
              </div>
            )}
            <Button onClick={handleNext} className="w-full">
              {currentQuestion < quiz.length - 1 ? 'Next Question' : 'See Results'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TopicSummary({ topicName, subjectName, unitName, summary, quiz, onGenerateContent, isGenerating }: TopicSummaryProps) {
  const [showQuiz, setShowQuiz] = useState(false);

  if (!summary && !quiz) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-6 text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">No study materials yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Generate AI-powered summary and quiz for this topic</p>
          {onGenerateContent && (
            <Button onClick={onGenerateContent} disabled={isGenerating}>
              {isGenerating ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>) : (<><Brain className="mr-2 h-4 w-4" />Generate Study Materials</>)}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {summary && !showQuiz && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Summary</CardTitle>
                <CardDescription>{topicName}</CardDescription>
              </div>
              {quiz && quiz.length > 0 && (
                <Button size="sm" onClick={() => setShowQuiz(true)}><Brain className="mr-2 h-4 w-4" />Take Quiz</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {summary.split('\n').map((paragraph, idx) => (<p key={idx} className="text-muted-foreground">{paragraph}</p>))}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <Badge variant="outline">{subjectName}</Badge>
              <Badge variant="secondary">{unitName}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {showQuiz && quiz && quiz.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold">Quick Quiz: {topicName}</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowQuiz(false)}>Back to Summary</Button>
          </div>
          <TopicQuiz quiz={quiz} topicName={topicName} onClose={() => setShowQuiz(false)} />
        </div>
      )}
    </div>
  );
}
