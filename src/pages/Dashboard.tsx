import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { BookOpen, CheckCircle, Target, TrendingUp, Calendar, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ProgressRing } from '@/components/ProgressRing';
import { RevisionReminder } from '@/components/RevisionReminder';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Subject, Topic } from '@/types';
import { getTopicsDueToday, getUrgentReviewCount, isTopicMastered } from '@/lib/spaced-repetition';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}

function StatsCard({ title, value, description, icon: Icon, trend }: StatsCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <p className="text-xs text-success mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<Array<{ day: string; topics: number; reviews: number }>>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .order('created_at', { ascending: false });

      if (subjectsData) setSubjects(subjectsData);

      const { data: unitsData } = await supabase.from('units').select('id');
      if (unitsData && unitsData.length > 0) {
        const unitIds = unitsData.map(u => u.id);
        const { data: topicsData } = await supabase.from('topics').select('*').in('unit_id', unitIds);
        
        if (topicsData) {
          const mappedTopics = topicsData.map(t => ({ ...t, quiz: t.quiz as unknown as Topic['quiz'] })) as Topic[];
          setTopics(mappedTopics);
          calculateWeeklyActivity(mappedTopics);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWeeklyActivity = (topicsData: Topic[]) => {
    const data = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStart = startOfDay(date);

      const topicsCompletedOnDay = topicsData.filter(t => {
        if (!t.is_completed || !t.last_reviewed) return false;
        return isSameDay(new Date(t.last_reviewed), dayStart);
      }).length;

      const reviewsOnDay = topicsData.filter(t => {
        if (!t.last_reviewed) return false;
        return isSameDay(new Date(t.last_reviewed), dayStart) && t.review_count > 0;
      }).length;

      return {
        day: format(date, 'EEE'),
        topics: topicsCompletedOnDay,
        reviews: reviewsOnDay,
      };
    });

    setWeeklyData(data);
  };

  const totalSubjects = subjects.length;
  const completedTopics = topics.filter(t => t.is_completed).length;
  const totalTopics = topics.length;
  const overallProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  const topicsDueToday = getTopicsDueToday(topics);
  const urgentCount = getUrgentReviewCount(topics);
  const masteredTopics = topics.filter(t => t.is_completed && isTopicMastered(t.review_count, t.difficulty)).length;

  const subjectProgressData = subjects.map(subject => ({
    name: subject.name.substring(0, 10) + (subject.name.length > 10 ? '...' : ''),
    progress: subject.progress,
    color: subject.color,
  }));

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="space-y-8 animate-fade-in">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">Track your study progress and performance</p>
          </div>

          {/* Revision Reminder */}
          {topicsDueToday > 0 && (
            <RevisionReminder topicsCount={topicsDueToday} urgentCount={urgentCount} />
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Total Subjects" value={totalSubjects} description="Active subjects" icon={BookOpen} />
            <StatsCard title="Topics Completed" value={`${completedTopics}/${totalTopics}`} description="Topics marked done" icon={CheckCircle} />
            <StatsCard title="Due for Review" value={topicsDueToday} description="Topics to revise" icon={Calendar} />
            <StatsCard title="Topics Mastered" value={masteredTopics} description="Fully reviewed" icon={Star} />
          </div>

          {/* Progress Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="font-serif">Overall Progress</CardTitle>
                <CardDescription>Your total completion rate</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-4">
                <ProgressRing progress={overallProgress} size={160} strokeWidth={12} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-serif">Subject Progress</CardTitle>
                <CardDescription>Progress by subject</CardDescription>
              </CardHeader>
              <CardContent>
                {subjectProgressData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={subjectProgressData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    <p>Add subjects to see progress</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Weekly Activity - Real Data */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Weekly Activity</CardTitle>
              <CardDescription>Your actual study activity over the past week</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="topics" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} name="Topics Completed" />
                  <Line type="monotone" dataKey="reviews" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: 'hsl(var(--success))' }} name="Reviews Done" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Subjects */}
          {subjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Your Subjects</CardTitle>
                <CardDescription>Quick overview of your subjects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjects.slice(0, 6).map((subject) => (
                    <div key={subject.id} className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center text-primary-foreground font-semibold" style={{ backgroundColor: subject.color }}>
                        {subject.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{subject.name}</p>
                        <p className="text-sm text-muted-foreground">{subject.progress}% complete</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
