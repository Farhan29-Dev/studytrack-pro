import { useEffect, useState } from 'react';
import { Check, Brain, ChevronDown, ChevronRight, RotateCcw, Trophy, Clock, Star, Loader2, BookOpen, History, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { DashboardLayout } from '@/components/DashboardLayout';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ReviewTopic, QuizQuestion, Topic } from '@/types';
import { calculateNextReview, Difficulty, REQUIRED_REVIEWS, isTopicMastered } from '@/lib/spaced-repetition';
import { cn } from '@/lib/utils';
import { format, differenceInDays, isPast, isToday } from 'date-fns';

interface SubjectData {
  id: string;
  name: string;
  color: string;
  units: { id: string; name: string; topics: TopicWithMeta[] }[];
}

interface TopicWithMeta extends Topic {
  subject_name: string;
  subject_color: string;
  unit_name: string;
}

type ReviewStep = 'list' | 'notes' | 'quiz' | 'score' | 'difficulty';

export default function Review() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subjectsData, setSubjectsData] = useState<SubjectData[]>([]);
  const [openSubjects, setOpenSubjects] = useState<string[]>([]);
  
  // Review state
  const [currentTopic, setCurrentTopic] = useState<TopicWithMeta | null>(null);
  const [reviewStep, setReviewStep] = useState<ReviewStep>('list');
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [showQuizAnswers, setShowQuizAnswers] = useState<boolean[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [generatingContent, setGeneratingContent] = useState(false);
  
  // Analytics
  const [reviewedToday, setReviewedToday] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: subjects } = await supabase.from('subjects').select('*');
      if (!subjects?.length) { setLoading(false); return; }

      const { data: units } = await supabase.from('units').select('*').in('subject_id', subjects.map(s => s.id));
      if (!units?.length) { setLoading(false); return; }

      const { data: topics } = await supabase.from('topics').select('*').in('unit_id', units.map(u => u.id));

      const structured: SubjectData[] = subjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        color: subject.color,
        units: units.filter(u => u.subject_id === subject.id).map(unit => ({
          id: unit.id,
          name: unit.name,
          topics: (topics || [])
            .filter(t => t.unit_id === unit.id && t.is_completed)
            .map(t => ({
              ...t,
              difficulty: t.difficulty as 'easy' | 'medium' | 'hard',
              quiz: t.quiz as unknown as QuizQuestion[] | null,
              subject_name: subject.name,
              subject_color: subject.color,
              unit_name: unit.name,
            }))
        })).filter(u => u.topics.length > 0)
      })).filter(s => s.units.length > 0);

      setSubjectsData(structured);
      
      // Calculate analytics
      const allTopics = structured.flatMap(s => s.units.flatMap(u => u.topics));
      const mastered = allTopics.filter(t => isTopicMastered(t.review_count, t.difficulty)).length;
      setMasteredCount(mastered);

      // Auto-open all subjects
      setOpenSubjects(structured.map(s => s.id));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilReview = (nextReview: string | null): { text: string; urgent: boolean; overdue: boolean } => {
    if (!nextReview) return { text: 'Ready now', urgent: true, overdue: false };
    const reviewDate = new Date(nextReview);
    if (isPast(reviewDate) || isToday(reviewDate)) return { text: 'Due today', urgent: true, overdue: isPast(reviewDate) && !isToday(reviewDate) };
    const days = differenceInDays(reviewDate, new Date());
    if (days === 1) return { text: '1 day remaining', urgent: false, overdue: false };
    return { text: `${days} days remaining`, urgent: false, overdue: false };
  };

  const startReview = (topic: TopicWithMeta) => {
    setCurrentTopic(topic);
    setQuizAnswers([]);
    setShowQuizAnswers([]);
    setQuizScore(0);
    setReviewStep(topic.summary ? 'notes' : 'notes');
  };

  const generateContent = async () => {
    if (!currentTopic) return;
    setGeneratingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-topic-content', {
        body: { topicName: currentTopic.name, subjectName: currentTopic.subject_name, unitName: currentTopic.unit_name },
      });
      if (error) throw error;
      if (data.success && data.data) {
        await supabase.from('topics').update({ summary: data.data.summary, quiz: data.data.quiz }).eq('id', currentTopic.id);
        setCurrentTopic(prev => prev ? { ...prev, summary: data.data.summary, quiz: data.data.quiz } : null);
        toast({ title: 'Content generated', description: 'Notes and quiz are ready' });
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast({ title: 'Error', description: 'Failed to generate content', variant: 'destructive' });
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleQuizAnswer = (questionIndex: number, answerIndex: number) => {
    setQuizAnswers(prev => {
      const updated = [...prev];
      updated[questionIndex] = answerIndex;
      return updated;
    });
  };

  const toggleShowAnswer = (questionIndex: number) => {
    setShowQuizAnswers(prev => {
      const updated = [...prev];
      updated[questionIndex] = !updated[questionIndex];
      return updated;
    });
  };

  const submitQuiz = () => {
    if (!currentTopic?.quiz) return;
    const correct = currentTopic.quiz.reduce((acc, q, i) => acc + (quizAnswers[i] === q.correctIndex ? 1 : 0), 0);
    setQuizScore(correct);
    setReviewStep('score');
  };

  const handleDifficultyRating = async (difficulty: Difficulty) => {
    if (!currentTopic) return;
    try {
      const newReviewCount = currentTopic.review_count + 1;
      const requiredReviews = REQUIRED_REVIEWS[difficulty];
      const nextReview = calculateNextReview(newReviewCount, difficulty, currentTopic.revision_interval_days);
      const mastered = isTopicMastered(newReviewCount, difficulty);

      await supabase.from('topics').update({
        difficulty,
        last_reviewed: new Date().toISOString(),
        next_review: nextReview.toISOString(),
        review_count: newReviewCount,
        required_reviews: requiredReviews,
      }).eq('id', currentTopic.id);

      setReviewedToday(prev => prev + 1);
      if (mastered) setMasteredCount(prev => prev + 1);

      toast({
        title: mastered ? '🎉 Topic Mastered!' : 'Review Complete',
        description: mastered
          ? `Completed ${newReviewCount}/${requiredReviews} reviews`
          : `Next review: ${format(nextReview, 'MMM d, yyyy')} (${newReviewCount}/${requiredReviews})`,
      });

      // Reset and refresh
      setCurrentTopic(null);
      setReviewStep('list');
      fetchData();
    } catch (error) {
      console.error('Error updating review:', error);
      toast({ title: 'Error', description: 'Failed to save review', variant: 'destructive' });
    }
  };

  const allTopics = subjectsData.flatMap(s => s.units.flatMap(u => u.topics));
  const dueTopics = allTopics.filter(t => !t.next_review || isPast(new Date(t.next_review)) || isToday(new Date(t.next_review)));
  const upcomingTopics = allTopics.filter(t => t.next_review && !isPast(new Date(t.next_review)) && !isToday(new Date(t.next_review)));
  const masteredTopics = allTopics.filter(t => isTopicMastered(t.review_count, t.difficulty));

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

  // Active Review Mode
  if (currentTopic && reviewStep !== 'list') {
    return (
      <RequireAuth>
        <DashboardLayout>
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <Button variant="ghost" onClick={() => { setCurrentTopic(null); setReviewStep('list'); }}>
              ← Back to Topics
            </Button>

            <Card className="overflow-hidden">
              <div className="h-2" style={{ backgroundColor: currentTopic.subject_color }} />
              <CardHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{currentTopic.subject_name}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary">{currentTopic.unit_name}</Badge>
                  <Badge variant="outline" className="ml-auto">
                    {currentTopic.review_count}/{REQUIRED_REVIEWS[currentTopic.difficulty]} reviews
                  </Badge>
                </div>
                <CardTitle className="font-serif text-2xl text-center py-4">{currentTopic.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Step 1: Notes */}
                {reviewStep === 'notes' && (
                  <div className="space-y-4">
                    {currentTopic.summary ? (
                      <>
                        <div className="bg-muted/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <BookOpen className="h-4 w-4" /> Study Notes
                          </h4>
                          <p className="text-sm whitespace-pre-wrap">{currentTopic.summary}</p>
                        </div>
                        <div className="flex justify-center gap-3">
                          {currentTopic.quiz?.length ? (
                            <Button onClick={() => setReviewStep('quiz')}>Proceed to Quiz →</Button>
                          ) : (
                            <Button onClick={() => setReviewStep('difficulty')}>Rate Difficulty →</Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">No notes available for this topic.</p>
                        <Button onClick={generateContent} disabled={generatingContent}>
                          {generatingContent ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Brain className="mr-2 h-4 w-4" />Generate Notes & Quiz</>}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Quiz */}
                {reviewStep === 'quiz' && currentTopic.quiz && (
                  <div className="space-y-6">
                    {currentTopic.quiz.map((q, qIndex) => (
                      <div key={qIndex} className="space-y-3 border-b pb-4 last:border-0">
                        <p className="font-medium">{qIndex + 1}. {q.question}</p>
                        <div className="grid gap-2">
                          {q.options.map((opt, oIndex) => (
                            <Button
                              key={oIndex}
                              variant={quizAnswers[qIndex] === oIndex ? 'default' : 'outline'}
                              className="justify-start h-auto py-2 text-left"
                              onClick={() => handleQuizAnswer(qIndex, oIndex)}
                            >
                              {String.fromCharCode(65 + oIndex)}. {opt}
                            </Button>
                          ))}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => toggleShowAnswer(qIndex)}>
                          {showQuizAnswers[qIndex] ? 'Hide Answer' : 'Show Answer'}
                        </Button>
                        {showQuizAnswers[qIndex] && (
                          <div className="bg-success/10 text-success p-3 rounded text-sm">
                            <strong>Answer:</strong> {String.fromCharCode(65 + q.correctIndex)}. {q.options[q.correctIndex]}
                            {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                    <Button className="w-full" onClick={submitQuiz} disabled={quizAnswers.length < currentTopic.quiz.length}>
                      Submit Quiz
                    </Button>
                  </div>
                )}

                {/* Step 3: Score */}
                {reviewStep === 'score' && currentTopic.quiz && (
                  <div className="text-center space-y-4 py-6">
                    <div className="text-6xl font-bold text-primary">{quizScore}/{currentTopic.quiz.length}</div>
                    <p className="text-muted-foreground">
                      {quizScore === currentTopic.quiz.length ? 'Perfect! 🎉' : quizScore >= currentTopic.quiz.length / 2 ? 'Good job! 👍' : 'Keep practicing! 💪'}
                    </p>
                    <Progress value={(quizScore / currentTopic.quiz.length) * 100} className="h-3" />
                    <Button onClick={() => setReviewStep('difficulty')} className="mt-4">
                      Rate Topic Difficulty →
                    </Button>
                  </div>
                )}

                {/* Step 4: Difficulty Rating */}
                {reviewStep === 'difficulty' && (
                  <div className="text-center space-y-6 py-6">
                    <h3 className="text-lg font-medium">How difficult was this topic?</h3>
                    <p className="text-sm text-muted-foreground">This affects your revision schedule</p>
                    <div className="flex justify-center gap-4">
                      <Button variant="outline" onClick={() => handleDifficultyRating('easy')} className="flex-col h-auto py-4 px-6 hover:bg-success/10 hover:border-success">
                        <span className="text-2xl mb-1">😊</span>
                        <span className="font-medium">Easy</span>
                        <span className="text-xs text-muted-foreground">2 reviews</span>
                      </Button>
                      <Button variant="outline" onClick={() => handleDifficultyRating('medium')} className="flex-col h-auto py-4 px-6 hover:bg-warning/10 hover:border-warning">
                        <span className="text-2xl mb-1">🤔</span>
                        <span className="font-medium">Medium</span>
                        <span className="text-xs text-muted-foreground">3 reviews</span>
                      </Button>
                      <Button variant="outline" onClick={() => handleDifficultyRating('hard')} className="flex-col h-auto py-4 px-6 hover:bg-destructive/10 hover:border-destructive">
                        <span className="text-2xl mb-1">😰</span>
                        <span className="font-medium">Hard</span>
                        <span className="text-xs text-muted-foreground">4 reviews</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </RequireAuth>
    );
  }

  // Topic List View
  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          <div className="text-center">
            <h1 className="font-serif text-3xl font-bold text-foreground">Review Center</h1>
            <p className="text-muted-foreground mt-1">Track and review your completed topics</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dueTopics.length}</p>
                  <p className="text-xs text-muted-foreground">Due Now</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{upcomingTopics.length}</p>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
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
                  <p className="text-xs text-muted-foreground">Today</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                  <Star className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{masteredCount}</p>
                  <p className="text-xs text-muted-foreground">Mastered</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="due" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="due">Due for Review ({dueTopics.length})</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming ({upcomingTopics.length})</TabsTrigger>
              <TabsTrigger value="history">Mastered ({masteredCount})</TabsTrigger>
            </TabsList>

            {/* Due Topics Tab */}
            <TabsContent value="due" className="space-y-4 mt-4">
              {dueTopics.length === 0 ? (
                <Card className="text-center p-8">
                  <Trophy className="h-12 w-12 text-success mx-auto mb-4" />
                  <h3 className="font-semibold text-lg">All Caught Up!</h3>
                  <p className="text-muted-foreground">No topics due for review right now.</p>
                </Card>
              ) : (
                subjectsData.map(subject => {
                  const dueInSubject = subject.units.flatMap(u => u.topics).filter(t => !t.next_review || isPast(new Date(t.next_review)) || isToday(new Date(t.next_review)));
                  if (dueInSubject.length === 0) return null;
                  return (
                    <Collapsible key={subject.id} open={openSubjects.includes(subject.id)} onOpenChange={(open) => {
                      setOpenSubjects(prev => open ? [...prev, subject.id] : prev.filter(id => id !== subject.id));
                    }}>
                      <Card>
                        <CollapsibleTrigger className="w-full">
                          <CardHeader className="flex flex-row items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: subject.color }} />
                              <CardTitle className="text-lg">{subject.name}</CardTitle>
                              <Badge variant="destructive">{dueInSubject.length} due</Badge>
                            </div>
                            {openSubjects.includes(subject.id) ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0 space-y-2">
                            {dueInSubject.map(topic => {
                              const reviewInfo = getDaysUntilReview(topic.next_review);
                              return (
                                <div key={topic.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                                  <div className="flex-1">
                                    <p className="font-medium">{topic.name}</p>
                                    <p className="text-xs text-muted-foreground">{topic.unit_name}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Badge variant={reviewInfo.overdue ? 'destructive' : 'outline'} className="text-xs">
                                      {reviewInfo.text}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {topic.review_count}/{REQUIRED_REVIEWS[topic.difficulty]}
                                    </Badge>
                                    <Button size="sm" onClick={() => startReview(topic)}>Review</Button>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
            </TabsContent>

            {/* Upcoming Tab */}
            <TabsContent value="upcoming" className="space-y-4 mt-4">
              {upcomingTopics.length === 0 ? (
                <Card className="text-center p-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg">No Upcoming Reviews</h3>
                  <p className="text-muted-foreground">Complete more topics to schedule reviews.</p>
                </Card>
              ) : (
                subjectsData.map(subject => {
                  const upcomingInSubject = subject.units.flatMap(u => u.topics).filter(t => t.next_review && !isPast(new Date(t.next_review)) && !isToday(new Date(t.next_review)));
                  if (upcomingInSubject.length === 0) return null;
                  return (
                    <Collapsible key={subject.id} open={openSubjects.includes(subject.id)} onOpenChange={(open) => {
                      setOpenSubjects(prev => open ? [...prev, subject.id] : prev.filter(id => id !== subject.id));
                    }}>
                      <Card>
                        <CollapsibleTrigger className="w-full">
                          <CardHeader className="flex flex-row items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: subject.color }} />
                              <CardTitle className="text-lg">{subject.name}</CardTitle>
                              <Badge variant="outline">{upcomingInSubject.length} scheduled</Badge>
                            </div>
                            {openSubjects.includes(subject.id) ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0 space-y-2">
                            {upcomingInSubject.sort((a, b) => new Date(a.next_review!).getTime() - new Date(b.next_review!).getTime()).map(topic => {
                              const reviewInfo = getDaysUntilReview(topic.next_review);
                              return (
                                <div key={topic.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                  <div className="flex-1">
                                    <p className="font-medium">{topic.name}</p>
                                    <p className="text-xs text-muted-foreground">{topic.unit_name}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="text-xs">{reviewInfo.text}</Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {topic.review_count}/{REQUIRED_REVIEWS[topic.difficulty]}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
            </TabsContent>

            {/* History/Mastered Tab */}
            <TabsContent value="history" className="space-y-4 mt-4">
              {masteredTopics.length === 0 ? (
                <Card className="text-center p-8">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg">No Mastered Topics Yet</h3>
                  <p className="text-muted-foreground">Complete all required reviews to master topics.</p>
                </Card>
              ) : (
                subjectsData.map(subject => {
                  const masteredInSubject = subject.units.flatMap(u => u.topics).filter(t => isTopicMastered(t.review_count, t.difficulty));
                  if (masteredInSubject.length === 0) return null;
                  return (
                    <Collapsible key={subject.id} open={openSubjects.includes(subject.id)} onOpenChange={(open) => {
                      setOpenSubjects(prev => open ? [...prev, subject.id] : prev.filter(id => id !== subject.id));
                    }}>
                      <Card>
                        <CollapsibleTrigger className="w-full">
                          <CardHeader className="flex flex-row items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: subject.color }} />
                              <CardTitle className="text-lg">{subject.name}</CardTitle>
                              <Badge variant="default" className="bg-success">{masteredInSubject.length} mastered</Badge>
                            </div>
                            {openSubjects.includes(subject.id) ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0 space-y-2">
                            {masteredInSubject.map(topic => (
                              <div key={topic.id} className="flex items-center justify-between p-3 bg-success/5 rounded-lg">
                                <div className="flex-1">
                                  <p className="font-medium flex items-center gap-2">
                                    <Trophy className="h-4 w-4 text-success" />
                                    {topic.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{topic.unit_name}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs">
                                    {topic.last_reviewed && `Mastered ${format(new Date(topic.last_reviewed), 'MMM d')}`}
                                  </Badge>
                                  <Button size="sm" variant="outline" onClick={() => startReview(topic)}>Review Again</Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-center">
            <Button variant="outline" onClick={fetchData}>
              <RotateCcw className="mr-2 h-4 w-4" />Refresh
            </Button>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
