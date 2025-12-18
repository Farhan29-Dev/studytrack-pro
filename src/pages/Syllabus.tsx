import { useEffect, useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Folder, FileText, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DashboardLayout } from '@/components/DashboardLayout';
import { TopicCard } from '@/components/TopicCard';
import { ProgressRing } from '@/components/ProgressRing';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Subject, Unit, Topic, SubjectWithUnits } from '@/types';
import { cn } from '@/lib/utils';

export default function Syllabus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<SubjectWithUnits[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [newTopicDialog, setNewTopicDialog] = useState<{ unitId: string; open: boolean } | null>(null);
  const [newTopicName, setNewTopicName] = useState('');

  useEffect(() => {
    if (user) {
      fetchSyllabus();
    }
  }, [user]);

  const fetchSyllabus = async () => {
    try {
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .order('created_at', { ascending: true });

      if (subjectsError) throw subjectsError;
      if (!subjectsData) return;

      const subjectsWithUnits: SubjectWithUnits[] = await Promise.all(
        subjectsData.map(async (subject) => {
          const { data: unitsData } = await supabase
            .from('units')
            .select('*')
            .eq('subject_id', subject.id)
            .order('sort_order', { ascending: true });

          const unitsWithTopics = await Promise.all(
            (unitsData || []).map(async (unit) => {
              const { data: topicsData } = await supabase
                .from('topics')
                .select('*')
                .eq('unit_id', unit.id)
                .order('sort_order', { ascending: true });

              return {
                ...unit,
                topics: (topicsData || []) as unknown as Topic[],
              };
            })
          );

          return {
            ...subject,
            units: unitsWithTopics,
          };
        })
      );

      setSubjects(subjectsWithUnits);
      // Auto-expand first subject
      if (subjectsWithUnits.length > 0) {
        setExpandedSubjects(new Set([subjectsWithUnits[0].id]));
      }
    } catch (error) {
      console.error('Error fetching syllabus:', error);
      toast({
        title: 'Error',
        description: 'Failed to load syllabus',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTopicComplete = async (topicId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('topics')
        .update({ is_completed: completed })
        .eq('id', topicId);

      if (error) throw error;

      setSubjects((prev) =>
        prev.map((subject) => ({
          ...subject,
          units: subject.units.map((unit) => ({
            ...unit,
            topics: unit.topics.map((topic) =>
              topic.id === topicId ? { ...topic, is_completed: completed } : topic
            ),
          })),
        }))
      );

      // Update subject progress
      await updateSubjectProgress();

      toast({
        title: completed ? 'Topic completed!' : 'Topic marked incomplete',
        description: completed ? 'Great progress!' : 'Keep studying!',
      });
    } catch (error) {
      console.error('Error updating topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to update topic',
        variant: 'destructive',
      });
    }
  };

  const updateSubjectProgress = async () => {
    for (const subject of subjects) {
      const totalTopics = subject.units.reduce((acc, unit) => acc + unit.topics.length, 0);
      const completedTopics = subject.units.reduce(
        (acc, unit) => acc + unit.topics.filter((t) => t.is_completed).length,
        0
      );
      const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      await supabase.from('subjects').update({ progress }).eq('id', subject.id);
    }
    fetchSyllabus();
  };

  const addTopic = async () => {
    if (!newTopicDialog || !newTopicName.trim()) return;

    try {
      const { error } = await supabase.from('topics').insert({
        unit_id: newTopicDialog.unitId,
        name: newTopicName.trim(),
        difficulty: 'medium',
      });

      if (error) throw error;

      setNewTopicName('');
      setNewTopicDialog(null);
      fetchSyllabus();

      toast({
        title: 'Topic added',
        description: 'New topic has been added to the syllabus',
      });
    } catch (error) {
      console.error('Error adding topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to add topic',
        variant: 'destructive',
      });
    }
  };

  const deleteTopic = async (topicId: string) => {
    try {
      const { error } = await supabase.from('topics').delete().eq('id', topicId);
      if (error) throw error;

      fetchSyllabus();
      toast({
        title: 'Topic deleted',
        description: 'Topic has been removed from the syllabus',
      });
    } catch (error) {
      console.error('Error deleting topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete topic',
        variant: 'destructive',
      });
    }
  };

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
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

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground">Interactive Syllabus</h1>
              <p className="text-muted-foreground mt-1">Organize and track your study materials</p>
            </div>
          </div>

          {subjects.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-serif text-xl font-semibold mb-2">No subjects yet</h3>
              <p className="text-muted-foreground mb-4">
                Head to the Setup page to add your first subject
              </p>
              <Button asChild>
                <a href="/setup">Go to Setup</a>
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {subjects.map((subject) => {
                const isExpanded = expandedSubjects.has(subject.id);
                const totalTopics = subject.units.reduce((acc, unit) => acc + unit.topics.length, 0);
                const completedTopics = subject.units.reduce(
                  (acc, unit) => acc + unit.topics.filter((t) => t.is_completed).length,
                  0
                );

                return (
                  <Card key={subject.id} className="overflow-hidden">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleSubject(subject.id)}>
                      <CollapsibleTrigger asChild>
                        <CardHeader
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          style={{ borderLeft: `4px solid ${subject.color}` }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                              <div
                                className="h-10 w-10 rounded-lg flex items-center justify-center text-primary-foreground font-semibold"
                                style={{ backgroundColor: subject.color }}
                              >
                                {subject.name.charAt(0)}
                              </div>
                              <div>
                                <CardTitle className="font-serif text-xl">{subject.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  {completedTopics}/{totalTopics} topics completed
                                </p>
                              </div>
                            </div>
                            <ProgressRing
                              progress={subject.progress}
                              size={50}
                              strokeWidth={4}
                              showLabel={false}
                              color={subject.color}
                            />
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          {subject.units.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">
                              No units in this subject yet
                            </p>
                          ) : (
                            <div className="space-y-4 pl-8">
                              {subject.units.map((unit) => {
                                const isUnitExpanded = expandedUnits.has(unit.id);
                                const unitCompleted = unit.topics.filter((t) => t.is_completed).length;

                                return (
                                  <Collapsible
                                    key={unit.id}
                                    open={isUnitExpanded}
                                    onOpenChange={() => toggleUnit(unit.id)}
                                  >
                                    <CollapsibleTrigger asChild>
                                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                                        {isUnitExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <Folder className="h-5 w-5 text-primary" />
                                        <div className="flex-1">
                                          <p className="font-medium">{unit.name}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {unitCompleted}/{unit.topics.length} completed
                                          </p>
                                        </div>
                                      </div>
                                    </CollapsibleTrigger>

                                    <CollapsibleContent>
                                      <div className="ml-12 space-y-2 mt-2">
                                        {unit.topics.map((topic) => (
                                          <TopicCard
                                            key={topic.id}
                                            topic={topic}
                                            onToggleComplete={toggleTopicComplete}
                                            onDelete={deleteTopic}
                                            subjectColor={subject.color}
                                          />
                                        ))}

                                        <Dialog
                                          open={newTopicDialog?.unitId === unit.id && newTopicDialog?.open}
                                          onOpenChange={(open) =>
                                            setNewTopicDialog(open ? { unitId: unit.id, open } : null)
                                          }
                                        >
                                          <DialogTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="w-full justify-start text-muted-foreground"
                                            >
                                              <Plus className="mr-2 h-4 w-4" />
                                              Add topic
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent>
                                            <DialogHeader>
                                              <DialogTitle>Add New Topic</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                              <div className="space-y-2">
                                                <Label htmlFor="topic-name">Topic Name</Label>
                                                <Input
                                                  id="topic-name"
                                                  value={newTopicName}
                                                  onChange={(e) => setNewTopicName(e.target.value)}
                                                  placeholder="Enter topic name..."
                                                />
                                              </div>
                                              <Button onClick={addTopic} className="w-full">
                                                Add Topic
                                              </Button>
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
