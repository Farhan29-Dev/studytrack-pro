import { useEffect, useState } from 'react';
import { Check, Brain, ChevronDown, ChevronRight, RotateCcw, Trophy, Clock, Star, Loader2, BookOpen, History, AlertCircle, Save, FileText, CheckSquare, Square, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { DashboardLayout } from '@/components/DashboardLayout';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ReviewTopic, QuizQuestion, Topic } from '@/types';
import { calculateNextReview, Difficulty, REQUIRED_REVIEWS, isTopicMastered } from '@/lib/spaced-repetition';
import { cn } from '@/lib/utils';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { ConfidenceMeter } from '@/components/ConfidenceMeter';

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
  subject_id: string;
}

type ReviewStep = 'list' | 'notes' | 'quiz' | 'score' | 'confidence' | 'difficulty';
type ReviewMode = 'single' | 'bulk';

export default function Review() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subjectsData, setSubjectsData] = useState<SubjectData[]>([]);
  const [openSubjects, setOpenSubjects] = useState<string[]>([]);
  const [openUnits, setOpenUnits] = useState<string[]>([]);
  const [openSavedSubjects, setOpenSavedSubjects] = useState<string[]>([]);
  const [openSavedUnits, setOpenSavedUnits] = useState<string[]>([]);
  
  // Selection state for bulk review
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  
  // Review state
  const [reviewMode, setReviewMode] = useState<ReviewMode>('single');
  const [currentTopic, setCurrentTopic] = useState<TopicWithMeta | null>(null);
  const [bulkTopics, setBulkTopics] = useState<TopicWithMeta[]>([]);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [reviewStep, setReviewStep] = useState<ReviewStep>('list');
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [showQuizAnswers, setShowQuizAnswers] = useState<boolean[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [selectedConfidence, setSelectedConfidence] = useState<'low' | 'medium' | 'high' | null>(null);
  
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
              confidence: t.confidence as 'low' | 'medium' | 'high' | null,
              quiz: t.quiz as unknown as QuizQuestion[] | null,
              weak_areas: t.weak_areas as string[] | null,
              subject_name: subject.name,
              subject_color: subject.color,
              unit_name: unit.name,
              subject_id: subject.id,
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

  // Selection handlers
  const toggleTopicSelection = (topicId: string) => {
    setSelectedTopics(prev => 
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    );
  };

  const selectUnit = (unitTopics: TopicWithMeta[]) => {
    const topicIds = unitTopics.map(t => t.id);
    const allSelected = topicIds.every(id => selectedTopics.includes(id));
    if (allSelected) {
      setSelectedTopics(prev => prev.filter(id => !topicIds.includes(id)));
    } else {
      setSelectedTopics(prev => [...new Set([...prev, ...topicIds])]);
    }
  };

  const startSingleReview = (topic: TopicWithMeta) => {
    setReviewMode('single');
    setCurrentTopic(topic);
    setBulkTopics([]);
    setBulkIndex(0);
    setQuizAnswers([]);
    setShowQuizAnswers([]);
    setQuizScore(0);
    setSelectedConfidence(null);
    setReviewStep('notes');
  };

  const startBulkReview = () => {
    const allTopics = subjectsData.flatMap(s => s.units.flatMap(u => u.topics));
    const topicsToReview = allTopics.filter(t => selectedTopics.includes(t.id));
    
    if (topicsToReview.length === 0) {
      toast({ title: 'No topics selected', description: 'Please select at least one topic to review', variant: 'destructive' });
      return;
    }

    setReviewMode('bulk');
    setBulkTopics(topicsToReview);
    setBulkIndex(0);
    setCurrentTopic(topicsToReview[0]);
    setQuizAnswers([]);
    setShowQuizAnswers([]);
    setQuizScore(0);
    setSelectedConfidence(null);
    setReviewStep('notes');
    setSelectionMode(false);
  };

  const generateContent = async () => {
    if (!currentTopic) return;
    setGeneratingContent(true);
    try {
      const reviewLevel = currentTopic.review_level || 1;
      const { data, error } = await supabase.functions.invoke('generate-topic-content', {
        body: { 
          topicName: currentTopic.name, 
          subjectName: currentTopic.subject_name, 
          unitName: currentTopic.unit_name,
          reviewLevel 
        },
      });
      if (error) throw error;
      if (data.success && data.data) {
        // Update the topic in the database
        await supabase.from('topics').update({ 
          summary: data.data.summary, 
          quiz: data.data.quiz,
          review_level: reviewLevel 
        }).eq('id', currentTopic.id);
        
        // Update local state immediately for better UX
        const updatedTopic = { 
          ...currentTopic, 
          summary: data.data.summary, 
          quiz: data.data.quiz, 
          review_level: reviewLevel,
          updated_at: new Date().toISOString() // Force re-render
        };
        setCurrentTopic(updatedTopic);
        
        // If in bulk mode, update the topic in bulkTopics array as well
        if (reviewMode === 'bulk') {
          setBulkTopics(prev => prev.map(t => 
            t.id === currentTopic.id ? updatedTopic : t
          ));
        }
        
        // Force a re-render by updating a key
        setReviewStep('notes');
        
        toast({ title: 'Content generated', description: `Level ${reviewLevel} notes and quiz are ready` });
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast({ title: 'Error', description: 'Failed to generate content', variant: 'destructive' });
    } finally {
      setGeneratingContent(false);
    }
  };

  const saveNotes = async () => {
    if (!currentTopic || !currentTopic.summary) return;
    setSavingNotes(true);
    try {
      await supabase.from('topics').update({ 
        notes: currentTopic.summary 
      }).eq('id', currentTopic.id);
      setCurrentTopic(prev => prev ? { ...prev, notes: currentTopic.summary } : null);
      toast({ title: 'Notes saved!', description: 'You can access your saved notes anytime from the Saved Notes tab' });
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({ title: 'Error', description: 'Failed to save notes', variant: 'destructive' });
    } finally {
      setSavingNotes(false);
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
    if (!currentTopic || !selectedConfidence) return;
    try {
      const newReviewCount = currentTopic.review_count + 1;
      const requiredReviews = REQUIRED_REVIEWS[difficulty];
      const nextReview = calculateNextReview(newReviewCount, difficulty, currentTopic.revision_interval_days);
      const mastered = isTopicMastered(newReviewCount, difficulty);

      await supabase.from('topics').update({
        difficulty,
        confidence: selectedConfidence,
        last_reviewed: new Date().toISOString(),
        next_review: nextReview.toISOString(),
        review_count: newReviewCount,
        required_reviews: requiredReviews,
        review_level: Math.min((currentTopic.review_level || 1) + 1, 3),
      }).eq('id', currentTopic.id);

      setReviewedToday(prev => prev + 1);
      if (mastered) setMasteredCount(prev => prev + 1);

      // Reset confidence for next topic
      setSelectedConfidence(null);

      // Handle bulk review progression
      if (reviewMode === 'bulk' && bulkIndex < bulkTopics.length - 1) {
        const nextIndex = bulkIndex + 1;
        setBulkIndex(nextIndex);
        setCurrentTopic(bulkTopics[nextIndex]);
        setQuizAnswers([]);
        setShowQuizAnswers([]);
        setQuizScore(0);
        setReviewStep('notes');
        toast({ 
          title: `Topic ${bulkIndex + 1}/${bulkTopics.length} completed`, 
          description: `Moving to: ${bulkTopics[nextIndex].name}` 
        });
      } else {
        toast({
          title: reviewMode === 'bulk' ? '🎉 Bulk Review Complete!' : (mastered ? '🎉 Topic Mastered!' : 'Review Complete'),
          description: reviewMode === 'bulk' 
            ? `Reviewed ${bulkTopics.length} topics successfully`
            : (mastered
              ? `Completed ${newReviewCount}/${requiredReviews} reviews`
              : `Next review: ${format(nextReview, 'MMM d, yyyy')} (${newReviewCount}/${requiredReviews})`),
        });

        // Reset and refresh
        setCurrentTopic(null);
        setBulkTopics([]);
        setBulkIndex(0);
        setSelectedTopics([]);
        setReviewStep('list');
        fetchData();
      }
    } catch (error) {
      console.error('Error updating review:', error);
      toast({ title: 'Error', description: 'Failed to save review', variant: 'destructive' });
    }
  };

  const allTopics = subjectsData.flatMap(s => s.units.flatMap(u => u.topics));
  const dueTopics = allTopics.filter(t => !t.next_review || isPast(new Date(t.next_review)) || isToday(new Date(t.next_review)));
  const upcomingTopics = allTopics.filter(t => t.next_review && !isPast(new Date(t.next_review)) && !isToday(new Date(t.next_review)));
  const masteredTopics = allTopics.filter(t => isTopicMastered(t.review_count, t.difficulty));
  const savedNotesTopics = allTopics.filter(t => t.notes);

  // Group saved notes by subject and unit
  const savedNotesGrouped = subjectsData.map(subject => ({
    ...subject,
    units: subject.units.map(unit => ({
      ...unit,
      topics: unit.topics.filter(t => t.notes)
    })).filter(u => u.topics.length > 0)
  })).filter(s => s.units.length > 0);

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
    const totalInBulk = bulkTopics.length;
    const currentPosition = bulkIndex + 1;

    return (
      <RequireAuth>
        <DashboardLayout>
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => { setCurrentTopic(null); setReviewStep('list'); setBulkTopics([]); setBulkIndex(0); }}>
                ← Back to Topics
              </Button>
              {reviewMode === 'bulk' && (
                <Badge variant="secondary" className="text-sm">
                  Topic {currentPosition} of {totalInBulk}
                </Badge>
              )}
            </div>

            {/* Bulk progress bar */}
            {reviewMode === 'bulk' && (
              <Progress value={(currentPosition / totalInBulk) * 100} className="h-2" />
            )}

            <Card className="overflow-hidden">
              <div className="h-2" style={{ backgroundColor: currentTopic.subject_color }} />
              <CardHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{currentTopic.subject_name}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary">{currentTopic.unit_name}</Badge>
                  <Badge variant="outline" className="ml-auto">
                    Level {currentTopic.review_level || 1} • {currentTopic.review_count}/{REQUIRED_REVIEWS[currentTopic.difficulty]} reviews
                  </Badge>
                </div>
                <CardTitle className="font-serif text-2xl text-center py-4">{currentTopic.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Step 1: Notes */}
                {reviewStep === 'notes' && (
                  <div className="space-y-4">
                    {generatingContent ? (
                      <div className="text-center py-8">
                        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
                        <p className="text-muted-foreground mb-2">Generating study notes...</p>
                        <p className="text-xs text-muted-foreground">This may take a few seconds</p>
                      </div>
                    ) : currentTopic.summary ? (
                      <>
                        <div className="bg-muted/50 rounded-lg p-4 max-h-80 overflow-y-auto">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium flex items-center gap-2">
                              <BookOpen className="h-4 w-4" /> 
                              Study Notes
                              <Badge variant="outline" className="ml-2">Level {currentTopic.review_level || 1}</Badge>
                            </h4>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={saveNotes}
                              disabled={savingNotes || currentTopic.notes === currentTopic.summary}
                            >
                              {savingNotes ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : currentTopic.notes === currentTopic.summary ? (
                                <><Check className="h-4 w-4 mr-1" /> Saved</>
                              ) : (
                                <><Save className="h-4 w-4 mr-1" /> Save Notes</>
                              )}
                            </Button>
                          </div>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <NotesContent content={currentTopic.summary} level={currentTopic.review_level || 1} />
                          </div>
                        </div>
                        <div className="flex justify-center gap-3">
                          <Button variant="outline" onClick={generateContent} disabled={generatingContent}>
                            {generatingContent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                            Regenerate Notes
                          </Button>
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
                    <Button onClick={() => setReviewStep('confidence')} className="mt-4">
                      Rate Your Confidence →
                    </Button>
                  </div>
                )}

                {/* Step 3.5: Confidence Rating */}
                {reviewStep === 'confidence' && (
                  <div className="space-y-6 py-6">
                    <ConfidenceMeter
                      onSelect={(level) => setSelectedConfidence(level)}
                      selected={selectedConfidence}
                    />
                    <div className="flex justify-center">
                      <Button
                        onClick={() => setReviewStep('difficulty')}
                        disabled={!selectedConfidence}
                        className="mt-4"
                      >
                        Rate Topic Difficulty →
                      </Button>
                    </div>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

          {/* Selection Mode Controls */}
          <Card className="bg-muted/30">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant={selectionMode ? "default" : "outline"}
                  onClick={() => { setSelectionMode(!selectionMode); setSelectedTopics([]); }}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  {selectionMode ? 'Cancel Selection' : 'Select Multiple'}
                </Button>
                {selectionMode && selectedTopics.length > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {selectedTopics.length} topic{selectedTopics.length !== 1 ? 's' : ''} selected
                  </Badge>
                )}
              </div>
              {selectionMode && selectedTopics.length > 0 && (
                <Button onClick={startBulkReview}>
                  <Brain className="mr-2 h-4 w-4" />
                  Review Selected ({selectedTopics.length})
                </Button>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="due" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="due">Due ({dueTopics.length})</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming ({upcomingTopics.length})</TabsTrigger>
              <TabsTrigger value="history">Mastered ({masteredCount})</TabsTrigger>
              <TabsTrigger value="saved">
                <FileText className="mr-1 h-4 w-4" />
                Notes ({savedNotesTopics.length})
              </TabsTrigger>
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
                          <CardContent className="pt-0 space-y-4">
                            {subject.units.map(unit => {
                              const dueInUnit = unit.topics.filter(t => !t.next_review || isPast(new Date(t.next_review)) || isToday(new Date(t.next_review)));
                              if (dueInUnit.length === 0) return null;
                              const unitSelected = dueInUnit.every(t => selectedTopics.includes(t.id));
                              
                              return (
                                <div key={unit.id} className="space-y-2">
                                  <div className="flex items-center justify-between py-2 border-b">
                                    <div className="flex items-center gap-2">
                                      {selectionMode && (
                                        <Checkbox 
                                          checked={unitSelected}
                                          onCheckedChange={() => selectUnit(dueInUnit)}
                                        />
                                      )}
                                      <span className="font-medium text-sm text-muted-foreground">{unit.name}</span>
                                      <Badge variant="outline" className="text-xs">{dueInUnit.length} topics</Badge>
                                    </div>
                                    {selectionMode && (
                                      <Button size="sm" variant="ghost" onClick={() => selectUnit(dueInUnit)}>
                                        {unitSelected ? 'Deselect Unit' : 'Select Unit'}
                                      </Button>
                                    )}
                                  </div>
                                  {dueInUnit.map(topic => {
                                    const reviewInfo = getDaysUntilReview(topic.next_review);
                                    const isSelected = selectedTopics.includes(topic.id);
                                    return (
                                      <div 
                                        key={topic.id} 
                                        className={cn(
                                          "flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors",
                                          isSelected && "ring-2 ring-primary bg-primary/5"
                                        )}
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          {selectionMode && (
                                            <Checkbox 
                                              checked={isSelected}
                                              onCheckedChange={() => toggleTopicSelection(topic.id)}
                                            />
                                          )}
                                          <div>
                                            <p className="font-medium">{topic.name}</p>
                                            <p className="text-xs text-muted-foreground">Level {topic.review_level || 1}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <Badge variant={reviewInfo.overdue ? 'destructive' : 'outline'} className="text-xs">
                                            {reviewInfo.text}
                                          </Badge>
                                          <Badge variant="secondary" className="text-xs">
                                            {topic.review_count}/{REQUIRED_REVIEWS[topic.difficulty]}
                                          </Badge>
                                          {!selectionMode && (
                                            <Button size="sm" onClick={() => startSingleReview(topic)}>Review</Button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
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
                                  <Button size="sm" variant="outline" onClick={() => startSingleReview(topic)}>Review Again</Button>
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

            {/* Saved Notes Tab */}
            <TabsContent value="saved" className="space-y-4 mt-4">
              {savedNotesTopics.length === 0 ? (
                <Card className="text-center p-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg">No Saved Notes Yet</h3>
                  <p className="text-muted-foreground">Save notes during your review sessions to access them here.</p>
                </Card>
              ) : (
                savedNotesGrouped.map(subject => (
                  <Collapsible 
                    key={subject.id} 
                    open={openSavedSubjects.includes(subject.id)} 
                    onOpenChange={(open) => {
                      setOpenSavedSubjects(prev => open ? [...prev, subject.id] : prev.filter(id => id !== subject.id));
                    }}
                  >
                    <Card>
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="flex flex-row items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: subject.color }} />
                            <CardTitle className="text-lg">{subject.name}</CardTitle>
                            <Badge variant="secondary">
                              {subject.units.reduce((acc, u) => acc + u.topics.length, 0)} notes
                            </Badge>
                          </div>
                          {openSavedSubjects.includes(subject.id) ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-4">
                          {subject.units.map(unit => (
                            <Collapsible 
                              key={unit.id}
                              open={openSavedUnits.includes(unit.id)}
                              onOpenChange={(open) => {
                                setOpenSavedUnits(prev => open ? [...prev, unit.id] : prev.filter(id => id !== unit.id));
                              }}
                            >
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    {openSavedUnits.includes(unit.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    <span className="font-medium">{unit.name}</span>
                                    <Badge variant="outline" className="text-xs">{unit.topics.length}</Badge>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="pl-6 space-y-2 mt-2">
                                  {unit.topics.map(topic => (
                                    <Collapsible key={topic.id}>
                                      <Card className="overflow-hidden">
                                        <CollapsibleTrigger className="w-full">
                                          <div className="flex items-center justify-between p-3 hover:bg-muted/50">
                                            <div className="flex items-center gap-2">
                                              <FileText className="h-4 w-4 text-primary" />
                                              <span className="font-medium text-sm">{topic.name}</span>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                              Level {topic.review_level || 1}
                                            </Badge>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="p-4 pt-0 border-t bg-muted/30">
                                            <div className="prose prose-sm dark:prose-invert max-w-none mt-3">
                                              <NotesContent content={topic.notes!} level={topic.review_level || 1} />
                                            </div>
                                          </div>
                                        </CollapsibleContent>
                                      </Card>
                                    </Collapsible>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ))}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))
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

// Structured Notes Component
function NotesContent({ content, level }: { content: string | null | undefined; level: number }) {
  if (!content || typeof content !== 'string') {
    return <p className="text-sm text-muted-foreground">No notes available.</p>;
  }
  
  const sections = content.split('\n\n').filter(Boolean);
  
  return (
    <div className="space-y-4">
      {level >= 2 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Badge variant="outline" className="text-xs">
            {level === 1 ? 'Concise Summary' : level === 2 ? 'Detailed Notes' : 'Exam-Ready Notes'}
          </Badge>
        </div>
      )}
      {sections.map((section, index) => {
        // Check if section is a heading (starts with # or is all caps or ends with :)
        const isHeading = section.startsWith('#') || section.endsWith(':') || (section.length < 50 && section === section.toUpperCase());
        
        if (isHeading) {
          return (
            <h4 key={index} className="font-semibold text-sm text-primary mt-4 first:mt-0">
              {section.replace(/^#+\s*/, '')}
            </h4>
          );
        }
        
        // Check if section is a list
        if (section.includes('\n- ') || section.startsWith('- ') || section.includes('\n• ') || section.startsWith('• ')) {
          const items = section.split(/\n[-•]\s*/).filter(Boolean);
          return (
            <ul key={index} className="list-disc list-inside space-y-1 text-sm">
              {items.map((item, i) => (
                <li key={i} className="text-muted-foreground">{item.trim()}</li>
              ))}
            </ul>
          );
        }
        
        // Check if section has numbered items
        if (/^\d+\.\s/.test(section) || section.includes('\n1. ')) {
          const items = section.split(/\n\d+\.\s*/).filter(Boolean);
          return (
            <ol key={index} className="list-decimal list-inside space-y-1 text-sm">
              {items.map((item, i) => (
                <li key={i} className="text-muted-foreground">{item.trim()}</li>
              ))}
            </ol>
          );
        }
        
        // Regular paragraph
        return (
          <p key={index} className="text-sm text-muted-foreground leading-relaxed">
            {section}
          </p>
        );
      })}
    </div>
  );
}
