import { useState, useEffect } from 'react';
import { Brain, Check, X, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface RecallQuestion {
  question: string;
  answer: string;
  hint?: string;
}

interface MemoryCheckProps {
  topicName: string;
  topicId: string;
  onComplete?: (score: number, total: number) => void;
  onClose?: () => void;
}

export function MemoryCheck({ topicName, topicId, onComplete, onClose }: MemoryCheckProps) {
  const [questions, setQuestions] = useState<RecallQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<('correct' | 'incorrect')[]>([]);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    generateQuestions();
  }, [topicName]);

  const generateQuestions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Generate 3-5 quick recall questions to test memory on "${topicName}". 
              Return ONLY a JSON array with this format:
              [{"question": "...", "answer": "...", "hint": "optional hint"}]
              Questions should be short, testing key concepts. Answers should be brief (1-2 sentences).`
            }
          ]
        }
      });

      if (error) throw error;

      const content = data?.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setQuestions(parsed);
      } else {
        // Fallback questions
        setQuestions([
          { question: `What is the main concept of ${topicName}?`, answer: 'Think about the key idea you learned.' },
          { question: `Why is ${topicName} important?`, answer: 'Consider its applications and relevance.' },
          { question: `How would you explain ${topicName} to a friend?`, answer: 'Use simple terms and examples.' },
        ]);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      setQuestions([
        { question: `What do you remember about ${topicName}?`, answer: 'Recall the main points.' },
        { question: `What was the key takeaway from ${topicName}?`, answer: 'Think about what stands out.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = (correct: boolean) => {
    const newResults = [...results, correct ? 'correct' as const : 'incorrect' as const];
    setResults(newResults);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
    } else {
      setFinished(true);
      const score = newResults.filter((r) => r === 'correct').length;
      onComplete?.(score, questions.length);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Generating recall questions...</p>
        </CardContent>
      </Card>
    );
  }

  if (finished) {
    const score = results.filter((r) => r === 'correct').length;
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className={cn(
            "h-16 w-16 rounded-full mx-auto flex items-center justify-center mb-2",
            percentage >= 70 ? "bg-success/20" : "bg-warning/20"
          )}>
            <Brain className={cn("h-8 w-8", percentage >= 70 ? "text-success" : "text-warning")} />
          </div>
          <CardTitle className="font-serif">Memory Check Complete!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div>
            <span className="text-4xl font-bold">{score}</span>
            <span className="text-2xl text-muted-foreground">/{questions.length}</span>
            <p className="text-sm text-muted-foreground mt-1">
              {percentage >= 80 ? 'Excellent recall! 🎉' : percentage >= 60 ? 'Good job! 👍' : 'Keep reviewing! 💪'}
            </p>
          </div>
          
          <div className="flex gap-1 justify-center">
            {results.map((r, i) => (
              <div
                key={i}
                className={cn(
                  "h-3 w-3 rounded-full",
                  r === 'correct' ? "bg-success" : "bg-destructive"
                )}
              />
            ))}
          </div>

          <Button onClick={onClose} className="w-full">
            Continue Studying
          </Button>
        </CardContent>
      </Card>
    );
  }

  const q = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Quick Recall</CardTitle>
          </div>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1}/{questions.length}
          </span>
        </div>
        <Progress value={progress} className="h-1 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="min-h-[100px]">
          <p className="text-lg font-medium mb-4">{q.question}</p>
          
          {!showAnswer ? (
            <Button
              variant="outline"
              onClick={() => setShowAnswer(true)}
              className="w-full"
            >
              Show Answer
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">Answer:</p>
                <p className="text-muted-foreground">{q.answer}</p>
              </div>
              
              <p className="text-sm text-center text-muted-foreground">
                Did you get it right?
              </p>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleResponse(false)}
                  className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4 mr-2" />
                  Not quite
                </Button>
                <Button
                  onClick={() => handleResponse(true)}
                  className="flex-1 bg-success hover:bg-success/90"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Got it!
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
