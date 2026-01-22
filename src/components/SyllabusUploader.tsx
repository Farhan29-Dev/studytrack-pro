import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, X, Check, Edit2, HelpCircle, ChevronDown, ChevronRight, BookOpen, Folder, FileQuestion } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { extractTextFromPDF } from '@/lib/pdf-parser';

interface ParsedTopic {
  name: string;
}

interface ParsedUnit {
  name: string;
  topics: string[];
}

interface ParsedSubject {
  name: string;
  color: string;
  units: ParsedUnit[];
}

interface ParsedData {
  subjects: ParsedSubject[];
}

interface SyllabusUploaderProps {
  onComplete: (data: ParsedData) => void;
  onCancel: () => void;
}

export function SyllabusUploader({ onComplete, onCancel }: SyllabusUploaderProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [editingItem, setEditingItem] = useState<{ type: string; indices: number[]; value: string } | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or Word document',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setParsedData(null);
  }, [toast]);

  const parseFile = async () => {
    if (!file) return;

    setUploading(true);
    try {
      let fileContent: string;
      
      // Use PDF.js for PDFs for accurate text extraction
      if (file.type === 'application/pdf') {
        console.log('Extracting text from PDF using PDF.js...');
        fileContent = await extractTextFromPDF(file);
        console.log('Extracted PDF text:', fileContent.substring(0, 500) + '...');
      } else {
        // For Word docs, read as text
        fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
              resolve(result);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      }

      const { data, error } = await supabase.functions.invoke('parse-syllabus', {
        body: {
          fileContent,
          fileName: file.name,
          fileType: file.type,
        },
      });

      if (error) throw error;

      if (data.success && data.data) {
        setParsedData(data.data);
        toast({
          title: 'Syllabus parsed',
          description: `Found ${data.data.subjects?.length || 0} subjects`,
        });
      } else {
        throw new Error(data.error || 'Failed to parse syllabus');
      }
    } catch (error) {
      console.error('Error parsing syllabus:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to parse syllabus',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (type: string, indices: number[], currentValue: string) => {
    setEditingItem({ type, indices, value: currentValue });
  };

  const saveEdit = () => {
    if (!editingItem || !parsedData) return;

    const newData = JSON.parse(JSON.stringify(parsedData)) as ParsedData;
    const [subjectIdx, unitIdx, topicIdx] = editingItem.indices;

    if (editingItem.type === 'subject') {
      newData.subjects[subjectIdx].name = editingItem.value;
    } else if (editingItem.type === 'unit') {
      newData.subjects[subjectIdx].units[unitIdx].name = editingItem.value;
    } else if (editingItem.type === 'topic') {
      newData.subjects[subjectIdx].units[unitIdx].topics[topicIdx] = editingItem.value;
    }

    setParsedData(newData);
    setEditingItem(null);
  };

  const removeItem = (type: string, indices: number[]) => {
    if (!parsedData) return;

    const newData = JSON.parse(JSON.stringify(parsedData)) as ParsedData;
    const [subjectIdx, unitIdx, topicIdx] = indices;

    if (type === 'subject') {
      newData.subjects.splice(subjectIdx, 1);
    } else if (type === 'unit') {
      newData.subjects[subjectIdx].units.splice(unitIdx, 1);
    } else if (type === 'topic') {
      newData.subjects[subjectIdx].units[unitIdx].topics.splice(topicIdx, 1);
    }

    setParsedData(newData);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
            <Upload className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle>Upload Syllabus</CardTitle>
            <CardDescription>Upload PDF or Word document to auto-extract subjects, units, and topics</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instructions Panel */}
        <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Syllabus Format Instructions
              </span>
              {showInstructions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-4 text-sm">
              <div>
                <h4 className="font-semibold flex items-center gap-2 text-primary mb-2">
                  <FileQuestion className="h-4 w-4" />
                  Recommended Syllabus Format
                </h4>
                <p className="text-muted-foreground mb-3">
                  For best parsing accuracy, structure your syllabus document as follows:
                </p>
              </div>

              <div className="space-y-3">
                <div className="bg-background rounded-lg p-3 border">
                  <div className="flex items-center gap-2 font-medium mb-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Subject Level
                  </div>
                  <p className="text-muted-foreground text-xs mb-2">
                    Start with the subject/course name at the top of the document:
                  </p>
                  <code className="block bg-muted p-2 rounded text-xs font-mono">
                    <span className="text-primary">Subject:</span> Mathematics<br />
                    <span className="text-muted-foreground">or</span><br />
                    <span className="text-primary">Course Name:</span> Computer Science
                  </code>
                </div>

                <div className="bg-background rounded-lg p-3 border">
                  <div className="flex items-center gap-2 font-medium mb-2">
                    <Folder className="h-4 w-4 text-primary" />
                    Unit Level
                  </div>
                  <p className="text-muted-foreground text-xs mb-2">
                    Format units with clear numbering and titles:
                  </p>
                  <code className="block bg-muted p-2 rounded text-xs font-mono">
                    <span className="text-primary">UNIT – I:</span> Introduction to Programming<br />
                    <span className="text-primary">UNIT – II:</span> Data Structures<br />
                    <span className="text-muted-foreground">or</span><br />
                    <span className="text-primary">Unit 1:</span> Algebra Basics<br />
                    <span className="text-primary">Module 2:</span> Linear Equations
                  </code>
                </div>

                <div className="bg-background rounded-lg p-3 border">
                  <div className="flex items-center gap-2 font-medium mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Topics Level
                  </div>
                  <p className="text-muted-foreground text-xs mb-2">
                    List topics as comma-separated items or bullet points under each unit:
                  </p>
                  <code className="block bg-muted p-2 rounded text-xs font-mono">
                    <span className="text-muted-foreground"># Comma-separated (preferred):</span><br />
                    Variables, Data Types, Operators, Control Flow, Functions<br /><br />
                    <span className="text-muted-foreground"># Or as bullet points:</span><br />
                    • Variables and Constants<br />
                    • Data Types<br />
                    • Operators
                  </code>
                </div>
              </div>

              <div className="border-t pt-4">
                <h5 className="font-medium text-destructive mb-2">⚠️ What to Avoid</h5>
                <ul className="text-muted-foreground text-xs space-y-1 list-disc list-inside">
                  <li>Hour notations like <code className="bg-muted px-1 rounded">[7Hrs.]</code> or <code className="bg-muted px-1 rounded">(8 Hours)</code></li>
                  <li>Course outcome markers like <code className="bg-muted px-1 rounded">CO1, CO2</code></li>
                  <li>Learning objectives sections</li>
                  <li>Reference book lists</li>
                  <li>Page numbers and headers/footers</li>
                </ul>
              </div>

              <div className="border-t pt-4">
                <h5 className="font-medium text-success mb-2">✓ Example Structure</h5>
                <div className="bg-background rounded-lg p-3 border font-mono text-xs">
                  <div className="text-primary font-bold">Subject: Data Structures and Algorithms</div>
                  <br />
                  <div className="text-primary">UNIT – I: Introduction to Data Structures</div>
                  <div className="pl-4 text-muted-foreground">
                    Arrays, Linked Lists, Stacks, Queues, Introduction to Time Complexity
                  </div>
                  <br />
                  <div className="text-primary">UNIT – II: Trees and Graphs</div>
                  <div className="pl-4 text-muted-foreground">
                    Binary Trees, BST, AVL Trees, Graph Representation, BFS, DFS
                  </div>
                  <br />
                  <div className="text-primary">UNIT – III: Sorting and Searching</div>
                  <div className="pl-4 text-muted-foreground">
                    Bubble Sort, Quick Sort, Merge Sort, Binary Search, Hash Tables
                  </div>
                </div>
              </div>

              <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                <p className="text-xs">
                  <strong>💡 Pro Tip:</strong> After parsing, you can edit any incorrectly extracted subjects, units, or topics before saving. Click on any item to edit it or use the × button to remove unwanted entries.
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {!parsedData ? (
          <>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="syllabus-upload"
              />
              <label htmlFor="syllabus-upload" className="cursor-pointer">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {file ? file.name : 'Click to upload PDF or Word file'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports: PDF, DOC, DOCX
                </p>
              </label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
              <Button onClick={parseFile} className="flex-1" disabled={!file || uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  'Parse Syllabus'
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto space-y-4">
              {parsedData.subjects.map((subject, subjectIdx) => (
                <div key={subjectIdx} className="border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-4 w-4 rounded"
                      style={{ backgroundColor: subject.color }}
                    />
                    {editingItem?.type === 'subject' && editingItem.indices[0] === subjectIdx ? (
                      <Input
                        value={editingItem.value}
                        onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                        onBlur={saveEdit}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        className="h-8"
                        autoFocus
                      />
                    ) : (
                      <>
                        <span className="font-semibold flex-1">{subject.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleEdit('subject', [subjectIdx], subject.name)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeItem('subject', [subjectIdx])}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>

                  {subject.units.map((unit, unitIdx) => (
                    <div key={unitIdx} className="ml-4 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        {editingItem?.type === 'unit' && 
                         editingItem.indices[0] === subjectIdx && 
                         editingItem.indices[1] === unitIdx ? (
                          <Input
                            value={editingItem.value}
                            onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            className="h-7 text-sm"
                            autoFocus
                          />
                        ) : (
                          <>
                            <Badge variant="secondary" className="flex-1 justify-start">
                              {unit.name}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleEdit('unit', [subjectIdx, unitIdx], unit.name)}
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-destructive"
                              onClick={() => removeItem('unit', [subjectIdx, unitIdx])}
                            >
                              <X className="h-2.5 w-2.5" />
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="ml-4 flex flex-wrap gap-1">
                        {unit.topics.map((topic, topicIdx) => (
                          <div key={topicIdx} className="flex items-center gap-1">
                            {editingItem?.type === 'topic' && 
                             editingItem.indices[0] === subjectIdx && 
                             editingItem.indices[1] === unitIdx &&
                             editingItem.indices[2] === topicIdx ? (
                              <Input
                                value={editingItem.value}
                                onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                                onBlur={saveEdit}
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                className="h-6 text-xs w-48"
                                autoFocus
                              />
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs cursor-pointer hover:bg-muted group"
                              >
                                <span 
                                  onClick={() => handleEdit('topic', [subjectIdx, unitIdx, topicIdx], topic)}
                                  className="mr-1"
                                >
                                  {topic}
                                </span>
                                <X
                                  className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeItem('topic', [subjectIdx, unitIdx, topicIdx]);
                                  }}
                                />
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => { setParsedData(null); setFile(null); }} className="flex-1">
                Upload Different File
              </Button>
              <Button onClick={() => onComplete(parsedData)} className="flex-1">
                <Check className="mr-2 h-4 w-4" />
                Save Syllabus
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
