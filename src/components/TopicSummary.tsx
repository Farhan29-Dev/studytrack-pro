import { useState } from 'react';
import { BookOpen, Brain, Loader2, Check, X, Eye, EyeOff, HelpCircle, Copy, Save, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MarkdownMessage } from './MarkdownMessage';

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
    const emoji = percentage >= 80 ? '🎉' : percentage >= 60 ? '👍' : '💪';
    return (
      <Card className="shadow-lg">
        <CardContent className="p-6 text-center">
          <div className={cn("h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg",
            percentage >= 80 ? "bg-green-100 dark:bg-green-900/30" : percentage >= 60 ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-red-100 dark:bg-red-900/30")}>
            <span className="text-4xl">{emoji}</span>
          </div>
          <h3 className="font-serif text-xl font-semibold mb-2">Quiz Complete!</h3>
          <p className={cn("text-3xl font-bold mb-2",
            percentage >= 80 ? "text-green-600 dark:text-green-400" : percentage >= 60 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400")}>
            {percentage}%
          </p>
          <p className="text-muted-foreground mb-4">You got {score} out of {quiz.length} correct</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={handleRetry} className="touch-manipulation">Try Again</Button>
            {onClose && <Button onClick={onClose} className="touch-manipulation">Done</Button>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">Question {currentQuestion + 1} of {quiz.length}</Badge>
          <Badge variant="outline" className="text-xs">Score: {score}/{currentQuestion + (selectedAnswer !== null ? 1 : 0)}</Badge>
        </div>
        <CardTitle className="text-base sm:text-lg mt-3 leading-relaxed">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrect = index === question.correctIndex;
          const showResult = selectedAnswer !== null;

          return (
            <button key={index} onClick={() => handleSelectAnswer(index)} disabled={selectedAnswer !== null}
              className={cn("w-full p-4 rounded-xl border-2 text-left transition-all touch-manipulation",
                showResult && isCorrect && "bg-green-50 dark:bg-green-900/20 border-green-500",
                showResult && isSelected && !isCorrect && "bg-red-50 dark:bg-red-900/20 border-red-500",
                !showResult && isSelected && "border-primary bg-primary/5",
                !showResult && !isSelected && "border-border hover:border-primary/50")}>
              <div className="flex items-center gap-3">
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0",
                  showResult && isCorrect && "bg-green-500 text-white",
                  showResult && isSelected && !isCorrect && "bg-red-500 text-white",
                  !showResult && "bg-muted")}>
                  {showResult ? (isCorrect ? <Check className="h-4 w-4" /> : isSelected ? <X className="h-4 w-4" /> : String.fromCharCode(65 + index))
                    : String.fromCharCode(65 + index)}
                </div>
                <span className="flex-1 text-sm sm:text-base">{option}</span>
              </div>
            </button>
          );
        })}

        {selectedAnswer !== null && (
          <div className="pt-4 space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAnswer(!showAnswer)} className="text-muted-foreground touch-manipulation">
              {showAnswer ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showAnswer ? 'Hide' : 'Show'} Explanation
            </Button>
            {showAnswer && (
              <div className="p-4 bg-muted/50 rounded-xl">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{question.explanation}</p>
                </div>
              </div>
            )}
            <Button onClick={handleNext} className="w-full touch-manipulation h-12">
              {currentQuestion < quiz.length - 1 ? 'Next Question →' : '🎯 See Results'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TopicSummary({ topicName, subjectName, unitName, summary, quiz, onGenerateContent, isGenerating }: TopicSummaryProps) {
  const [showQuiz, setShowQuiz] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast({
        title: 'Copied! 📋',
        description: 'Notes copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  if (!summary && !quiz) {
    return (
      <Card className="bg-gradient-to-br from-muted/30 to-muted/10 shadow-lg">
        <CardContent className="p-6 sm:p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Ready to Study? 📚</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Generate AI-powered notes and a quiz to master this topic!
          </p>
          {onGenerateContent && (
            <Button onClick={onGenerateContent} disabled={isGenerating} size="lg" className="touch-manipulation">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating your notes...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-5 w-5" />
                  Generate Study Materials
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {summary && !showQuiz && (
        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Study Notes
                </CardTitle>
                <CardDescription className="mt-1">{topicName}</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCopy}
                  className="touch-manipulation"
                >
                  {copied ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                {quiz && quiz.length > 0 && (
                  <Button size="sm" onClick={() => setShowQuiz(true)} className="touch-manipulation">
                    <Brain className="mr-2 h-4 w-4" />
                    Take Quiz
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Enhanced notes display with markdown */}
            <div className="prose prose-sm sm:prose max-w-none dark:prose-invert bg-muted/30 rounded-xl p-4 sm:p-6">
              <MarkdownMessage content={summary} />
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border flex-wrap">
              <Badge variant="outline" className="text-xs">{subjectName}</Badge>
              <Badge variant="secondary" className="text-xs">{unitName}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {showQuiz && quiz && quiz.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-serif text-lg font-semibold">🧠 Quiz: {topicName}</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowQuiz(false)} className="touch-manipulation">
              ← Back to Notes
            </Button>
          </div>
          <TopicQuiz quiz={quiz} topicName={topicName} onClose={() => setShowQuiz(false)} />
        </div>
      )}
    </div>
  );
}
