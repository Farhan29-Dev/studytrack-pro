import { useState, useEffect } from 'react';
import { Plus, Trash2, BookOpen, Folder, FileText, Check, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardLayout } from '@/components/DashboardLayout';
import { RequireAuth, useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Subject, Unit, Topic } from '@/types';
import { cn } from '@/lib/utils';

const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

type Step = 'subjects' | 'units' | 'topics' | 'complete';

export default function Setup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('subjects');

  // Form data
  const [subjects, setSubjects] = useState<Array<{ name: string; color: string }>>([
    { name: '', color: COLORS[0] },
  ]);
  const [savedSubjects, setSavedSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [units, setUnits] = useState<Array<{ name: string }>>([{ name: '' }]);
  const [savedUnits, setSavedUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [topics, setTopics] = useState<Array<{ name: string }>>([{ name: '' }]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchExistingData();
    }
  }, [user]);

  const fetchExistingData = async () => {
    try {
      const { data: existingSubjects } = await supabase
        .from('subjects')
        .select('*')
        .order('created_at', { ascending: true });

      if (existingSubjects && existingSubjects.length > 0) {
        setSavedSubjects(existingSubjects);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const addSubjectRow = () => {
    setSubjects([...subjects, { name: '', color: COLORS[subjects.length % COLORS.length] }]);
  };

  const removeSubjectRow = (index: number) => {
    if (subjects.length > 1) {
      setSubjects(subjects.filter((_, i) => i !== index));
    }
  };

  const updateSubject = (index: number, field: 'name' | 'color', value: string) => {
    const updated = [...subjects];
    updated[index][field] = value;
    setSubjects(updated);
  };

  const saveSubjects = async () => {
    const validSubjects = subjects.filter((s) => s.name.trim());
    if (validSubjects.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one subject',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subjects')
        .insert(
          validSubjects.map((s) => ({
            user_id: user!.id,
            name: s.name.trim(),
            color: s.color,
          }))
        )
        .select();

      if (error) throw error;

      setSavedSubjects((prev) => [...prev, ...(data || [])]);
      setSubjects([{ name: '', color: COLORS[0] }]);
      setStep('units');

      toast({
        title: 'Subjects saved',
        description: `${validSubjects.length} subject(s) added successfully`,
      });
    } catch (error) {
      console.error('Error saving subjects:', error);
      toast({
        title: 'Error',
        description: 'Failed to save subjects',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addUnitRow = () => {
    setUnits([...units, { name: '' }]);
  };

  const removeUnitRow = (index: number) => {
    if (units.length > 1) {
      setUnits(units.filter((_, i) => i !== index));
    }
  };

  const saveUnits = async () => {
    if (!selectedSubject) {
      toast({
        title: 'Error',
        description: 'Please select a subject first',
        variant: 'destructive',
      });
      return;
    }

    const validUnits = units.filter((u) => u.name.trim());
    if (validUnits.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one unit',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('units')
        .insert(
          validUnits.map((u, index) => ({
            subject_id: selectedSubject.id,
            name: u.name.trim(),
            sort_order: index,
          }))
        )
        .select();

      if (error) throw error;

      setSavedUnits((prev) => [...prev, ...(data || [])]);
      setUnits([{ name: '' }]);
      setStep('topics');

      toast({
        title: 'Units saved',
        description: `${validUnits.length} unit(s) added successfully`,
      });
    } catch (error) {
      console.error('Error saving units:', error);
      toast({
        title: 'Error',
        description: 'Failed to save units',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addTopicRow = () => {
    setTopics([...topics, { name: '' }]);
  };

  const removeTopicRow = (index: number) => {
    if (topics.length > 1) {
      setTopics(topics.filter((_, i) => i !== index));
    }
  };

  const saveTopics = async () => {
    if (!selectedUnit) {
      toast({
        title: 'Error',
        description: 'Please select a unit first',
        variant: 'destructive',
      });
      return;
    }

    const validTopics = topics.filter((t) => t.name.trim());
    if (validTopics.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one topic',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('topics').insert(
        validTopics.map((t, index) => ({
          unit_id: selectedUnit.id,
          name: t.name.trim(),
          sort_order: index,
          difficulty: 'medium',
        }))
      );

      if (error) throw error;

      setTopics([{ name: '' }]);
      setStep('complete');

      toast({
        title: 'Topics saved',
        description: `${validTopics.length} topic(s) added successfully`,
      });
    } catch (error) {
      console.error('Error saving topics:', error);
      toast({
        title: 'Error',
        description: 'Failed to save topics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectSubjectForUnits = async (subject: Subject) => {
    setSelectedSubject(subject);
    const { data } = await supabase
      .from('units')
      .select('*')
      .eq('subject_id', subject.id)
      .order('sort_order', { ascending: true });

    setSavedUnits(data || []);
  };

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center">
            <h1 className="font-serif text-3xl font-bold text-foreground">Setup Wizard</h1>
            <p className="text-muted-foreground mt-1">Build your study syllabus step by step</p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2">
            {(['subjects', 'units', 'topics', 'complete'] as Step[]).map((s, idx) => (
              <div key={s} className="flex items-center">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    step === s
                      ? 'bg-primary text-primary-foreground'
                      : ['subjects', 'units', 'topics', 'complete'].indexOf(step) > idx
                      ? 'bg-success text-success-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {['subjects', 'units', 'topics', 'complete'].indexOf(step) > idx ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < 3 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />}
              </div>
            ))}
          </div>

          {/* Step Content */}
          {step === 'subjects' && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle>Add Subjects</CardTitle>
                    <CardDescription>Create your main study subjects</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {subjects.map((subject, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Input
                      placeholder="Subject name (e.g., Mathematics)"
                      value={subject.name}
                      onChange={(e) => updateSubject(index, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <div className="flex gap-1">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateSubject(index, 'color', color)}
                          className={cn(
                            'h-6 w-6 rounded-full transition-transform',
                            subject.color === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSubjectRow(index)}
                      disabled={subjects.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addSubjectRow} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Another Subject
                </Button>
                <Button onClick={saveSubjects} className="w-full" disabled={loading}>
                  {loading ? 'Saving...' : 'Save & Continue'}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 'units' && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
                    <Folder className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle>Add Units</CardTitle>
                    <CardDescription>Organize your subjects into units</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Subject</Label>
                  <div className="flex flex-wrap gap-2">
                    {savedSubjects.map((subject) => (
                      <Button
                        key={subject.id}
                        variant={selectedSubject?.id === subject.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => selectSubjectForUnits(subject)}
                        style={
                          selectedSubject?.id === subject.id
                            ? { backgroundColor: subject.color }
                            : { borderColor: subject.color, color: subject.color }
                        }
                      >
                        {subject.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedSubject && (
                  <>
                    {units.map((unit, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <Input
                          placeholder="Unit name (e.g., Calculus)"
                          value={unit.name}
                          onChange={(e) => {
                            const updated = [...units];
                            updated[index].name = e.target.value;
                            setUnits(updated);
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeUnitRow(index)}
                          disabled={units.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" onClick={addUnitRow} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Another Unit
                    </Button>
                  </>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('subjects')} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={saveUnits} className="flex-1" disabled={loading || !selectedSubject}>
                    {loading ? 'Saving...' : 'Save & Continue'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'topics' && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle>Add Topics</CardTitle>
                    <CardDescription>Break down units into topics</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Unit</Label>
                  <div className="flex flex-wrap gap-2">
                    {savedUnits.map((unit) => (
                      <Button
                        key={unit.id}
                        variant={selectedUnit?.id === unit.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedUnit(unit)}
                      >
                        {unit.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedUnit && (
                  <>
                    {topics.map((topic, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <Input
                          placeholder="Topic name (e.g., Derivatives)"
                          value={topic.name}
                          onChange={(e) => {
                            const updated = [...topics];
                            updated[index].name = e.target.value;
                            setTopics(updated);
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTopicRow(index)}
                          disabled={topics.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" onClick={addTopicRow} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Another Topic
                    </Button>
                  </>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('units')} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={saveTopics} className="flex-1" disabled={loading || !selectedUnit}>
                    {loading ? 'Saving...' : 'Save & Finish'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'complete' && (
            <Card className="text-center p-8">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="font-serif text-2xl mb-2">Setup Complete!</CardTitle>
              <CardDescription className="mb-6">
                Your syllabus is ready. Start tracking your progress!
              </CardDescription>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setStep('subjects')}>
                  Add More
                </Button>
                <Button asChild>
                  <a href="/syllabus">View Syllabus</a>
                </Button>
              </div>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
