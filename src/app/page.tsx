"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronRight, TrendingUp, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Subject, Assignment, SubjectType, calculatePercentage, getGrade, calculateRawPercent, percentToIBGrade, parseRawGrade, calculatePredictedGrade } from "@/lib/types";

export default function Home() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(true);
  const [showTrends, setShowTrends] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem("ib-grades");
    if (saved) {
      const loadedSubjects = JSON.parse(saved);

      // Migrate old assignments to new format
      const migratedSubjects = loadedSubjects.map((subject: Subject) => ({
        ...subject,
        assignments: subject.assignments.map((assignment: any) => {
          // If assignment doesn't have ibGrade, calculate it from existing data
          if (assignment.ibGrade === undefined) {
            let calculatedGrade = 4; // Default grade

            // Try to calculate from rawPercent
            if (assignment.rawPercent !== undefined) {
              calculatedGrade = percentToIBGrade(assignment.rawPercent, subject.type);
            }
            // Try to calculate from score/total (old format)
            else if (assignment.score !== undefined && assignment.total !== undefined) {
              const percent = calculateRawPercent(assignment.score, assignment.total);
              calculatedGrade = percentToIBGrade(percent, subject.type);
              // Migrate to new rawGrade format
              return {
                id: assignment.id,
                name: assignment.name,
                ibGrade: calculatedGrade,
                rawGrade: `${assignment.score}/${assignment.total}`,
                rawPercent: percent,
                date: assignment.date,
              };
            }

            return {
              ...assignment,
              ibGrade: calculatedGrade,
            };
          }
          return assignment;
        }),
      }));

      setSubjects(migratedSubjects);
      // Only show main page if we have exactly 6 subjects
      if (migratedSubjects.length === 6) {
        setIsOnboarding(false);
      }
    }
  }, []);

  // Save to local storage whenever subjects change
  useEffect(() => {
    if (isClient) {
      localStorage.setItem("ib-grades", JSON.stringify(subjects));
      // Auto-complete onboarding when 6 subjects are added
      if (subjects.length === 6) {
        setIsOnboarding(false);
      }
    }
  }, [subjects, isClient]);

  const addSubject = (name: string, type: SubjectType) => {
    const newSubject: Subject = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type,
      assignments: [],
    };
    setSubjects([...subjects, newSubject]);
  };

  const addAssignment = (subjectId: string, assignment: Omit<Assignment, 'id'>) => {
    setSubjects(subjects.map(sub => {
      if (sub.id === subjectId) {
        return {
          ...sub,
          assignments: [
            ...sub.assignments,
            {
              ...assignment,
              id: Math.random().toString(36).substr(2, 9),
            }
          ]
        };
      }
      return sub;
    }));
  };

  const updateAssignment = (subjectId: string, assignmentId: string, updatedAssignment: Omit<Assignment, 'id'>) => {
    setSubjects(subjects.map(sub => {
      if (sub.id === subjectId) {
        return {
          ...sub,
          assignments: sub.assignments.map(a =>
            a.id === assignmentId
              ? { ...a, ...updatedAssignment }
              : a
          )
        };
      }
      return sub;
    }));
  };

  const deleteAssignment = (subjectId: string, assignmentId: string) => {
    setSubjects(subjects.map(sub => {
      if (sub.id === subjectId) {
        return {
          ...sub,
          assignments: sub.assignments.filter(a => a.id !== assignmentId)
        };
      }
      return sub;
    }));
  };

  // Calculate total predicted grade (out of 42)
  const totalPredicted = subjects.reduce((total, subject) => {
    if (subject.assignments.length === 0) return total; // Skip subjects with no assignments
    const grade = calculatePredictedGrade(subject.assignments);
    return total + grade;
  }, 0);

  // Determine color for total predicted grade
  const getTotalColor = (total: number) => {
    const avg = total / 6;
    if (avg >= 7) return 'from-green-600 via-green-500 to-green-400';
    if (avg >= 6) return 'from-green-500 via-lime-500 to-yellow-500';
    if (avg >= 5) return 'from-yellow-600 via-yellow-500 to-yellow-400';
    if (avg >= 4) return 'from-yellow-500 via-orange-500 to-red-500';
    if (avg >= 3) return 'from-red-600 via-red-500 to-red-400';
    return 'from-gray-600 via-gray-500 to-gray-400';
  };

  if (!isClient) return null;

  // Onboarding view
  if (isOnboarding) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">IB Grade Tracker</h1>
            <p className="text-muted-foreground">Set up your 6 subjects to get started</p>
          </div>

          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => {
              const subject = subjects[index];
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {index + 1}
                  </div>
                  {subject ? (
                    <div className="flex-1 flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                      <div>
                        <p className="font-medium">{subject.name}</p>
                        <p className="text-xs text-muted-foreground">{subject.type}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setSubjects(subjects.filter(s => s.id !== subject.id));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <SetupSubjectDialog onAdd={addSubject} subjectNumber={index + 1} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {subjects.length === 6 && (
            <Button className="w-full" size="lg" onClick={() => setIsOnboarding(false)}>
              Continue to Dashboard
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Trends view
  if (showTrends) {
    return <TrendsView subjects={subjects} onBack={() => setShowTrends(false)} />;
  }

  // Main dashboard view
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <h1 className="font-bold text-2xl tracking-tight text-foreground">IB Grade Tracker</h1>
          <Button variant="outline" onClick={() => setShowTrends(true)}>
            <TrendingUp className="mr-2 h-4 w-4" />
            View Trends
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6">

        {/* Giant Total Predicted Grade - Hero */}
        <section className="flex flex-col items-center justify-center mb-12">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">Predicted Total</p>
          <div className="flex items-baseline gap-3">
            <span className={`text-[10rem] font-bold leading-none bg-gradient-to-br ${getTotalColor(totalPredicted)} bg-clip-text text-transparent`}>
              {totalPredicted}
            </span>
            <span className="text-5xl text-muted-foreground font-medium">/42</span>
          </div>
        </section>

        {/* Subject Grades Grid - 2 per row, transparent */}
        <section className="w-full max-w-3xl">
          <div className="grid grid-cols-2 gap-x-16 gap-y-4">
            {subjects.map((subject) => {
              const percentage = calculatePercentage(subject.assignments, subject.type);
              const grade = calculatePredictedGrade(subject.assignments);

              return (
                <SubjectGradeCard
                  key={subject.id}
                  subject={subject}
                  grade={grade}
                  percentage={percentage}
                  onAddAssignment={addAssignment}
                  onUpdateAssignment={updateAssignment}
                  onDeleteAssignment={deleteAssignment}
                />
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background py-4 mt-auto">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Diwen Huang</span>
            <a
              href="https://github.com/diwenhuang"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
            </a>
            <a
              href="https://twitter.com/diwenhuang"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
            </a>
            <a
              href="https://linkedin.com/in/diwenhuang"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SubjectGradeCard({
  subject,
  grade,
  percentage,
  onAddAssignment,
  onUpdateAssignment,
  onDeleteAssignment
}: {
  subject: Subject;
  grade: number;
  percentage: number;
  onAddAssignment: (sid: string, assignment: Omit<Assignment, 'id'>) => void;
  onUpdateAssignment: (sid: string, aid: string, assignment: Omit<Assignment, 'id'>) => void;
  onDeleteAssignment: (sid: string, aid: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Determine color based on grade quality
  const getGradeColor = (grade: number) => {
    if (grade >= 7) return 'text-green-600 dark:text-green-400';
    if (grade >= 6) return 'text-lime-600 dark:text-lime-400';
    if (grade >= 5) return 'text-yellow-600 dark:text-yellow-400';
    if (grade >= 4) return 'text-orange-600 dark:text-orange-400';
    if (grade >= 3) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <Dialog open={showDetails} onOpenChange={setShowDetails}>
      <DialogTrigger asChild>
        <div className="group cursor-pointer transition-all hover:opacity-80">
          {/* Just the number and subject name - transparent, minimal */}
          <div className="flex flex-col items-center space-y-1.5">
            <span className={`text-4xl font-semibold ${subject.assignments.length === 0 ? 'text-muted-foreground/60' : getGradeColor(grade)}`}>
              {subject.assignments.length === 0 ? 'N/A' : grade}
            </span>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/80">{subject.name}</p>
              <p className="text-xs text-muted-foreground/60">
                {subject.type}{subject.assignments.length === 0 ? ' • No data' : percentage > 0 ? ` • ${percentage.toFixed(0)}%` : ''}
              </p>
            </div>
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{subject.name} ({subject.type})</DialogTitle>
          <DialogDescription>
            {subject.assignments.length === 0 ? (
              'No assignments yet'
            ) : (
              `Current Grade: ${grade} • ${percentage.toFixed(1)}%`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Assignments</h3>
            <AddAssignmentDialog subject={subject} onAdd={onAddAssignment} />
          </div>

          {subject.assignments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No assignments yet</p>
          ) : (
            <div className="space-y-2">
              {subject.assignments.map((assignment) => {
                // Calculate display values
                let displayPercent = 0;
                const displayGrade = assignment.ibGrade;
                const displayRawGrade = assignment.rawGrade || '';

                if (assignment.rawPercent !== undefined) {
                  displayPercent = assignment.rawPercent;
                } else if (subject.type === 'SL' && assignment.rawGrade) {
                  // Only auto-calculate percentage from raw grade for SL (HL is scaled)
                  const parsed = parseRawGrade(assignment.rawGrade);
                  if (parsed) {
                    displayPercent = calculateRawPercent(parsed.score, parsed.total);
                  }
                }

                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setEditingAssignment(assignment)}
                  >
                    <span className="font-medium">{assignment.name}</span>
                    <div className="flex items-center gap-4">
                      {displayRawGrade && (
                        <span className="text-sm text-muted-foreground">
                          {displayRawGrade}
                        </span>
                      )}
                      {displayPercent > 0 && (
                        <span className="text-sm font-medium w-12 text-right">
                          {displayPercent.toFixed(0)}%
                        </span>
                      )}
                      <span className="text-sm font-medium w-12 text-right">
                        IB: {displayGrade}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAssignment(subject.id, assignment.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {editingAssignment && (
            <EditAssignmentDialog
              subject={subject}
              assignment={editingAssignment}
              open={!!editingAssignment}
              onOpenChange={(open) => !open && setEditingAssignment(null)}
              onUpdate={(updated) => {
                onUpdateAssignment(subject.id, editingAssignment.id, updated);
                setEditingAssignment(null);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SetupSubjectDialog({ onAdd, subjectNumber }: { onAdd: (name: string, type: SubjectType) => void, subjectNumber: number }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<SubjectType>("HL");
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name) {
      onAdd(name, type);
      setName("");
      setType("HL");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start" size="lg">
          <Plus className="mr-2 h-4 w-4" /> Add Subject {subjectNumber}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subject {subjectNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Subject Name</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Math AA, English A, Physics"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Level</Label>
            <Select value={type} onValueChange={(v) => setType(v as SubjectType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HL">Higher Level (HL)</SelectItem>
                <SelectItem value="SL">Standard Level (SL)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit">Add Subject</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddAssignmentDialog({ subject, onAdd }: { subject: Subject, onAdd: (sid: string, assignment: Omit<Assignment, 'id'>) => void }) {
  const [name, setName] = useState("");
  const [ibGrade, setIbGrade] = useState("");
  const [rawGrade, setRawGrade] = useState("");
  const [rawPercent, setRawPercent] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [open, setOpen] = useState(false);

  // Auto-fill IB grade from percentage for SL classes
  const handlePercentChange = (value: string) => {
    setRawPercent(value);

    // Only auto-fill for SL classes and when ibGrade is empty
    if (subject.type === 'SL' && value && !ibGrade) {
      const percent = parseFloat(value);
      if (!isNaN(percent)) {
        const calculatedGrade = percentToIBGrade(percent, subject.type);
        setIbGrade(calculatedGrade.toString());
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ibGrade) return;

    const assignment: Omit<Assignment, 'id'> = {
      name,
      ibGrade: parseInt(ibGrade),
      date: date,
    };

    // Handle raw grade (e.g., "31/32")
    if (rawGrade) {
      assignment.rawGrade = rawGrade;

      // Auto-calculate percentage for SL only (HL is scaled, so don't auto-calculate)
      if (subject.type === 'SL' && !rawPercent) {
        const parsed = parseRawGrade(rawGrade);
        if (parsed) {
          assignment.rawPercent = calculateRawPercent(parsed.score, parsed.total);
        }
      }
    }

    // Handle raw percent
    if (rawPercent) {
      assignment.rawPercent = parseFloat(rawPercent);
    }

    onAdd(subject.id, assignment);
    setName("");
    setIbGrade("");
    setRawGrade("");
    setRawPercent("");
    setDate(new Date().toISOString().split('T')[0]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-3 w-3" /> Add Assignment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Assignment</DialogTitle>
          <DialogDescription>
            Name and IB grade are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="assign-name">Assignment Name</Label>
            <Input id="assign-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Unit Test 1" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ibGrade">IB Grade</Label>
            <Select value={ibGrade} onValueChange={setIbGrade} required>
              <SelectTrigger>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="1">1</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rawGrade" className="text-muted-foreground">Raw Grade (optional)</Label>
            <Input id="rawGrade" value={rawGrade} onChange={e => setRawGrade(e.target.value)} placeholder="e.g. 31/32" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rawPercent">Percentage</Label>
            <Input id="rawPercent" type="number" step="0.1" min="0" max="100" value={rawPercent} onChange={e => handlePercentChange(e.target.value)} placeholder="96.8" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!name || !ibGrade}>Add Assignment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAssignmentDialog({
  subject,
  assignment,
  open,
  onOpenChange,
  onUpdate
}: {
  subject: Subject;
  assignment: Assignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (assignment: Omit<Assignment, 'id'>) => void;
}) {
  const [name, setName] = useState(assignment.name);
  const [ibGrade, setIbGrade] = useState(assignment.ibGrade?.toString() ?? "4");
  const [rawGrade, setRawGrade] = useState(assignment.rawGrade ?? "");
  const [rawPercent, setRawPercent] = useState(assignment.rawPercent?.toString() ?? "");
  const [date, setDate] = useState(assignment.date);

  // Auto-fill IB grade from percentage for SL classes
  const handlePercentChange = (value: string) => {
    setRawPercent(value);

    // Only auto-fill for SL classes
    if (subject.type === 'SL' && value) {
      const percent = parseFloat(value);
      if (!isNaN(percent)) {
        const calculatedGrade = percentToIBGrade(percent, subject.type);
        setIbGrade(calculatedGrade.toString());
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ibGrade) return;

    const updatedAssignment: Omit<Assignment, 'id'> = {
      name,
      ibGrade: parseInt(ibGrade),
      date: date,
    };

    // Handle raw grade (e.g., "31/32")
    if (rawGrade) {
      updatedAssignment.rawGrade = rawGrade;

      // Auto-calculate percentage for SL only (HL is scaled, so don't auto-calculate)
      if (subject.type === 'SL' && !rawPercent) {
        const parsed = parseRawGrade(rawGrade);
        if (parsed) {
          updatedAssignment.rawPercent = calculateRawPercent(parsed.score, parsed.total);
        }
      }
    }

    // Handle raw percent
    if (rawPercent) {
      updatedAssignment.rawPercent = parseFloat(rawPercent);
    }

    onUpdate(updatedAssignment);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
          <DialogDescription>
            Name and IB grade are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Assignment Name</Label>
            <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Unit Test 1" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-ibGrade">IB Grade</Label>
            <Select value={ibGrade} onValueChange={setIbGrade} required>
              <SelectTrigger>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="1">1</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-rawGrade" className="text-muted-foreground">Raw Grade (optional)</Label>
            <Input id="edit-rawGrade" value={rawGrade} onChange={e => setRawGrade(e.target.value)} placeholder="e.g. 31/32" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-rawPercent">Percentage</Label>
            <Input id="edit-rawPercent" type="number" step="0.1" min="0" max="100" value={rawPercent} onChange={e => handlePercentChange(e.target.value)} placeholder="96.8" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-date">Date</Label>
            <Input id="edit-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!name || !ibGrade}>Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TrendsView({ subjects, onBack }: { subjects: Subject[], onBack: () => void }) {
  // Calculate trend data: array of {date, predictedGrade, subjectGrades: {[subjectName]: grade}}
  const trendData = calculateTrendData(subjects);

  const [showPredicted, setShowPredicted] = useState(true);
  const [visibleSubjects, setVisibleSubjects] = useState<Set<string>>(new Set(subjects.map(s => s.name)));

  const toggleSubject = (subjectName: string) => {
    const newVisible = new Set(visibleSubjects);
    if (newVisible.has(subjectName)) {
      newVisible.delete(subjectName);
    } else {
      newVisible.add(subjectName);
    }
    setVisibleSubjects(newVisible);
  };

  const getSubjectColor = (index: number) => {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#ec4899', // pink
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <h1 className="font-bold text-2xl tracking-tight text-foreground">IB Grade Tracker</h1>
          <Button variant="outline" onClick={onBack}>
            <HomeIcon className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {/* Controls */}
        <div className="flex justify-center">
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPredicted(!showPredicted)}
              style={showPredicted ? {
                backgroundColor: '#6366f1',
                borderColor: '#6366f1',
                color: 'white',
              } : {
                borderColor: '#6366f1',
                color: '#6366f1',
              }}
            >
              Predicted Total
            </Button>
            {subjects.map((subject, index) => (
              <Button
                key={subject.id}
                variant="outline"
                size="sm"
                onClick={() => toggleSubject(subject.name)}
                style={visibleSubjects.has(subject.name) ? {
                  backgroundColor: getSubjectColor(index),
                  borderColor: getSubjectColor(index),
                  color: 'white',
                } : {
                  borderColor: getSubjectColor(index),
                  color: getSubjectColor(index),
                }}
              >
                {subject.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Combined Chart */}
        <div className="w-full flex flex-col items-center space-y-6">
          <div className="w-full max-w-5xl border border-border/50 rounded-2xl p-8 bg-gradient-to-br from-background via-background to-muted/10">
            <CombinedTrendChart
              data={trendData}
              subjects={subjects}
              showPredicted={showPredicted}
              visibleSubjects={visibleSubjects}
              getSubjectColor={getSubjectColor}
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 justify-center">
            {showPredicted && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6366f1' }} />
                <span className="text-sm text-muted-foreground">Predicted Total</span>
              </div>
            )}
            {subjects.map((subject, index) => {
              if (!visibleSubjects.has(subject.name)) return null;
              return (
                <div key={subject.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getSubjectColor(index) }} />
                  <span className="text-sm text-muted-foreground">{subject.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-background py-4 mt-auto">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Diwen Huang</span>
            <a
              href="https://github.com/diwenhuang"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
            </a>
            <a
              href="https://twitter.com/diwenhuang"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
            </a>
            <a
              href="https://linkedin.com/in/diwenhuang"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function calculateTrendData(subjects: Subject[]) {
  // Collect all unique dates from all assignments (normalize to YYYY-MM-DD format)
  const dateMap = new Map<string, boolean>();

  subjects.forEach(subject => {
    subject.assignments.forEach(assignment => {
      // Normalize date to ensure consistency
      const normalizedDate = assignment.date.split('T')[0]; // Remove time if present
      dateMap.set(normalizedDate, true);
    });
  });

  // Sort dates chronologically
  const uniqueDates = Array.from(dateMap.keys()).sort((a, b) =>
    new Date(a).getTime() - new Date(b).getTime()
  );

  // For each unique date, calculate the predicted grade at that point in time
  const trendData: Array<{date: string, predictedGrade: number, subjectGrades: {[key: string]: number}}> = [];

  uniqueDates.forEach(currentDate => {
    const subjectGrades: {[key: string]: number} = {};
    let totalGrade = 0;
    let subjectsWithGrades = 0;

    // For each subject, calculate its predicted grade up to this date
    subjects.forEach(subject => {
      const assignmentsUpToDate = subject.assignments.filter(a => {
        const assignmentDate = a.date.split('T')[0];
        return new Date(assignmentDate) <= new Date(currentDate);
      });

      if (assignmentsUpToDate.length > 0) {
        const avg = Math.round(
          assignmentsUpToDate.reduce((sum, a) => sum + a.ibGrade, 0) / assignmentsUpToDate.length
        );
        subjectGrades[subject.name] = avg;
        totalGrade += avg;
        subjectsWithGrades++;
      }
    });

    // Only include predicted total if all 6 subjects have at least one assignment
    const predictedGrade = subjectsWithGrades === 6 ? totalGrade : 0;

    trendData.push({
      date: currentDate,
      predictedGrade,
      subjectGrades,
    });
  });

  return trendData;
}

function CombinedTrendChart({
  data,
  subjects,
  showPredicted,
  visibleSubjects,
  getSubjectColor
}: {
  data: ReturnType<typeof calculateTrendData>;
  subjects: Subject[];
  showPredicted: boolean;
  visibleSubjects: Set<string>;
  getSubjectColor: (index: number) => string;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<{x: number, y: number, value: number, label: string} | null>(null);

  if (data.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No data available</p>;
  }

  if (data.length === 1) {
    return <p className="text-center text-muted-foreground py-8">Need at least 2 dates to show trend graph</p>;
  }

  const chartHeight = 400;
  const chartWidth = 900;

  // Determine if we should show y-axis labels
  const onlySubjects = !showPredicted && visibleSubjects.size > 0;
  const onlyPredicted = showPredicted && visibleSubjects.size === 0;
  const showYAxis = onlySubjects || onlyPredicted;

  const padding = { top: 30, right: 30, bottom: 50, left: showYAxis ? 50 : 30 };

  // Determine y-axis range
  let yMin = Infinity;
  let yMax = -Infinity;

  data.forEach(point => {
    if (showPredicted) {
      yMin = Math.min(yMin, point.predictedGrade);
      yMax = Math.max(yMax, point.predictedGrade);
    }
    visibleSubjects.forEach(subjectName => {
      if (point.subjectGrades[subjectName] !== undefined) {
        yMin = Math.min(yMin, point.subjectGrades[subjectName]);
        yMax = Math.max(yMax, point.subjectGrades[subjectName]);
      }
    });
  });

  // Set appropriate y-axis range based on what's visible
  if (onlyPredicted) {
    yMin = 0;
    yMax = 42;
  } else if (onlySubjects) {
    yMin = 1;
    yMax = 7;
  } else {
    yMin = Math.floor(yMin) - 1;
    yMax = Math.ceil(yMax) + 1;
  }

  const xScale = (index: number) => {
    if (data.length === 1) {
      return chartWidth / 2; // Center single point
    }
    return padding.left + (index / (data.length - 1)) * (chartWidth - padding.left - padding.right);
  };

  const yScale = (value: number) => {
    return chartHeight - padding.bottom - ((value - yMin) / (yMax - yMin)) * (chartHeight - padding.top - padding.bottom);
  };

  // Generate path for predicted grade (only for points where all 6 subjects have data)
  const predictedPoints = showPredicted ? data.map((point, index) => ({
    x: xScale(index),
    y: yScale(point.predictedGrade),
    value: point.predictedGrade,
    index,
  })).filter(p => p.value > 0) : [];

  const predictedPath = predictedPoints.length > 0 ? predictedPoints.map((point, index) => {
    return index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`;
  }).join(' ') : '';

  // Generate paths for each subject
  const subjectPaths: Array<{name: string, points: Array<{x: number, y: number, dataIndex: number}>, color: string}> = [];
  subjects.forEach((subject, subjectIndex) => {
    if (!visibleSubjects.has(subject.name)) return;

    // Get all data points where this subject has a grade
    const points: Array<{x: number, y: number, dataIndex: number}> = [];
    data.forEach((point, dataIndex) => {
      if (point.subjectGrades[subject.name] !== undefined) {
        points.push({
          x: xScale(dataIndex),
          y: yScale(point.subjectGrades[subject.name]),
          dataIndex,
        });
      }
    });

    if (points.length === 0) return;

    subjectPaths.push({
      name: subject.name,
      points,
      color: getSubjectColor(subjectIndex),
    });
  });

  return (
    <div className="w-full flex justify-center relative">
      {hoveredPoint && (
        <div
          className="absolute bg-foreground text-background px-2 py-1 rounded text-xs font-medium pointer-events-none z-10"
          style={{
            left: `${(hoveredPoint.x / chartWidth) * 100}%`,
            top: `${(hoveredPoint.y / chartHeight) * 100}%`,
            transform: 'translate(-50%, -120%)',
          }}
        >
          {hoveredPoint.label}: {hoveredPoint.value}
        </div>
      )}
      <svg width={chartWidth} height={chartHeight} className="max-w-full"  viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">

        {/* Y-axis labels */}
        {showYAxis && (() => {
          const labels: number[] = [];
          if (onlyPredicted) {
            // Show 0, 7, 14, 21, 28, 35, 42 for predicted total
            for (let i = 0; i <= 42; i += 7) {
              labels.push(i);
            }
          } else if (onlySubjects) {
            // Show 1-7 for subjects
            for (let i = 1; i <= 7; i++) {
              labels.push(i);
            }
          }
          return labels.map((label) => (
            <text
              key={label}
              x={padding.left - 10}
              y={yScale(label)}
              textAnchor="end"
              className="text-xs fill-muted-foreground"
              dominantBaseline="middle"
            >
              {label}
            </text>
          ));
        })()}

        {/* X-axis labels */}
        {(() => {
          const maxLabels = 8;
          const step = Math.max(1, Math.ceil(data.length / maxLabels));
          return data.map((point, index) => {
            // Show first, last, and evenly spaced labels
            if (index !== 0 && index !== data.length - 1 && index % step !== 0) {
              return null;
            }
            return (
              <text
                key={index}
                x={xScale(index)}
                y={chartHeight - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs fill-muted-foreground"
              >
                {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            );
          });
        })()}

        {/* Subject lines */}
        {subjectPaths.map((subjectPath) => {
          // Generate path from points
          const pathData = subjectPath.points.map((point, index) => {
            return index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`;
          }).join(' ');

          return (
            <g key={subjectPath.name}>
              {/* Only draw line if there are 2+ points */}
              {subjectPath.points.length > 1 && (
                <path
                  d={pathData}
                  fill="none"
                  stroke={subjectPath.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* Points */}
              {subjectPath.points.map((point, index) => {
                const gradeValue = data[point.dataIndex].subjectGrades[subjectPath.name];
                return (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill={subjectPath.color}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint({ x: point.x, y: point.y, value: gradeValue, label: subjectPath.name })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Predicted line - draw on top */}
        {showPredicted && predictedPoints.length > 0 && (
          <g>
            {predictedPoints.length > 1 && (
              <path
                d={predictedPath}
                fill="none"
                stroke="#6366f1"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* Points - only show where all 6 subjects have data */}
            {predictedPoints.map((point, idx) => (
              <circle
                key={idx}
                cx={point.x}
                cy={point.y}
                r="3.5"
                fill="#6366f1"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint({ x: point.x, y: point.y, value: point.value, label: 'Predicted Total' })}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
