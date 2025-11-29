"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronRight, TrendingUp, Home as HomeIcon, Pencil, Info, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Subject, Assessment, SubjectType, calculatePercentage, getGrade, calculateRawPercent, percentToIBGrade, parseRawGrade, calculatePredictedGrade } from "@/lib/types";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import Auth from "@/components/Auth";
import { ManageCategoriesDialog } from "@/components/ManageCategoriesDialog";
import { calculateLocalPrediction } from "@/lib/prediction";

// Parse MM/DD/YYYY format to YYYY-MM-DD
function parseDateInput(input: string): { valid: boolean; date: string; error?: string } {
  const trimmed = input.trim();

  // Match MM/DD/YYYY format
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return { valid: false, date: '', error: 'Invalid format. Use MM/DD/YYYY' };
  }

  const month = parseInt(match[1]);
  const day = parseInt(match[2]);
  const year = parseInt(match[3]);

  // Validate ranges
  if (month < 1 || month > 12) {
    return { valid: false, date: '', error: 'Month must be between 1-12' };
  }

  if (day < 1 || day > 31) {
    return { valid: false, date: '', error: 'Day must be between 1-31' };
  }

  if (year < 1900 || year > 2100) {
    return { valid: false, date: '', error: 'Year must be between 1900-2100' };
  }

  // Create date object to validate it's a real date
  const dateObj = new Date(year, month - 1, day);
  if (dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
    return { valid: false, date: '', error: 'Invalid date (e.g., Feb 30 doesn\'t exist)' };
  }

  // Convert to YYYY-MM-DD format
  const paddedMonth = month.toString().padStart(2, '0');
  const paddedDay = day.toString().padStart(2, '0');

  return { valid: true, date: `${year}-${paddedMonth}-${paddedDay}` };
}

// Convert YYYY-MM-DD to MM/DD/YYYY for display
function formatDateForDisplay(isoDate: string): string {
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[1])}/${parseInt(parts[2])}/${parts[0]}`;
  }
  return isoDate;
}

// Footer component used across all pages
function Footer() {
  return (
    <footer className="bg-background py-4 mt-auto">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Diwen Huang</span>
          <a
            href="mailto:diwennee@gmail.com"
            className="hover:text-foreground transition-colors"
          >
            <Mail size={16} />
          </a>
          <a
            href="https://github.com/diwenne"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
          </a>
          <a
            href="https://x.com/diwennee"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
          </a>
          <a
            href="https://linkedin.com/in/diwenh5"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
          </a>
          <a
            href="https://instagram.com/devdiwen"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const initialLoadComplete = useRef(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const supabase = createClient();

  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [selectedSubjectForCategories, setSelectedSubjectForCategories] = useState<Subject | null>(null);

  const loadSubjects = async () => {
    console.log('loadSubjects: Starting...');
    try {
      const data = await api.fetchSubjects(supabase);
      console.log('loadSubjects: Got data:', data);
      setSubjects(data);
    } catch (error) {
      console.error('loadSubjects: Error:', error);
    } finally {
      console.log('loadSubjects: Setting loading to false');
      setLoading(false);
    }
  };

  const handleRecalculateAll = async () => {
    if (isRecalculating) return;

    setIsRecalculating(true);
    try {
      // Recalculate all subjects with assessments
      const recalcPromises = subjects
        .filter(subject => subject.assessments.length > 0)
        .map(subject =>
          api.predictGrade(subject, subject.assessments, subject.categories || [])
        );

      await Promise.all(recalcPromises);
      await loadSubjects(); // Refresh all data
    } catch (error) {
      console.error('Error recalculating all:', error);
    } finally {
      setIsRecalculating(false);
    }
  };

  // Check auth and load data
  useEffect(() => {
    console.log('useEffect: Starting');
    setIsClient(true);

    let mounted = true;

    const init = async () => {
      console.log('init: Getting session...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('init: Session:', session ? 'exists' : 'null');

      if (!mounted) return;

      setSession(session);

      if (session) {
        console.log('init: Loading subjects...');
        await loadSubjects();
      } else {
        console.log('init: No session, setting loading to false');
        setLoading(false);
      }
      initialLoadComplete.current = true;
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('onAuthStateChange: Event:', _event, 'Session:', session ? 'exists' : 'null');

      if (!mounted) return;

      // INITIAL_SESSION fires during app load - skip it since init() handles initial load
      if (_event === 'INITIAL_SESSION') {
        console.log('onAuthStateChange: Skipping INITIAL_SESSION (handled by init)');
        return;
      }

      // Skip SIGNED_IN events that fire during initial load (before init completes)
      if (_event === 'SIGNED_IN' && !initialLoadComplete.current) {
        console.log('onAuthStateChange: Skipping SIGNED_IN during initial load');
        return;
      }

      // Only reload subjects on actual sign-in events after initial load
      if (_event === 'SIGNED_IN') {
        // Check if we already have this session to avoid double load
        setSession((prevSession: any) => {
          if (prevSession?.user?.id === session?.user?.id) {
            console.log('onAuthStateChange: Session ID match, skipping reload');
            return prevSession;
          }
          // New session, reload
          setLoading(true);
          loadSubjects();
          return session;
        });
      } else if (_event === 'SIGNED_OUT') {
        setSession(null);
        setSubjects([]);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const addSubject = async (name: string, type: SubjectType) => {
    if (!session) {
      return;
    }
    const newSubject = await api.createSubject(name, type, supabase);
    if (newSubject) {
      setSubjects([...subjects, newSubject]);
    }
  };

  const updateSubject = async (id: string, name: string, type: SubjectType) => {
    const updated = await api.updateSubject(id, name, type, supabase);
    if (updated) {
      setSubjects(subjects.map(sub =>
        sub.id === id
          ? { ...sub, name: updated.name, type: updated.type }
          : sub
      ));
    }
  };

  const addAssessment = async (subjectId: string, assessment: Omit<Assessment, 'id'>) => {
    const newAssessment = await api.createAssessment(subjectId, assessment, supabase);
    if (newAssessment) {
      // Reload subjects to get updated dirty flag and trigger recalculation
      await loadSubjects();
    }
  };

  const updateAssessment = async (subjectId: string, assessmentId: string, updatedAssessment: Omit<Assessment, 'id'>) => {
    const updated = await api.updateAssessment(assessmentId, updatedAssessment, supabase);
    if (updated) {
      // Reload subjects to get updated dirty flag and trigger recalculation
      await loadSubjects();
    }
  };

  const deleteAssessment = async (subjectId: string, assessmentId: string) => {
    const success = await api.deleteAssessment(assessmentId, supabase);
    if (success) {
      // Reload subjects to get updated dirty flag and trigger recalculation
      await loadSubjects();
    }
  };

  // Calculate total predicted grade (out of 42)
  const totalPredicted = subjects.reduce((total, subject) => {
    if (subject.assessments.length === 0) return total; // Skip subjects with no assessments

    // Use AI predicted grade if available, otherwise fall back to local calculation
    const localPrediction = calculateLocalPrediction(subject, subject.assessments, subject.categories || []);
    const grade = subject.aiPredictedGrade || localPrediction?.grade || calculatePredictedGrade(subject.assessments);

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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Show auth screen if not logged in
  if (!session) {
    return <Auth onLogin={() => { loadSubjects(); }} />;
  }

  // Trends view
  if (showTrends) {
    return <TrendsView key={JSON.stringify(subjects)} subjects={subjects} onBack={() => setShowTrends(false)} onShowHelp={() => setShowHelp(true)} />;
  }

  // Help view
  if (showHelp) {
    return <HelpView onBack={() => setShowHelp(false)} />;
  }

  // Onboarding view - show if less than 6 subjects
  if (subjects.length < 6) {
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
                        onClick={async () => {
                          const success = await api.deleteSubject(subject.id, supabase);
                          if (success) {
                            setSubjects(subjects.filter(s => s.id !== subject.id));
                          }
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

          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard view
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src="/iblogo.png" alt="IB" className="h-8 w-auto" />
              <h1 className="font-bold text-2xl tracking-tight text-foreground">Tracker</h1>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHelp(true)}>
              <Info className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">BETA</Badge>
              <Button variant="outline" onClick={() => setShowTrends(true)}>
                <TrendingUp className="mr-2 h-4 w-4" />
                View Trends
              </Button>
            </div>
            <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6">

        {/* Giant Total Predicted Grade - Hero */}
        <section className="flex flex-col items-center justify-center mb-12">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Predicted Total</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={handleRecalculateAll}
              disabled={isRecalculating || subjects.length === 0}
              title="Recalculate all AI predictions"
            >
              <RefreshCw className={`h-3 w-3 ${isRecalculating ? 'animate-spin' : ''}`} />
            </Button>
          </div>
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
              // Use local prediction for weighted percentage (respects category weights)
              const localPred = calculateLocalPrediction(subject, subject.assessments, subject.categories || []);
              const percentage = localPred && subject.type === 'SL'
                ? parseFloat(localPred.details.match(/(\d+\.?\d*)%/)?.[1] || '0')
                : calculatePercentage(subject.assessments, subject.type);
              const grade = calculatePredictedGrade(subject.assessments);

              return (
                <SubjectGradeCard
                  key={subject.id}
                  subject={subject}
                  grade={grade}
                  percentage={percentage}
                  onAddAssessment={addAssessment}
                  onUpdateAssessment={updateAssessment}
                  onDeleteAssessment={deleteAssessment}
                  onUpdateSubject={updateSubject}
                  onManageCategories={(subject) => {
                    setSelectedSubjectForCategories(subject);
                    setManageCategoriesOpen(true);
                  }}
                  onRefresh={loadSubjects}
                />
              );
            })}
          </div>
        </section>
      </main>

      <Footer />

      {selectedSubjectForCategories && (
        <ManageCategoriesDialog
          subject={selectedSubjectForCategories}
          open={manageCategoriesOpen}
          onOpenChange={setManageCategoriesOpen}
          onUpdate={loadSubjects}
        />
      )}
    </div>
  );
}

function SubjectGradeCard({
  subject,
  grade,
  percentage,
  onAddAssessment,
  onUpdateAssessment,
  onDeleteAssessment,
  onUpdateSubject,
  onManageCategories,
  onRefresh
}: {
  subject: Subject;
  grade: number;
  percentage: number;
  onAddAssessment: (sid: string, assessment: Omit<Assessment, 'id'>) => void;
  onUpdateAssessment: (sid: string, aid: string, assessment: Omit<Assessment, 'id'>) => void;
  onDeleteAssessment: (sid: string, aid: string) => void;
  onUpdateSubject: (id: string, name: string, type: SubjectType) => void;
  onManageCategories: (subject: Subject) => void;
  onRefresh: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);

  const handleManualRecalculate = async () => {
    if (isPredicting || subject.assessments.length === 0) return;

    setIsPredicting(true);
    try {
      const result = await api.predictGrade(subject, subject.assessments, subject.categories || []);
      if (result) {
        onRefresh();
      }
    } finally {
      setIsPredicting(false);
    }
  };

  // Auto-recalculate when dirty flag changes (after CRUD operations)
  useEffect(() => {
    if (subject.predictionDirty && !isPredicting && subject.assessments.length > 0) {
      setIsPredicting(true);
      api.predictGrade(subject, subject.assessments, subject.categories || [])
        .then((result) => {
          if (result) {
            onRefresh(); // This reloads all subjects, updating the total score
          }
        })
        .finally(() => setIsPredicting(false));
    }
  }, [subject.predictionDirty, subject.id]);

  // Force recalculation on mount for all subjects (page refresh)
  useEffect(() => {
    if (subject.assessments.length > 0 && !isPredicting) {
      const timer = setTimeout(() => {
        if (!subject.aiPredictedGrade && !isPredicting) {
          setIsPredicting(true);
          api.predictGrade(subject, subject.assessments, subject.categories || [])
            .then((result) => {
              if (result) {
                onRefresh();
              }
            })
            .finally(() => setIsPredicting(false));
        }
      }, 500); // Small delay to avoid all subjects firing at once

      return () => clearTimeout(timer);
    }
  }, []); // Only run on mount

  // Calculate local prediction
  const localPrediction = calculateLocalPrediction(subject, subject.assessments, subject.categories || []);

  // Determine which prediction to show
  // For SL subjects, ALWAYS use local calculation (AI is too unreliable with weights)
  // For HL subjects, use AI if available (trends/adjustments are useful)
  const displayGrade = subject.type === 'SL'
    ? (localPrediction?.grade || grade)
    : (subject.aiPredictedGrade || localPrediction?.grade || grade);
  const isAi = subject.type === 'HL' && !!subject.aiPredictedGrade;
  const predictionDetails = subject.type === 'SL'
    ? localPrediction?.details
    : (subject.aiExplanation || localPrediction?.details);

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
            <span className={`text-4xl font-semibold ${subject.assessments.length === 0 ? 'text-muted-foreground/60' : getGradeColor(displayGrade)}`}>
              {subject.assessments.length === 0 ? 'N/A' : displayGrade}
            </span>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/80">{subject.name}</p>
              <p className="text-xs text-muted-foreground/60">
                {subject.type}{subject.assessments.length === 0 ? ' • No data' : percentage > 0 ? ` • ${percentage.toFixed(0)}%` : ''}
                {isAi && ' • AI'}
              </p>
            </div>
            {isPredicting && <span className="text-[10px] text-muted-foreground animate-pulse">Updating...</span>}
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-8">
            <DialogTitle className="flex items-center gap-2">
              {subject.name} ({subject.type})
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground border-none outline-none focus-visible:ring-0 ring-0"
                onClick={() => setIsEditingSubject(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleManualRecalculate}
                disabled={isPredicting || subject.assessments.length === 0}
                title="Recalculate AI prediction"
              >
                <RefreshCw className={`h-3 w-3 ${isPredicting ? 'animate-spin' : ''}`} />
              </Button>
            </DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              {subject.assessments.length === 0 ? (
                'No assessments yet'
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span>Predicted Grade: <strong>{displayGrade}</strong> {percentage > 0 && `(${percentage.toFixed(1)}%)`}</span>
                    {isAi && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">AI</span>}
                  </div>
                  {predictionDetails && (
                    <span className="text-xs text-muted-foreground">{predictionDetails}</span>
                  )}
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Assessments</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onManageCategories(subject)}
              >
                <TrendingUp className="h-3 w-3 mr-2" />
                Categories
              </Button>
              <AddAssessmentDialog subject={subject} onAdd={onAddAssessment} />
            </div>
          </div>

          {subject.assessments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No assessments yet</p>
          ) : (
            <div className="space-y-2">
              {subject.assessments.map((assessment) => {
                // Calculate display values
                let displayPercent = 0;
                const displayGrade = assessment.ibGrade;
                const displayRawGrade = assessment.rawGrade || '';

                if (assessment.rawPercent !== undefined && assessment.rawPercent !== null) {
                  displayPercent = assessment.rawPercent;
                } else if (subject.type === 'SL' && assessment.rawGrade) {
                  // Only auto-calculate percentage from raw grade for SL (HL is scaled)
                  const parsed = parseRawGrade(assessment.rawGrade);
                  if (parsed) {
                    displayPercent = calculateRawPercent(parsed.score, parsed.total);
                  }
                }

                return (
                  <div
                    key={assessment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setEditingAssessment(assessment)}
                  >
                    <div>
                      <div className="font-medium">{assessment.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{formatDateForDisplay(assessment.date)}</span>
                        {assessment.categoryId && (
                          <span className="bg-secondary px-1.5 rounded text-[10px]">
                            {subject.categories?.find(c => c.id === assessment.categoryId)?.name}
                          </span>
                        )}
                      </div>
                    </div>
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
                          onDeleteAssessment(subject.id, assessment.id);
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

          {editingAssessment && (
            <EditAssessmentDialog
              subject={subject}
              assessment={editingAssessment}
              open={!!editingAssessment}
              onOpenChange={(open) => !open && setEditingAssessment(null)}
              onUpdate={(updated) => {
                onUpdateAssessment(subject.id, editingAssessment.id, updated);
                setEditingAssessment(null);
              }}
            />
          )}
        </div>

        <EditSubjectDialog
          subject={subject}
          open={isEditingSubject}
          onOpenChange={setIsEditingSubject}
          onUpdate={onUpdateSubject}
        />
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

function AddAssessmentDialog({ subject, onAdd }: { subject: Subject, onAdd: (sid: string, assessment: Omit<Assessment, 'id'>) => void }) {
  const [name, setName] = useState("");
  const [ibGrade, setIbGrade] = useState("");
  const [rawGrade, setRawGrade] = useState("");
  const [rawPercent, setRawPercent] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<string>("uncategorized");
  const [open, setOpen] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setIbGrade("");
      setRawGrade("");
      setRawPercent("");
      setDate(new Date().toISOString().split('T')[0]);
      setNotes("");
      setCategoryId("uncategorized");
    }
  }, [open]);

  const handlePercentChange = (value: string) => {
    setRawPercent(value);

    // Auto-fill IB grade for SL subjects if empty
    if (subject.type === 'SL' && value && !ibGrade) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        // Simple estimation
        if (num >= 80) setIbGrade("7");
        else if (num >= 70) setIbGrade("6");
        else if (num >= 60) setIbGrade("5");
        else if (num >= 50) setIbGrade("4");
        else if (num >= 40) setIbGrade("3");
        else if (num >= 30) setIbGrade("2");
        else setIbGrade("1");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name) return;

    // For HL, IB Grade is preferred. For SL, either is fine.
    // But we need at least one numeric value
    if (!ibGrade && !rawPercent && !rawGrade) {
      alert("Please enter at least an IB Grade, Raw Score, or Percentage.");
      return;
    }

    onAdd(subject.id, {
      name,
      ibGrade: ibGrade ? parseInt(ibGrade) : null,
      rawGrade: rawGrade || null,
      rawPercent: rawPercent ? parseFloat(rawPercent) : null,
      date,
      notes: notes || null,
      categoryId: categoryId === "uncategorized" ? null : categoryId
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex-1">
          <Plus className="h-4 w-4 mr-2" />
          Add Grade
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Assessment for {subject.name}</DialogTitle>
          <DialogDescription>
            Enter the details of your assessment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="e.g. Unit 1 Test"
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Category
            </Label>
            <div className="col-span-3">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {subject.categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="ibGrade" className="text-right">
              IB Grade
            </Label>
            <div className="col-span-3">
              <Input
                id="ibGrade"
                type="number"
                min="1"
                max="7"
                value={ibGrade}
                onChange={(e) => setIbGrade(e.target.value)}
                placeholder="1-7"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {subject.type === 'HL' ? 'Required for HL' : 'Optional if % provided'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rawGrade" className="text-right">
              Raw Score
            </Label>
            <Input
              id="rawGrade"
              value={rawGrade}
              onChange={(e) => setRawGrade(e.target.value)}
              className="col-span-3"
              placeholder="e.g. 31/32"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rawPercent" className="text-right">
              Percentage
            </Label>
            <Input
              id="rawPercent"
              type="number"
              step="any"
              value={rawPercent}
              onChange={(e) => handlePercentChange(e.target.value)}
              className="col-span-3"
              placeholder="e.g. 96.8"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="col-span-3"
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">
              Notes
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3"
              placeholder="Add any notes..."
            />
          </div>

          <DialogFooter>
            <Button type="submit">Add Assessment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAssessmentDialog({
  subject,
  assessment,
  open,
  onOpenChange,
  onUpdate
}: {
  subject: Subject;
  assessment: Assessment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (assessment: Omit<Assessment, 'id'>) => void;
}) {
  const [name, setName] = useState(assessment.name);
  const [ibGrade, setIbGrade] = useState(assessment.ibGrade?.toString() || "");
  const [rawGrade, setRawGrade] = useState(assessment.rawGrade || "");
  const [rawPercent, setRawPercent] = useState(assessment.rawPercent?.toString() || "");
  const [date, setDate] = useState(assessment.date);
  const [notes, setNotes] = useState(assessment.notes || "");
  const [categoryId, setCategoryId] = useState<string>(assessment.categoryId || "uncategorized");

  const handlePercentChange = (value: string) => {
    setRawPercent(value);

    // Auto-fill IB grade for SL subjects if empty
    if (subject.type === 'SL' && value && !ibGrade) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        // Simple estimation
        if (num >= 80) setIbGrade("7");
        else if (num >= 70) setIbGrade("6");
        else if (num >= 60) setIbGrade("5");
        else if (num >= 50) setIbGrade("4");
        else if (num >= 40) setIbGrade("3");
        else if (num >= 30) setIbGrade("2");
        else setIbGrade("1");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name) return;

    if (!ibGrade && !rawPercent && !rawGrade) {
      alert("Please enter at least an IB Grade, Raw Score, or Percentage.");
      return;
    }

    onUpdate({
      name,
      ibGrade: ibGrade ? parseInt(ibGrade) : null,
      rawGrade: rawGrade || null,
      rawPercent: rawPercent ? parseFloat(rawPercent) : null,
      date,
      notes: notes || null,
      categoryId: categoryId === "uncategorized" ? null : categoryId
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Assessment</DialogTitle>
          <DialogDescription>
            Update the details of your assessment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-name" className="text-right">
              Name
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-category" className="text-right">
              Category
            </Label>
            <div className="col-span-3">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {subject.categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-ibGrade" className="text-right">
              IB Grade
            </Label>
            <div className="col-span-3">
              <Input
                id="edit-ibGrade"
                type="number"
                min="1"
                max="7"
                value={ibGrade}
                onChange={(e) => setIbGrade(e.target.value)}
                placeholder="1-7"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-rawGrade" className="text-right">
              Raw Score
            </Label>
            <Input
              id="edit-rawGrade"
              value={rawGrade}
              onChange={(e) => setRawGrade(e.target.value)}
              className="col-span-3"
              placeholder="e.g. 31/32"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-rawPercent" className="text-right">
              Percentage
            </Label>
            <Input
              id="edit-rawPercent"
              type="number"
              step="any"
              value={rawPercent}
              onChange={(e) => handlePercentChange(e.target.value)}
              className="col-span-3"
              placeholder="e.g. 96.8"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-date" className="text-right">
              Date
            </Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="col-span-3"
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-notes" className="text-right">
              Notes
            </Label>
            <Input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3"
              placeholder="Add any notes..."
            />
          </div>

          <DialogFooter>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HelpView({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <h1 className="font-bold text-2xl tracking-tight text-foreground">Help & Information</h1>
          <Button variant="outline" onClick={onBack}>
            <HomeIcon className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Welcome to IB Tracker</h2>
            <p className="text-muted-foreground">
              I made this website to visualize and log my IB grades because I'm failing. Let's fail together 🫡
            </p>
          </div>

          <Accordion type="multiple" className="w-full">
            <AccordionItem value="how-to-use">
              <AccordionTrigger className="text-lg font-semibold">How to Use</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>Getting started with IB Tracker is simple:</p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Add your 6 IB subjects (3 Higher Level and 3 Standard Level)</li>
                    <li>For each subject, add your assessments with their IB grades (1-7)</li>
                    <li>Optionally include raw grades and percentages for more detailed tracking</li>
                    <li>Track your predicted total out of 42 points on the dashboard</li>
                    <li>Click "View Trends" to see how your grades change over time</li>
                    <li>Edit or delete assessments by clicking on them in the subject cards</li>
                  </ol>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ib-grading">
              <AccordionTrigger className="text-lg font-semibold">IB Grading System</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    Each IB subject is graded on a scale of 1-7, where:
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-green-600 text-lg w-8">7</span>
                        <span className="text-muted-foreground">Excellent</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lime-600 text-lg w-8">6</span>
                        <span className="text-muted-foreground">Very Good</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-yellow-600 text-lg w-8">5</span>
                        <span className="text-muted-foreground">Good</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-orange-600 text-lg w-8">4</span>
                        <span className="text-muted-foreground">Satisfactory</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-red-600 text-lg w-8">3</span>
                        <span className="text-muted-foreground">Mediocre</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-red-700 text-lg w-8">2</span>
                        <span className="text-muted-foreground">Poor</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-red-800 text-lg w-8">1</span>
                        <span className="text-muted-foreground">Very Poor</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm mt-4">
                    Your total IB score is out of 42 points (6 subjects × 7 points each). Most universities require 24+ points to pass.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="hl-boundaries">
              <AccordionTrigger className="text-lg font-semibold">Grade Boundaries - Higher Level (HL)</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    HL teachers tend to use a heavy curve and convert IB grades to percentages using these boundaries:
                  </p>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 7</span>
                      <span className="text-muted-foreground">98%+</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 6</span>
                      <span className="text-muted-foreground">96%+</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 5</span>
                      <span className="text-muted-foreground">90%+</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 4</span>
                      <span className="text-muted-foreground">86%+</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 3</span>
                      <span className="text-muted-foreground">76%+</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 2</span>
                      <span className="text-muted-foreground">50%+</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 1</span>
                      <span className="text-muted-foreground">Below 50%</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Note: HL uses "huge scaling" - teachers apply significant curves when converting IB grades to percentages.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sl-boundaries">
              <AccordionTrigger className="text-lg font-semibold">Grade Boundaries - Standard Level (SL)</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    SL teachers tend to use minimal curve and convert raw percentages directly to IB grades:
                  </p>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 7</span>
                      <span className="text-muted-foreground">96% - 100%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 6</span>
                      <span className="text-muted-foreground">90% - 95%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 5</span>
                      <span className="text-muted-foreground">86% - 89%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 4</span>
                      <span className="text-muted-foreground">76% - 85%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 3</span>
                      <span className="text-muted-foreground">70% - 75%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 2</span>
                      <span className="text-muted-foreground">50% - 69%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Grade 1</span>
                      <span className="text-muted-foreground">0% - 49%</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Note: SL teachers typically don't apply heavy curves, converting raw percentages more directly to IB grades.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="predicted-grade">
              <AccordionTrigger className="text-lg font-semibold">How Predicted Grades Work</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    Your predicted grades in this app are estimates powered by weighted performance and AI (OpenAI GPT-3.5-turbo). They do not replace your teacher's official IB predicted grades.
                  </p>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">1️⃣ Weighted Assessments (Direct Percentage Weights)</h4>
                      <p className="text-sm mb-2">
                        Big exams and IAs matter more than quizzes. You can assign categories (e.g., Exam, Test, Quiz, IA) to assessments with direct percentage weights (0.0-1.0). Total category weights cannot exceed 100%.
                      </p>
                      <div className="text-xs bg-background/50 rounded p-2 space-y-1">
                        <p><strong>Example Category Weights:</strong></p>
                        <ul className="list-disc list-inside ml-2">
                          <li>Exams: 0.4 (40%)</li>
                          <li>Internal Assessments (IA): 0.3 (30%)</li>
                          <li>Tests: 0.2 (20%)</li>
                          <li>Quizzes/Homework: 0.1 (10%)</li>
                        </ul>
                        <p className="mt-2"><strong>Uncategorized Assessments:</strong> If total category weight is less than 100%, uncategorized assessments automatically get the remaining weight.</p>
                        <p className="mt-1"><strong>Example:</strong> If categories total 60%, uncategorized assessments form an implicit category with 40% weight.</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">2️⃣ HL vs SL Assessment Input & Calculation Rules</h4>
                      <div className="text-sm space-y-2">
                        <div>
                          <p className="font-medium text-foreground">HL (Higher Level) Subjects:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>IB Grade (1-7) is <strong>required</strong></li>
                            <li>Raw percentage is optional (less meaningful due to heavy scaling)</li>
                            <li>Predictions emphasize <strong>trends and improvement over time</strong></li>
                            <li>Formula: weighted_avg_ib = Σ(ib_grade × weight)</li>
                            <li>Later assessments + high-weight categories influence predictions more</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">SL (Standard Level) Subjects:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Must include either <strong>raw percentage OR IB Grade</strong></li>
                            <li>Raw percentage is preferred and converted to IB grade using SL boundaries</li>
                            <li>Predictions rely on <strong>weighted average percentages</strong></li>
                            <li>Formula: weighted_avg_pct = Σ(raw_percentage × weight), then convert to IB band</li>
                            <li>Trend adjustments are smaller than HL</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">3️⃣ AI-Enhanced Predictions (OpenAI GPT-3.5-turbo)</h4>
                      <p className="text-sm mb-2">
                        <strong>HL and SL subjects use completely different AI prediction strategies</strong> to match how IB teachers actually grade each level:
                      </p>
                      <div className="space-y-3">
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="font-semibold text-blue-900 dark:text-blue-100 text-sm mb-1">HL Predictions (Trend-Focused Strategy)</p>
                          <ul className="list-disc list-inside text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-2">
                            <li><strong>PRIMARY FOCUS:</strong> Improvement trends and consistency in recent assessments</li>
                            <li>A student improving from 4→5→6 is likely to score 6 or higher on finals</li>
                            <li>Consistent 6s and 7s in recent high-weight assessments (Exams, IAs) strongly predict final 6-7</li>
                            <li>Raw percentages are largely <strong>ignored</strong> due to heavy HL scaling/curves</li>
                            <li>Recent performance matters MORE than old assessments (time decay)</li>
                            <li>Example: Even if early quizzes were 4s, recent exam 6s and IA 7 predict final grade 6-7</li>
                          </ul>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                          <p className="font-semibold text-green-900 dark:text-green-100 text-sm mb-1">SL Predictions (Average-Focused Strategy)</p>
                          <ul className="list-disc list-inside text-xs text-green-800 dark:text-green-200 space-y-1 ml-2">
                            <li><strong>PRIMARY FOCUS:</strong> Weighted average of raw percentages</li>
                            <li>AI calculates weighted avg % and converts to IB grade using SL boundaries (96-100%=7, 90-95%=6, etc.)</li>
                            <li>This weighted average is the <strong>main predictor</strong> (not trends!)</li>
                            <li>Trends only make <strong>small adjustments</strong> (max ±1 grade)</li>
                            <li>Percentages directly map to IB grades for SL (no heavy curve like HL)</li>
                            <li>Example: Weighted avg of 91% predicts grade 6, even if trend is slightly down</li>
                          </ul>
                        </div>
                        <div className="text-xs mt-2 space-y-1">
                          <p className="font-medium text-foreground">Both strategies consider:</p>
                          <ul className="list-disc list-inside ml-2 text-muted-foreground">
                            <li><strong>Category Weights:</strong> Exams/IAs influence predictions more than quizzes</li>
                            <li><strong>Contextual Notes:</strong> "Bad day" or illness notes reduce that assessment's impact</li>
                            <li><strong>Recency:</strong> Recent assessments carry more weight (especially for HL)</li>
                          </ul>
                        </div>
                      </div>
                      <p className="text-xs mt-3 text-muted-foreground italic">
                        The AI receives separate, specialized prompts for HL vs SL with different rules and priorities, ensuring predictions match how IB teachers grade each level.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">4️⃣ Automatic Updates & Mathematical Fallback</h4>
                      <div className="text-sm space-y-2">
                        <p>
                          <strong>Smart Triggering:</strong> When you add, edit, or delete an assessment (or modify categories), the subject is marked "dirty." The next time you view it, the AI automatically generates a fresh prediction and caches it.
                        </p>
                        <p>
                          <strong>Fallback Logic:</strong> If AI is unavailable or rate-limited, the app uses a local weighted mathematical prediction:
                        </p>
                        <ul className="list-disc list-inside ml-2 text-xs">
                          <li>HL: weighted_avg_ib_grade → round to nearest integer (1-7)</li>
                          <li>SL: weighted_avg_percentage → convert to IB band using SL boundaries</li>
                        </ul>
                        <p className="text-xs text-muted-foreground italic">
                          This ensures you always have a prediction, even without AI access.
                        </p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">5️⃣ Cost Optimization</h4>
                      <p className="text-sm">
                        To minimize API costs, predictions are cached and only regenerated when data changes. Long notes are trimmed, and we use GPT-3.5-turbo (fast and inexpensive) instead of more expensive models.
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="raw-grades">
              <AccordionTrigger className="text-lg font-semibold">Raw Grades & Percentages</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    When adding assessments, you have two optional fields:
                  </p>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Raw Grade</h4>
                      <p className="text-sm">
                        Enter your actual score in the format "score/total" (e.g., "45/50"). This helps you track your raw performance.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        For SL subjects, this automatically calculates a percentage for grade prediction.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Raw Percent</h4>
                      <p className="text-sm">
                        Enter the percentage score directly (e.g., "85.5"). This is especially useful for HL subjects where raw scores need to be scaled before converting to percentages.
                      </p>
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Note: The IB grade (1-7) is always required. Raw grades and percentages are optional but help provide more detailed tracking.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

      </main>

      <Footer />
    </div>
  );
}

function TrendsView({ subjects, onBack, onShowHelp }: { subjects: Subject[], onBack: () => void, onShowHelp: () => void }) {
  // Calculate trend data: array of {date, predictedGrade, subjectGrades: {[subjectName]: grade}}
  const trendData = calculateTrendData(subjects);

  const [showPredicted, setShowPredicted] = useState(false);
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src="/iblogo.png" alt="IB" className="h-8 w-auto" />
              <h1 className="font-bold text-2xl tracking-tight text-foreground">Tracker</h1>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShowHelp}>
              <Info className="h-4 w-4" />
            </Button>
          </div>
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

      <Footer />
    </div>
  );
}

function calculateTrendData(subjects: Subject[]) {
  // Collect all unique dates from all assessments (normalize to YYYY-MM-DD format)
  const dateMap = new Map<string, boolean>();

  subjects.forEach(subject => {
    subject.assessments.forEach(assessment => {
      // Normalize date to ensure consistency
      const normalizedDate = assessment.date.split('T')[0]; // Remove time if present
      dateMap.set(normalizedDate, true);
    });
  });

  // Sort dates chronologically
  const uniqueDates = Array.from(dateMap.keys()).sort((a, b) =>
    new Date(a).getTime() - new Date(b).getTime()
  );

  // For each unique date, calculate the predicted grade at that point in time
  const trendData: Array<{ date: string, predictedGrade: number, subjectGrades: { [key: string]: number } }> = [];

  uniqueDates.forEach(currentDate => {
    const subjectGrades: { [key: string]: number } = {};
    let totalGrade = 0;
    let subjectsWithGrades = 0;

    // For each subject, calculate its predicted grade up to this date
    subjects.forEach(subject => {
      const assessmentsUpToDate = subject.assessments.filter(a => {
        const assessmentDate = a.date.split('T')[0];
        return new Date(assessmentDate) <= new Date(currentDate);
      });

      if (assessmentsUpToDate.length > 0) {
        const validAssessments = assessmentsUpToDate.filter(a => a.ibGrade !== null && a.ibGrade !== undefined);
        if (validAssessments.length > 0) {
          const avg = Math.round(
            validAssessments.reduce((sum, a) => sum + (a.ibGrade || 0), 0) / validAssessments.length
          );
          subjectGrades[subject.name] = avg;
          totalGrade += avg;
          subjectsWithGrades++;
        }
      }
    });

    // Only include predicted total if all 6 subjects have at least one assessment
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
  const [hoveredDataIndex, setHoveredDataIndex] = useState<number | null>(null);

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

  const padding = { top: 30, right: 30, bottom: 50, left: showYAxis ? 70 : 30 };

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
  const subjectPaths: Array<{ name: string, points: Array<{ x: number, y: number, dataIndex: number }>, color: string }> = [];
  subjects.forEach((subject, subjectIndex) => {
    if (!visibleSubjects.has(subject.name)) return;

    // Get all data points where this subject has a grade
    const points: Array<{ x: number, y: number, dataIndex: number }> = [];
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
      {hoveredDataIndex !== null && (() => {
        const dataPoint = data[hoveredDataIndex];
        const hoveredItems: Array<{ label: string, value: number, color: string }> = [];

        // Collect all values at this data point
        if (showPredicted && dataPoint.predictedGrade > 0) {
          hoveredItems.push({ label: 'Predicted Total', value: dataPoint.predictedGrade, color: '#6366f1' });
        }

        subjects.forEach((subject, subjectIndex) => {
          if (visibleSubjects.has(subject.name) && dataPoint.subjectGrades[subject.name] !== undefined) {
            hoveredItems.push({
              label: subject.name,
              value: dataPoint.subjectGrades[subject.name],
              color: getSubjectColor(subjectIndex)
            });
          }
        });

        if (hoveredItems.length === 0) return null;

        const x = xScale(hoveredDataIndex);

        return (
          <div
            className="absolute bg-foreground text-background px-2 py-1 rounded text-xs font-medium pointer-events-none z-10 space-y-1"
            style={{
              left: `${(x / chartWidth) * 100}%`,
              top: '10%',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold border-b border-background/20 pb-1 mb-1">
              {formatDateForDisplay(dataPoint.date)}
            </div>
            {hoveredItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 whitespace-nowrap">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.label}: {item.value}</span>
              </div>
            ))}
          </div>
        );
      })()}
      <svg width={chartWidth} height={chartHeight} className="max-w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">

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
              x={20}
              y={yScale(label)}
              textAnchor="start"
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
                return (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill={subjectPath.color}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredDataIndex(point.dataIndex)}
                    onMouseLeave={() => setHoveredDataIndex(null)}
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
                onMouseEnter={() => setHoveredDataIndex(point.index)}
                onMouseLeave={() => setHoveredDataIndex(null)}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

function EditSubjectDialog({
  subject,
  open,
  onOpenChange,
  onUpdate
}: {
  subject: Subject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, name: string, type: SubjectType) => void;
}) {
  const [name, setName] = useState(subject.name);
  const [type, setType] = useState<SubjectType>(subject.type);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName(subject.name);
      setType(subject.type);
    }
  }, [open, subject]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name) {
      onUpdate(subject.id, name, type);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Subject</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-subject-name">Subject Name</Label>
            <Input
              id="edit-subject-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Math AA"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-subject-type">Level</Label>
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
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
