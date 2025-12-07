import { useEffect, useState } from 'react';
import { Check, Brain, ChevronRight, RotateCcw, Trophy, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/DashboardLayout';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ReviewTopic } from '@/types';
import { calculateNextReview, Difficulty, isTopicDueForReview } from '@/lib/spaced-repetition';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function Review() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviewQueue, setReviewQueue] = useState<ReviewTopic[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewedToday, setReviewedToday] = useState(0);

  useEffect(() => {
    if (user) {
      fetchReviewQueue();
    }
  }, [user]);

  const fetchReviewQueue = async () => {
    try {
      // Fetch subjects first
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*');

      if (!subjectsData) return;

      // Fetch all units
      const subjectIds = subjectsData.map((s) => s.id);
      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .in('subject_id', subjectIds);

      if (!unitsData || unitsData.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch all topics
      const unitIds = unitsData.map((u) => u.id);
      const { data: topicsData } = await supabase
        .from('topics')
        .select('*')
        .in('unit_id', unitIds);

      if (!topicsData) {
        setLoading(false);
        return;
      }

      // Filter topics due for review
      const dueTopics = topicsData.filter(
        (topic) => topic.is_completed && isTopicDueForReview(topic.next_review)
      );

      // Build review queue with subject/unit info
      const queue: ReviewTopic[] = dueTopics.map((topic) => {
        const unit = unitsData.find((u) => u.id === topic.unit_id);
        const subject = subjectsData.find((s) => s.id === unit?.subject_id);

        return {
          ...topic,
          subject_name: subject?.name || 'Unknown',
          subject_color: subject?.color || '#3B82F6',
          unit_name: unit?.name || 'Unknown',
        } as ReviewTopic;
      });

      setReviewQueue(queue);
    } catch (error) {
      console.error('Error fetching review queue:', error);
      toast({
        title: 'Error',
        description: 'Failed to load review queue',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDifficultyRating = async (difficulty: Difficulty) => {
    const currentTopic = reviewQueue[currentIndex];
    if (!currentTopic) return;

    try {
      const nextReview = calculateNextReview(currentTopic.review_count, difficulty);

      await supabase
        .from('topics')
        .update({
          difficulty,
          last_reviewed: new Date().toISOString(),
          next_review: nextReview.toISOString(),
          review_count: currentTopic.review_count + 1,
        })
        .eq('id', currentTopic.id);

      setReviewedToday((prev) => prev + 1);

      toast({
        title: 'Review recorded',
        description: `Next review: ${format(nextReview, 'MMM d, yyyy')}`,
      });

      // Move to next topic
      if (currentIndex < reviewQueue.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setShowAnswer(false);
      } else {
        // All reviews done
        setReviewQueue([]);
      }
    } catch (error) {
      console.error('Error updating review:', error);
      toast({
        title: 'Error',
        description: 'Failed to save review',
        variant: 'destructive',
      });
    }
  };

  const currentTopic = reviewQueue[currentIndex];

  if (loading) {
    return (
      <RequireAuth>
        <DashboardLayout>
          <div className="flex items-center justify-center h-96">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </DashboardLayout>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center">
            <h1 className="font-serif text-3xl font-bold text-foreground">Spaced Repetition Review</h1>
            <p className="text-muted-foreground mt-1">Reinforce your learning with active recall</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{reviewQueue.length}</p>
                  <p className="text-sm text-muted-foreground">Topics to review</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{reviewedToday}</p>
                  <p className="text-sm text-muted-foreground">Reviewed today</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Review Card */}
          {currentTopic ? (
            <Card className="overflow-hidden">
              <div className="h-2" style={{ backgroundColor: currentTopic.subject_color }} />
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{currentTopic.subject_name}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary">{currentTopic.unit_name}</Badge>
                </div>
                <CardTitle className="font-serif text-2xl text-center py-6">
                  {currentTopic.name}
                </CardTitle>
                {currentTopic.notes && showAnswer && (
                  <CardDescription className="text-center mt-4">
                    {currentTopic.notes}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!showAnswer ? (
                  <div className="text-center">
                    <p className="text-muted-foreground mb-6">
                      Think about what you know about this topic, then reveal the answer.
                    </p>
                    <Button onClick={() => setShowAnswer(true)} size="lg">
                      <Brain className="mr-2 h-5 w-5" />
                      Show Answer
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        How difficult was it to recall this topic?
                      </p>
                      <div className="flex justify-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => handleDifficultyRating('hard')}
                          className="flex-1 max-w-[100px] hover:bg-destructive hover:text-destructive-foreground"
                        >
                          Hard
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDifficultyRating('medium')}
                          className="flex-1 max-w-[100px] hover:bg-warning hover:text-foreground"
                        >
                          Medium
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDifficultyRating('easy')}
                          className="flex-1 max-w-[100px] hover:bg-success hover:text-success-foreground"
                        >
                          Easy
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-center text-muted-foreground">
                      <p>Review count: {currentTopic.review_count}</p>
                      {currentTopic.last_reviewed && (
                        <p>
                          Last reviewed: {format(new Date(currentTopic.last_reviewed), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2 pt-4">
                  {reviewQueue.map((_, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'h-2 w-2 rounded-full transition-colors',
                        idx === currentIndex
                          ? 'bg-primary'
                          : idx < currentIndex
                          ? 'bg-success'
                          : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center p-12">
              <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                <Trophy className="h-10 w-10 text-success" />
              </div>
              <h3 className="font-serif text-2xl font-semibold mb-2">All Caught Up!</h3>
              <p className="text-muted-foreground mb-6">
                {reviewedToday > 0
                  ? `Great job! You've reviewed ${reviewedToday} topic${reviewedToday > 1 ? 's' : ''} today.`
                  : 'No topics are due for review right now. Complete more topics to build your review queue!'}
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={fetchReviewQueue}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Button asChild>
                  <a href="/syllabus">Go to Syllabus</a>
                </Button>
              </div>
            </Card>
          )}

          {/* Info */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">How Spaced Repetition Works</h4>
              <p className="text-sm text-muted-foreground">
                The system schedules reviews based on your performance. Topics you find easy are
                shown less frequently, while difficult topics appear more often. This optimizes
                your learning by focusing on what needs the most practice.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
