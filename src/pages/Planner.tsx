import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Trash2, Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { DashboardLayout } from '@/components/DashboardLayout';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek, isSameDay, isToday, isPast, parseISO } from 'date-fns';

interface StudyTask {
  id: string;
  title: string;
  subject_id: string | null;
  scheduled_date: string;
  is_completed: boolean;
  carry_over_from: string | null;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

type PomodoroMode = 'pomodoro' | 'short' | 'long';

const POMODORO_TIMES: Record<PomodoroMode, number> = {
  pomodoro: 25 * 60,
  short: 5 * 60,
  long: 10 * 60,
};

export default function Planner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newTaskDialog, setNewTaskDialog] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', subject_id: '' });

  // Pomodoro state
  const [timerMode, setTimerMode] = useState<PomodoroMode>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(POMODORO_TIMES.pomodoro);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  useEffect(() => {
    if (user) {
      fetchData();
      carryOverTasks();
    }
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      handleTimerComplete();
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const fetchData = async () => {
    try {
      const [tasksRes, subjectsRes] = await Promise.all([
        supabase.from('study_tasks').select('*').order('scheduled_date', { ascending: true }),
        supabase.from('subjects').select('id, name, color'),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (subjectsRes.data) setSubjects(subjectsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const carryOverTasks = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: incompleteTasks } = await supabase
        .from('study_tasks')
        .select('*')
        .eq('is_completed', false)
        .lt('scheduled_date', today);

      if (incompleteTasks && incompleteTasks.length > 0) {
        for (const task of incompleteTasks) {
          await supabase.from('study_tasks').update({
            scheduled_date: today,
            carry_over_from: task.id,
          }).eq('id', task.id);
        }
        fetchData();
        toast({
          title: 'Tasks carried over',
          description: `${incompleteTasks.length} incomplete task(s) moved to today`,
        });
      }
    } catch (error) {
      console.error('Error carrying over tasks:', error);
    }
  };

  const handleTimerComplete = async () => {
    setIsRunning(false);
    
    if (timerMode === 'pomodoro') {
      setSessionsCompleted((prev) => prev + 1);
      try {
        await supabase.from('focus_sessions').insert({
          user_id: user!.id,
          duration_minutes: 25,
          mode: 'pomodoro',
        });
      } catch (error) {
        console.error('Error saving focus session:', error);
      }
      toast({
        title: '🎉 Focus session complete!',
        description: 'Great work! Take a break.',
      });
      setTimerMode('short');
      setTimeLeft(POMODORO_TIMES.short);
    } else {
      toast({
        title: 'Break over!',
        description: 'Ready for another focus session?',
      });
      setTimerMode('pomodoro');
      setTimeLeft(POMODORO_TIMES.pomodoro);
    }
  };

  const toggleTimer = () => setIsRunning(!isRunning);

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(POMODORO_TIMES[timerMode]);
  };

  const changeMode = (mode: PomodoroMode) => {
    setTimerMode(mode);
    setTimeLeft(POMODORO_TIMES[mode]);
    setIsRunning(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      const { error } = await supabase.from('study_tasks').insert({
        user_id: user!.id,
        title: newTask.title.trim(),
        subject_id: newTask.subject_id || null,
        scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
      });

      if (error) throw error;
      setNewTask({ title: '', subject_id: '' });
      setNewTaskDialog(false);
      fetchData();
      toast({ title: 'Task added!', description: 'Your study task has been scheduled' });
    } catch (error) {
      console.error('Error adding task:', error);
      toast({ title: 'Error', description: 'Failed to add task', variant: 'destructive' });
    }
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    try {
      await supabase.from('study_tasks').update({ is_completed: completed }).eq('id', taskId);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, is_completed: completed } : t))
      );
      if (completed) {
        toast({ title: '✅ Task completed!', description: 'Great job!' });
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await supabase.from('study_tasks').delete().eq('id', taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast({ title: 'Task deleted' });
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const getSubjectById = (id: string | null) => subjects.find((s) => s.id === id);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return addDays(start, i);
  });

  const tasksForDate = (date: Date) =>
    tasks.filter((t) => isSameDay(parseISO(t.scheduled_date), date));

  const todaysTasks = tasksForDate(new Date());
  const completedToday = todaysTasks.filter((t) => t.is_completed).length;
  const progressToday = todaysTasks.length > 0 ? (completedToday / todaysTasks.length) * 100 : 0;

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
        <div className="space-y-6 animate-fade-in pb-24 lg:pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Study Planner</h1>
              <p className="text-muted-foreground mt-1">Plan your day and stay focused</p>
            </div>
          </div>

          <Tabs defaultValue="tasks" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tasks" className="touch-manipulation">
                <CalendarIcon className="h-4 w-4 mr-2" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="focus" className="touch-manipulation">
                <Clock className="h-4 w-4 mr-2" />
                Focus Timer
              </TabsTrigger>
            </TabsList>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="space-y-4">
              {/* Today's Progress */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Today's Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Progress value={progressToday} className="flex-1 h-3" />
                    <span className="text-sm font-medium">
                      {completedToday}/{todaysTasks.length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Week Navigation */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => addDays(d, -7))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-medium">{format(selectedDate, 'MMMM yyyy')}</span>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => addDays(d, 7))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((day) => {
                      const dayTasks = tasksForDate(day);
                      const isSelected = isSameDay(day, selectedDate);
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            "flex flex-col items-center p-2 rounded-lg transition-all touch-manipulation",
                            isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                            isToday(day) && !isSelected && "ring-2 ring-primary"
                          )}
                        >
                          <span className="text-xs">{format(day, 'EEE')}</span>
                          <span className="text-lg font-medium">{format(day, 'd')}</span>
                          {dayTasks.length > 0 && (
                            <div className="flex gap-0.5 mt-1">
                              {dayTasks.slice(0, 3).map((_, i) => (
                                <div key={i} className={cn("h-1 w-1 rounded-full", isSelected ? "bg-primary-foreground" : "bg-primary")} />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Tasks for Selected Date */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{format(selectedDate, 'EEEE, MMMM d')}</CardTitle>
                    <CardDescription>{tasksForDate(selectedDate).length} task(s)</CardDescription>
                  </div>
                  <Dialog open={newTaskDialog} onOpenChange={setNewTaskDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Study Task</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Task</Label>
                          <Input
                            placeholder="What do you need to study?"
                            value={newTask.title}
                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Subject (optional)</Label>
                          <Select value={newTask.subject_id} onValueChange={(v) => setNewTask({ ...newTask, subject_id: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select subject" />
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
                        <Button onClick={addTask} className="w-full">Add Task</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {tasksForDate(selectedDate).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No tasks for this day</p>
                      <p className="text-sm">Add a task to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasksForDate(selectedDate).map((task) => {
                        const subject = getSubjectById(task.subject_id);
                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-all",
                              task.is_completed ? "bg-muted/50 opacity-60" : "bg-card"
                            )}
                          >
                            <button
                              onClick={() => toggleTask(task.id, !task.is_completed)}
                              className={cn(
                                "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all touch-manipulation",
                                task.is_completed
                                  ? "bg-success border-success text-success-foreground"
                                  : "border-muted-foreground hover:border-primary"
                              )}
                            >
                              {task.is_completed && <Check className="h-4 w-4" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={cn("font-medium truncate", task.is_completed && "line-through")}>
                                {task.title}
                              </p>
                              {subject && (
                                <Badge variant="outline" className="mt-1" style={{ borderColor: subject.color, color: subject.color }}>
                                  {subject.name}
                                </Badge>
                              )}
                              {task.carry_over_from && (
                                <Badge variant="secondary" className="ml-2 mt-1">Carried over</Badge>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Focus Timer Tab */}
            <TabsContent value="focus" className="space-y-4">
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="font-serif text-2xl">Focus Timer</CardTitle>
                  <CardDescription>
                    {sessionsCompleted} session{sessionsCompleted !== 1 ? 's' : ''} completed today
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Mode Selector */}
                  <div className="flex justify-center gap-2">
                    {[
                      { id: 'pomodoro' as PomodoroMode, label: 'Focus', time: '25:00' },
                      { id: 'short' as PomodoroMode, label: 'Short Break', time: '5:00' },
                      { id: 'long' as PomodoroMode, label: 'Long Break', time: '10:00' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => changeMode(mode.id)}
                        className={cn(
                          "px-4 py-2 rounded-lg font-medium text-sm transition-all touch-manipulation",
                          timerMode === mode.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  {/* Timer Display */}
                  <div className="relative flex justify-center">
                    <div className="relative">
                      <svg className="w-48 h-48 sm:w-64 sm:h-64 transform -rotate-90">
                        <circle
                          cx="50%"
                          cy="50%"
                          r="45%"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-muted"
                        />
                        <circle
                          cx="50%"
                          cy="50%"
                          r="45%"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={`${(timeLeft / POMODORO_TIMES[timerMode]) * 283} 283`}
                          strokeLinecap="round"
                          className="text-primary transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl sm:text-5xl font-bold font-mono">{formatTime(timeLeft)}</span>
                        <span className="text-sm text-muted-foreground capitalize">{timerMode === 'pomodoro' ? 'Focus Time' : 'Break Time'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex justify-center gap-4">
                    <Button variant="outline" size="icon" onClick={resetTimer} className="h-12 w-12">
                      <RotateCcw className="h-5 w-5" />
                    </Button>
                    <Button
                      onClick={toggleTimer}
                      className={cn("h-14 w-14 rounded-full", isRunning && "bg-destructive hover:bg-destructive/90")}
                    >
                      {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
                    </Button>
                  </div>

                  {/* Tips */}
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      💡 The Pomodoro Technique: 25 minutes of focused work, then a 5-minute break.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
