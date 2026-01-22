import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BookOpen, CheckCircle, Clock, Brain, TrendingUp, Calendar, ArrowLeft, Shield, Target, Award } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Subject, Topic } from '@/types';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';

interface WeeklySummary {
  topicsCompleted: number;
  reviewsDone: number;
  aiInteractions: number;
  studyStreak: number;
  overallProgress: number;
  averageTestScore: number;
  testsCompleted: number;
}

interface ConfidenceData {
  low: number;
  medium: number;
  high: number;
}

interface TestResult {
  id: string;
  score: number;
  total_questions: number;
  completed_at: string;
}

export default function ParentDashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary>({
    topicsCompleted: 0,
    reviewsDone: 0,
    aiInteractions: 0,
    studyStreak: 0,
    overallProgress: 0,
    averageTestScore: 0,
    testsCompleted: 0,
  });
  const [weeklyActivity, setWeeklyActivity] = useState<Array<{ day: string; topics: number; reviews: number }>>([]);
  const [confidenceData, setConfidenceData] = useState<ConfidenceData>({ low: 0, medium: 0, high: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get all subjects
      const { data: subjectsData } = await supabase.from('subjects').select('*').order('created_at', { ascending: false });
      if (subjectsData) setSubjects(subjectsData);

      // Get all topics
      const { data: unitsData } = await supabase.from('units').select('id');
      if (unitsData && unitsData.length > 0) {
        const unitIds = unitsData.map((u) => u.id);
        const { data: topicsData } = await supabase.from('topics').select('*').in('unit_id', unitIds);

        if (topicsData) {
          const mappedTopics = topicsData.map((t) => ({ ...t, quiz: t.quiz as unknown as Topic['quiz'] })) as Topic[];
          setTopics(mappedTopics);
          calculateWeeklySummary(mappedTopics);
          calculateWeeklyActivity(mappedTopics);
          calculateConfidenceData(mappedTopics);
        }
      }

      // Get test results
      const { data: resultsData } = await supabase
        .from('test_results')
        .select('id, score, total_questions, completed_at')
        .order('completed_at', { ascending: false });
      
      if (resultsData) {
        setTestResults(resultsData);
        calculateTestStats(resultsData);
      }

      // Count AI interactions (chat messages from last 7 days)
      const weekAgo = subDays(new Date(), 7).toISOString();
      const { count: aiCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo);

      setWeeklySummary((prev) => ({
        ...prev,
        aiInteractions: aiCount || 0,
      }));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTestStats = (results: TestResult[]) => {
    const weekAgo = subDays(new Date(), 7);
    const recentTests = results.filter(r => new Date(r.completed_at) >= weekAgo);
    
    const totalScore = recentTests.reduce((acc, r) => acc + (r.score / r.total_questions * 100), 0);
    const avgScore = recentTests.length > 0 ? Math.round(totalScore / recentTests.length) : 0;
    
    setWeeklySummary(prev => ({
      ...prev,
      averageTestScore: avgScore,
      testsCompleted: recentTests.length,
    }));
  };

  const calculateConfidenceData = (topicsData: Topic[]) => {
    const confidence = { low: 0, medium: 0, high: 0 };
    topicsData.forEach(t => {
      if (t.confidence === 'low') confidence.low++;
      else if (t.confidence === 'medium') confidence.medium++;
      else if (t.confidence === 'high') confidence.high++;
    });
    setConfidenceData(confidence);
  };

  const calculateWeeklySummary = (topicsData: Topic[]) => {
    const weekAgo = subDays(new Date(), 7);
    const completedThisWeek = topicsData.filter((t) => {
      if (!t.is_completed || !t.last_reviewed) return false;
      return new Date(t.last_reviewed) >= weekAgo;
    }).length;

    const reviewsThisWeek = topicsData.filter((t) => {
      if (!t.last_reviewed) return false;
      return new Date(t.last_reviewed) >= weekAgo && t.review_count > 0;
    }).length;

    const totalTopics = topicsData.length;
    const completedTopics = topicsData.filter((t) => t.is_completed).length;
    const overallProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    // Calculate study streak (consecutive days with activity)
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const date = subDays(new Date(), i);
      const dayStart = startOfDay(date);
      const hasActivity = topicsData.some((t) => {
        if (!t.last_reviewed) return false;
        return isSameDay(new Date(t.last_reviewed), dayStart);
      });
      if (hasActivity) streak++;
      else if (i > 0) break;
    }

    setWeeklySummary((prev) => ({
      ...prev,
      topicsCompleted: completedThisWeek,
      reviewsDone: reviewsThisWeek,
      studyStreak: streak,
      overallProgress,
    }));
  };

  const calculateWeeklyActivity = (topicsData: Topic[]) => {
    const data = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStart = startOfDay(date);

      const topicsOnDay = topicsData.filter((t) => {
        if (!t.last_reviewed) return false;
        return isSameDay(new Date(t.last_reviewed), dayStart);
      }).length;

      const reviewsOnDay = topicsData.filter((t) => {
        if (!t.last_reviewed) return false;
        return isSameDay(new Date(t.last_reviewed), dayStart) && t.review_count > 0;
      }).length;

      return {
        day: format(date, 'EEE'),
        topics: topicsOnDay,
        reviews: reviewsOnDay,
      };
    });

    setWeeklyActivity(data);
  };

  const subjectProgress = subjects.map((s) => ({
    name: s.name.length > 12 ? s.name.substring(0, 12) + '...' : s.name,
    progress: s.progress,
    color: s.color,
  }));

  const progressColors = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)'];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading progress report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="touch-manipulation">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-serif text-xl font-bold">Parent Dashboard</h1>
              <p className="text-xs text-muted-foreground">Weekly Progress Report</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            Read Only
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Weekly Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold">{weeklySummary.topicsCompleted}</p>
              <p className="text-xs text-muted-foreground">Topics Completed</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
                <BookOpen className="h-5 w-5 text-accent" />
              </div>
              <p className="text-2xl font-bold">{weeklySummary.reviewsDone}</p>
              <p className="text-xs text-muted-foreground">Reviews Done</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-2">
                <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-2xl font-bold">{weeklySummary.aiInteractions}</p>
              <p className="text-xs text-muted-foreground">AI Questions</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-2xl font-bold">{weeklySummary.studyStreak}</p>
              <p className="text-xs text-muted-foreground">Day Streak 🔥</p>
            </CardContent>
          </Card>
        </div>

        {/* Overall Progress */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-serif">Overall Progress</CardTitle>
            <CardDescription>Total syllabus completion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Progress value={weeklySummary.overallProgress} className="h-4" />
              </div>
              <span className="text-2xl font-bold text-primary">{weeklySummary.overallProgress}%</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {topics.filter((t) => t.is_completed).length} of {topics.length} topics completed
            </p>
          </CardContent>
        </Card>

        {/* Weekly Activity Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-serif">This Week's Activity</CardTitle>
            <CardDescription>Daily study activity over the past 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="topics" name="Topics" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="reviews" name="Reviews" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subject Progress */}
        {subjects.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-serif">Subject Progress</CardTitle>
              <CardDescription>Progress breakdown by subject</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subjects.map((subject, index) => (
                <div key={subject.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: subject.color }}
                      />
                      <span className="text-sm font-medium">{subject.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{subject.progress}%</span>
                  </div>
                  <Progress value={subject.progress} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Test Performance & Confidence */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Test Performance */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Test Performance
              </CardTitle>
              <CardDescription>Weekly test results</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {weeklySummary.averageTestScore}%
              </div>
              <p className="text-sm text-muted-foreground">
                Average score from {weeklySummary.testsCompleted} test{weeklySummary.testsCompleted !== 1 ? 's' : ''} this week
              </p>
              {weeklySummary.averageTestScore >= 80 && (
                <Badge className="mt-2 bg-green-500/10 text-green-600 border-green-500/20">
                  <Award className="h-3 w-3 mr-1" /> Excellent!
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Confidence Distribution */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-serif">Confidence Levels</CardTitle>
              <CardDescription>Student's self-assessed confidence</CardDescription>
            </CardHeader>
            <CardContent>
              {(confidenceData.low + confidenceData.medium + confidenceData.high) > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-green-500" />
                      High Confidence
                    </span>
                    <span className="text-sm font-medium">{confidenceData.high} topics</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-yellow-500" />
                      Medium Confidence
                    </span>
                    <span className="text-sm font-medium">{confidenceData.medium} topics</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-red-500" />
                      Low Confidence
                    </span>
                    <span className="text-sm font-medium">{confidenceData.low} topics</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No confidence ratings yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary Message */}
        <Card className="shadow-sm bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-6 text-center">
            <p className="text-lg font-serif mb-2">
              {weeklySummary.overallProgress >= 75
                ? '🌟 Excellent progress this week!'
                : weeklySummary.overallProgress >= 50
                ? '👍 Good progress! Keep it up!'
                : weeklySummary.overallProgress >= 25
                ? '📚 Making steady progress'
                : '🚀 Just getting started!'}
            </p>
            <p className="text-sm text-muted-foreground">
              {weeklySummary.studyStreak > 0
                ? `${weeklySummary.studyStreak} day study streak! 🔥`
                : 'Start studying to build a streak!'}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
