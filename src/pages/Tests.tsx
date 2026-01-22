import { useState, useEffect } from 'react';
import { Plus, Play, Clock, CheckCircle, AlertCircle, ChevronRight, Trash2, FileText, Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DashboardLayout } from '@/components/DashboardLayout';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Test {
  id: string;
  title: string;
  status: string;
  time_limit_minutes: number | null;
  created_at: string;
  topic_ids: string[];
  subject_ids: string[];
}

interface TestQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  topic_id: string | null;
  explanation: string | null;
}

interface TestResult {
  id: string;
  test_id: string;
  score: number;
  total_questions: number;
  completed_at: string;
  answers: number[];
  time_taken_seconds: number | null;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

interface Topic {
  id: string;
  name: string;
  unit_id: string;
}

interface Unit {
  id: string;
  name: string;
  subject_id: string;
}

type TestStep = 'list' | 'create' | 'taking' | 'results';

export default function Tests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<TestStep>('list');
  
  // Data
  const [tests, setTests] = useState<Test[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);

  // Create test state
  const [newTest, setNewTest] = useState({ title: '', selectedTopics: [] as string[], timeLimit: '' });
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  // Taking test state
  const [currentTest, setCurrentTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [testStartTime, setTestStartTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Results state
  const [currentResult, setCurrentResult] = useState<TestResult | null>(null);
  const [showExplanations, setShowExplanations] = useState<boolean[]>([]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'taking' && currentTest?.time_limit_minutes && testStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - testStartTime.getTime()) / 1000);
        const remaining = (currentTest.time_limit_minutes! * 60) - elapsed;
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          submitTest();
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, currentTest, testStartTime]);

  const fetchData = async () => {
    try {
      const [testsRes, subjectsRes, unitsRes, topicsRes, resultsRes] = await Promise.all([
        supabase.from('tests').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*'),
        supabase.from('units').select('*'),
        supabase.from('topics').select('*').eq('is_completed', true),
        supabase.from('test_results').select('*').order('completed_at', { ascending: false }),
      ]);

      if (testsRes.data) setTests(testsRes.data as unknown as Test[]);
      if (subjectsRes.data) setSubjects(subjectsRes.data);
      if (unitsRes.data) setUnits(unitsRes.data);
      if (topicsRes.data) setTopics(topicsRes.data);
      if (resultsRes.data) setResults(resultsRes.data as unknown as TestResult[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTest = async () => {
    if (!newTest.title.trim() || newTest.selectedTopics.length === 0) {
      toast({ title: 'Error', description: 'Please add a title and select topics', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      // Create test record
      const { data: testData, error: testError } = await supabase
        .from('tests')
        .insert({
          user_id: user!.id,
          title: newTest.title,
          topic_ids: newTest.selectedTopics,
          subject_ids: selectedSubject ? [selectedSubject] : [],
          time_limit_minutes: newTest.timeLimit ? parseInt(newTest.timeLimit) : null,
          status: 'ready',
        })
        .select()
        .single();

      if (testError) throw testError;

      // Generate questions using AI
      const selectedTopicNames = topics
        .filter((t) => newTest.selectedTopics.includes(t.id))
        .map((t) => t.name);

      const subjectName = subjects.find((s) => s.id === selectedSubject)?.name || 'General';

      const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-test', {
        body: { 
          topicNames: selectedTopicNames, 
          subjectName,
          questionCount: Math.min(15, selectedTopicNames.length * 3)
        },
      });

      if (aiError) throw aiError;

      // Save questions
      const questionsToInsert = aiData.questions.map((q: any, i: number) => ({
        test_id: testData.id,
        question: q.question,
        options: q.options,
        correct_index: q.correctIndex,
        topic_id: newTest.selectedTopics[i % newTest.selectedTopics.length],
        difficulty: q.difficulty || 'medium',
        explanation: q.explanation,
      }));

      await supabase.from('test_questions').insert(questionsToInsert);

      toast({ title: 'Test created!', description: `${questionsToInsert.length} questions generated` });
      setNewTest({ title: '', selectedTopics: [], timeLimit: '' });
      setSelectedSubject('');
      setStep('list');
      fetchData();
    } catch (error) {
      console.error('Error creating test:', error);
      toast({ title: 'Error', description: 'Failed to create test', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const startTest = async (test: Test) => {
    try {
      const { data } = await supabase
        .from('test_questions')
        .select('*')
        .eq('test_id', test.id);

      if (!data || data.length === 0) {
        toast({ title: 'Error', description: 'No questions found for this test', variant: 'destructive' });
        return;
      }

      setQuestions(data as unknown as TestQuestion[]);
      setCurrentTest(test);
      setCurrentQuestion(0);
      setAnswers(new Array(data.length).fill(null));
      setTestStartTime(new Date());
      setTimeRemaining(test.time_limit_minutes ? test.time_limit_minutes * 60 : null);
      setStep('taking');
    } catch (error) {
      console.error('Error starting test:', error);
    }
  };

  const selectAnswer = (answerIndex: number) => {
    setAnswers((prev) => {
      const updated = [...prev];
      updated[currentQuestion] = answerIndex;
      return updated;
    });
  };

  const submitTest = async () => {
    if (!currentTest || !testStartTime) return;

    try {
      const score = questions.reduce(
        (acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0),
        0
      );
      const timeTaken = Math.floor((Date.now() - testStartTime.getTime()) / 1000);

      const { data: resultData, error } = await supabase
        .from('test_results')
        .insert({
          test_id: currentTest.id,
          user_id: user!.id,
          answers: answers,
          score,
          total_questions: questions.length,
          time_taken_seconds: timeTaken,
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentResult(resultData as unknown as TestResult);
      setShowExplanations(new Array(questions.length).fill(false));
      setStep('results');
      fetchData();
    } catch (error) {
      console.error('Error submitting test:', error);
      toast({ title: 'Error', description: 'Failed to submit test', variant: 'destructive' });
    }
  };

  const deleteTest = async (testId: string) => {
    try {
      await supabase.from('tests').delete().eq('id', testId);
      setTests((prev) => prev.filter((t) => t.id !== testId));
      toast({ title: 'Test deleted' });
    } catch (error) {
      console.error('Error deleting test:', error);
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSubjectTopics = () => {
    if (!selectedSubject) return [];
    const subjectUnits = units.filter((u) => u.subject_id === selectedSubject);
    return topics.filter((t) => subjectUnits.some((u) => u.id === t.unit_id));
  };

  const toggleTopic = (topicId: string) => {
    setNewTest((prev) => ({
      ...prev,
      selectedTopics: prev.selectedTopics.includes(topicId)
        ? prev.selectedTopics.filter((id) => id !== topicId)
        : [...prev.selectedTopics, topicId],
    }));
  };

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

  // Test Taking View
  if (step === 'taking' && currentTest && questions.length > 0) {
    const q = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;

    return (
      <RequireAuth>
        <DashboardLayout>
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-24 lg:pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-serif text-xl font-bold">{currentTest.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Question {currentQuestion + 1} of {questions.length}
                </p>
              </div>
              {timeRemaining !== null && (
                <Badge variant={timeRemaining < 60 ? 'destructive' : 'secondary'} className="text-lg px-3 py-1">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatTimeRemaining(timeRemaining)}
                </Badge>
              )}
            </div>

            <Progress value={progress} className="h-2" />

            {/* Question Card */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <p className="text-lg font-medium">{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectAnswer(idx)}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 text-left transition-all touch-manipulation",
                        answers[currentQuestion] === idx
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                      {option}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
              >
                Previous
              </Button>
              
              {/* Question dots */}
              <div className="flex gap-1 flex-wrap justify-center">
                {questions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentQuestion(idx)}
                    className={cn(
                      "h-3 w-3 rounded-full transition-all touch-manipulation",
                      currentQuestion === idx
                        ? "bg-primary scale-125"
                        : answers[idx] !== null
                        ? "bg-success"
                        : "bg-muted"
                    )}
                  />
                ))}
              </div>

              {currentQuestion === questions.length - 1 ? (
                <Button onClick={submitTest} disabled={answers.includes(null)}>
                  Submit Test
                </Button>
              ) : (
                <Button onClick={() => setCurrentQuestion((prev) => prev + 1)}>
                  Next
                </Button>
              )}
            </div>
          </div>
        </DashboardLayout>
      </RequireAuth>
    );
  }

  // Results View
  if (step === 'results' && currentResult && questions.length > 0) {
    const percentage = Math.round((currentResult.score / currentResult.total_questions) * 100);

    return (
      <RequireAuth>
        <DashboardLayout>
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-24 lg:pb-8">
            <Button variant="ghost" onClick={() => { setStep('list'); setCurrentResult(null); }}>
              ← Back to Tests
            </Button>

            {/* Score Card */}
            <Card className="text-center">
              <CardContent className="pt-8 pb-6">
                <div className={cn(
                  "h-32 w-32 rounded-full mx-auto flex items-center justify-center mb-4",
                  percentage >= 70 ? "bg-success/20" : percentage >= 50 ? "bg-warning/20" : "bg-destructive/20"
                )}>
                  <div>
                    <span className="text-4xl font-bold">{currentResult.score}</span>
                    <span className="text-2xl text-muted-foreground">/{currentResult.total_questions}</span>
                  </div>
                </div>
                <h2 className="font-serif text-2xl font-bold mb-2">
                  {percentage >= 80 ? '🎉 Excellent!' : percentage >= 60 ? '👍 Good job!' : '💪 Keep practicing!'}
                </h2>
                <p className="text-muted-foreground">
                  You scored {percentage}% 
                  {currentResult.time_taken_seconds && ` in ${Math.floor(currentResult.time_taken_seconds / 60)} minutes`}
                </p>
              </CardContent>
            </Card>

            {/* Question Review */}
            <Card>
              <CardHeader>
                <CardTitle>Review Answers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((q, idx) => {
                  const userAnswer = currentResult.answers[idx];
                  const isCorrect = userAnswer === q.correct_index;

                  return (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                          isCorrect ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                        )}>
                          {isCorrect ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-2">{q.question}</p>
                          <div className="space-y-1 text-sm">
                            <p className={isCorrect ? "text-success" : "text-destructive"}>
                              Your answer: {String.fromCharCode(65 + userAnswer)}. {q.options[userAnswer]}
                            </p>
                            {!isCorrect && (
                              <p className="text-success">
                                Correct: {String.fromCharCode(65 + q.correct_index)}. {q.options[q.correct_index]}
                              </p>
                            )}
                          </div>
                          {q.explanation && (
                            <div className="mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowExplanations((prev) => {
                                  const updated = [...prev];
                                  updated[idx] = !updated[idx];
                                  return updated;
                                })}
                              >
                                {showExplanations[idx] ? 'Hide' : 'Show'} explanation
                              </Button>
                              {showExplanations[idx] && (
                                <p className="mt-2 p-3 bg-muted rounded-lg text-sm">{q.explanation}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </RequireAuth>
    );
  }

  // Create Test View
  if (step === 'create') {
    const subjectTopics = getSubjectTopics();

    return (
      <RequireAuth>
        <DashboardLayout>
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-24 lg:pb-8">
            <Button variant="ghost" onClick={() => setStep('list')}>
              ← Back to Tests
            </Button>

            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold">Create New Test</h1>
              <p className="text-muted-foreground mt-1">Generate MCQ questions from your completed topics</p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                  <Label>Test Title</Label>
                  <Input
                    placeholder="e.g., Physics Unit 1 Test"
                    value={newTest.title}
                    onChange={(e) => setNewTest({ ...newTest, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={selectedSubject} onValueChange={(v) => {
                    setSelectedSubject(v);
                    setNewTest({ ...newTest, selectedTopics: [] });
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSubject && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Select Topics ({newTest.selectedTopics.length} selected)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewTest({
                          ...newTest,
                          selectedTopics: subjectTopics.map((t) => t.id),
                        })}
                      >
                        Select All
                      </Button>
                    </div>
                    <ScrollArea className="h-48 border rounded-lg p-3">
                      {subjectTopics.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No completed topics found. Complete some topics first!
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {subjectTopics.map((topic) => (
                            <div key={topic.id} className="flex items-center gap-3">
                              <Checkbox
                                id={topic.id}
                                checked={newTest.selectedTopics.includes(topic.id)}
                                onCheckedChange={() => toggleTopic(topic.id)}
                              />
                              <label htmlFor={topic.id} className="text-sm cursor-pointer">
                                {topic.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Time Limit (optional)</Label>
                  <Select value={newTest.timeLimit || 'none'} onValueChange={(v) => setNewTest({ ...newTest, timeLimit: v === 'none' ? '' : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="No time limit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No limit</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="20">20 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={createTest} 
                  className="w-full" 
                  disabled={generating || !newTest.title || newTest.selectedTopics.length === 0}
                >
                  {generating ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Generating Questions...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Test
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </RequireAuth>
    );
  }

  // Test List View (default)
  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in pb-24 lg:pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">MCQ Tests</h1>
              <p className="text-muted-foreground mt-1">Test your knowledge with AI-generated quizzes</p>
            </div>
            <Button onClick={() => setStep('create')}>
              <Plus className="h-4 w-4 mr-2" /> Create Test
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">{tests.length}</p>
                <p className="text-xs text-muted-foreground">Total Tests</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">{results.length}</p>
                <p className="text-xs text-muted-foreground">Attempts</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">
                  {results.length > 0
                    ? Math.round(results.reduce((a, r) => a + (r.score / r.total_questions) * 100, 0) / results.length)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">
                  {results.filter((r) => r.score / r.total_questions >= 0.8).length}
                </p>
                <p className="text-xs text-muted-foreground">Aced (80%+)</p>
              </CardContent>
            </Card>
          </div>

          {/* Test List */}
          {tests.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-serif text-xl font-semibold mb-2">No tests yet</h3>
              <p className="text-muted-foreground mb-4">Create your first test to start practicing</p>
              <Button onClick={() => setStep('create')}>
                <Plus className="h-4 w-4 mr-2" /> Create Test
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tests.map((test) => {
                const testResults = results.filter((r) => r.test_id === test.id);
                const bestScore = testResults.length > 0
                  ? Math.max(...testResults.map((r) => Math.round((r.score / r.total_questions) * 100)))
                  : null;

                return (
                  <Card key={test.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{test.title}</h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>{format(new Date(test.created_at), 'MMM d, yyyy')}</span>
                            {test.time_limit_minutes && (
                              <>
                                <span>•</span>
                                <Clock className="h-3 w-3" />
                                <span>{test.time_limit_minutes} min</span>
                              </>
                            )}
                            {bestScore !== null && (
                              <>
                                <span>•</span>
                                <Trophy className="h-3 w-3 text-warning" />
                                <span>Best: {bestScore}%</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button onClick={() => startTest(test)}>
                            <Play className="h-4 w-4 mr-1" /> Start
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteTest(test.id)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Recent Results */}
          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.slice(0, 5).map((result) => {
                    const test = tests.find((t) => t.id === result.test_id);
                    const percentage = Math.round((result.score / result.total_questions) * 100);

                    return (
                      <div key={result.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{test?.title || 'Unknown Test'}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(result.completed_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <Badge variant={percentage >= 70 ? 'default' : 'secondary'}>
                          {result.score}/{result.total_questions} ({percentage}%)
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
