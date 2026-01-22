import { useEffect, useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Folder, FileText, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<{ type: 'subject' | 'unit' | 'topic'; id: string; name: string } | null>(null);
  

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

      // Update state locally without refetching
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

      // Update subject progress in the background (don't refetch)
      updateSubjectProgress();
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
    // Calculate and update progress for each subject in the database only
    // Don't refetch - just update the database in background
    for (const subject of subjects) {
      const totalTopics = subject.units.reduce((acc, unit) => acc + unit.topics.length, 0);
      const completedTopics = subject.units.reduce(
        (acc, unit) => acc + unit.topics.filter((t) => t.is_completed).length,
        0
      );
      const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      await supabase.from('subjects').update({ progress }).eq('id', subject.id);
    }
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

  const deleteUnit = async (unitId: string) => {
    try {
      // First delete all topics in this unit
      const { error: topicsError } = await supabase.from('topics').delete().eq('unit_id', unitId);
      if (topicsError) throw topicsError;

      // Then delete the unit itself
      const { error: unitError } = await supabase.from('units').delete().eq('id', unitId);
      if (unitError) throw unitError;

      fetchSyllabus();
      toast({
        title: 'Unit deleted',
        description: 'Unit and all its topics have been removed',
      });
    } catch (error) {
      console.error('Error deleting unit:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete unit',
        variant: 'destructive',
      });
    }
  };

  const deleteSubject = async (subjectId: string) => {
    try {
      // Get all units for this subject
      const { data: unitsData } = await supabase.from('units').select('id').eq('subject_id', subjectId);
      
      if (unitsData && unitsData.length > 0) {
        const unitIds = unitsData.map(u => u.id);
        // Delete all topics in these units
        const { error: topicsError } = await supabase.from('topics').delete().in('unit_id', unitIds);
        if (topicsError) throw topicsError;

        // Delete all units
        const { error: unitsError } = await supabase.from('units').delete().eq('subject_id', subjectId);
        if (unitsError) throw unitsError;
      }

      // Delete the subject
      const { error: subjectError } = await supabase.from('subjects').delete().eq('id', subjectId);
      if (subjectError) throw subjectError;

      fetchSyllabus();
      toast({
        title: 'Subject deleted',
        description: 'Subject and all its content have been removed',
      });
    } catch (error) {
      console.error('Error deleting subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete subject',
        variant: 'destructive',
      });
    }
  };

  const resetSyllabus = async () => {
    try {
      // Get all subjects for this user
      const { data: subjectsData } = await supabase.from('subjects').select('id');
      
      if (subjectsData && subjectsData.length > 0) {
        const subjectIds = subjectsData.map(s => s.id);
        
        // Get all units for these subjects
        const { data: unitsData } = await supabase.from('units').select('id').in('subject_id', subjectIds);
        
        if (unitsData && unitsData.length > 0) {
          const unitIds = unitsData.map(u => u.id);
          // Delete all topics
          await supabase.from('topics').delete().in('unit_id', unitIds);
        }
        
        // Delete all units
        await supabase.from('units').delete().in('subject_id', subjectIds);
        
        // Delete all subjects
        await supabase.from('subjects').delete().in('id', subjectIds);
      }

      setSubjects([]);
      setResetDialogOpen(false);
      toast({
        title: 'Syllabus reset',
        description: 'All subjects, units, and topics have been removed',
      });
    } catch (error) {
      console.error('Error resetting syllabus:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset syllabus',
        variant: 'destructive',
      });
    }
  };

  const saveEditItem = async () => {
    if (!editingItem || !editingItem.name.trim()) return;

    try {
      if (editingItem.type === 'subject') {
        await supabase.from('subjects').update({ name: editingItem.name.trim() }).eq('id', editingItem.id);
      } else if (editingItem.type === 'unit') {
        await supabase.from('units').update({ name: editingItem.name.trim() }).eq('id', editingItem.id);
      } else if (editingItem.type === 'topic') {
        await supabase.from('topics').update({ name: editingItem.name.trim() }).eq('id', editingItem.id);
      }

      setEditingItem(null);
      fetchSyllabus();
      toast({
        title: 'Updated',
        description: `${editingItem.type.charAt(0).toUpperCase() + editingItem.type.slice(1)} name updated`,
      });
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update',
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
            {subjects.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {isEditMode ? 'Done Editing' : 'Edit Syllabus'}
                </Button>
                <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset Syllabus
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Entire Syllabus?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete ALL subjects, units, and topics. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={resetSyllabus} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Reset Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Edit Dialog */}
          <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit {editingItem?.type}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editingItem?.name || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Enter name..."
                  />
                </div>
                <Button onClick={saveEditItem} className="w-full">
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={(open) => {
                        setExpandedSubjects((prev) => {
                          const next = new Set(prev);
                          if (open) next.add(subject.id);
                          else next.delete(subject.id);
                          return next;
                        });
                      }}
                    >
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
                            <div className="flex items-center gap-2">
                              <ProgressRing
                                progress={subject.progress}
                                size={50}
                                strokeWidth={4}
                                showLabel={false}
                                color={subject.color}
                              />
                              {isEditMode && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingItem({ type: 'subject', id: subject.id, name: subject.name });
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {isEditMode && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Subject?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete "{subject.name}" and all its units and topics.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteSubject(subject.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
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
                                    onOpenChange={(open) => {
                                      setExpandedUnits((prev) => {
                                        const next = new Set(prev);
                                        if (open) next.add(unit.id);
                                        else next.delete(unit.id);
                                        return next;
                                      });
                                    }}
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
                                        {isEditMode && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingItem({ type: 'unit', id: unit.id, name: unit.name });
                                            }}
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                        {isEditMode && (
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Unit?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  This will permanently delete "{unit.name}" and all its topics.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() => deleteUnit(unit.id)}
                                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                  Delete
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        )}
                                      </div>
                                    </CollapsibleTrigger>

                                    <CollapsibleContent>
                                      <div className="ml-12 space-y-2 mt-2">
                                        {unit.topics.map((topic) => (
                                          <TopicCard
                                            key={topic.id}
                                            topic={topic}
                                            onToggleComplete={toggleTopicComplete}
                                            onDelete={isEditMode ? deleteTopic : undefined}
                                            onEdit={isEditMode ? (id, name) => setEditingItem({ type: 'topic', id, name }) : undefined}
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
