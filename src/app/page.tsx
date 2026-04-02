"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Trash2, ChevronRight, TrendingUp, Home as HomeIcon, Pencil, Info, Mail, RefreshCw, MessageSquare, Menu, ArrowUpDown, SlidersHorizontal, Eye, EyeOff, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Subject, Assessment, SubjectType, UserSettings, BONUS_POINTS_MATRIX, calculatePercentage, getGrade, calculateRawPercent, percentToIBGrade, parseRawGrade, calculatePredictedGrade, getSubjectLetterGrade } from "@/lib/types";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import Auth from "@/components/Auth";
import { ManageCategoriesDialog } from "@/components/ManageCategoriesDialog";
import { calculateLocalPrediction } from "@/lib/prediction";
import { getTeacherConfig, getAllTeachers } from "@/lib/teachers";

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
function Footer({ onShowChangelog }: { onShowChangelog?: () => void }) {
  return (
    <footer className="bg-background py-4 mt-auto">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Diwen Huang</span>
          {onShowChangelog && (
            <>
              <span>·</span>
              <button onClick={onShowChangelog} className="hover:text-foreground transition-colors">
                Changelog
              </button>
            </>
          )}
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
  const [hideMainScore, setHideMainScore] = useState(false);
  const [hideTotalPercent, setHideTotalPercent] = useState(false);
  const [hiddenSubjects, setHiddenSubjects] = useState<Set<string>>(new Set());
  const [showChangelog, setShowChangelog] = useState(false);
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>({ includeBonus: false });

  useEffect(() => {
    try {
      const savedHideMain = localStorage.getItem('ib_tracker_hideMainScore');
      if (savedHideMain !== null) setHideMainScore(JSON.parse(savedHideMain));
      
      const savedHiddenSubjects = localStorage.getItem('ib_tracker_hiddenSubjects');
      if (savedHiddenSubjects !== null) setHiddenSubjects(new Set(JSON.parse(savedHiddenSubjects)));
    } catch (e) {
      console.error('Failed to load hidden state from local storage', e);
    }
    setHasLoadedSavedState(true);
  }, []);

  useEffect(() => {
    if (hasLoadedSavedState) {
      try {
        localStorage.setItem('ib_tracker_hideMainScore', JSON.stringify(hideMainScore));
        localStorage.setItem('ib_tracker_hiddenSubjects', JSON.stringify(Array.from(hiddenSubjects)));
      } catch (e) {
        console.error('Failed to save hidden state to local storage', e);
      }
    }
  }, [hideMainScore, hiddenSubjects, hasLoadedSavedState]);

  const supabase = createClient();

  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [selectedSubjectForCategories, setSelectedSubjectForCategories] = useState<Subject | null>(null);

  const loadSubjects = async () => {
    console.log('loadSubjects: Starting...');
    try {
      const [subjectsData, settingsData] = await Promise.all([
        api.fetchSubjects(supabase),
        api.fetchUserSettings(supabase)
      ]);
      console.log('loadSubjects: Got data:', subjectsData);
      setSubjects(subjectsData);
      if (settingsData) setUserSettings(settingsData);
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

  const toggleBonus = async (checked: boolean | string) => {
    const newIncludeBonus = checked === true;
    
    // Save previous state for rollback if needed
    const prevSettings = userSettings;
    const prevSubjects = subjects;
    
    // Optimistically update UI
    setUserSettings(prev => ({ ...prev, includeBonus: newIncludeBonus }));
    
    // Perform background update
    api.updateUserSettings({ includeBonus: newIncludeBonus }, supabase).then(async (updated) => {
      if (!updated) {
        // Rollback on failure
        setUserSettings(prevSettings);
        console.error('Failed to update bonus settings');
        return;
      }
      
      // If enabling, ensure core subjects exist in background
      if (newIncludeBonus) {
        const hasTok = subjects.some(s => s.name.toLowerCase().includes('tok') || s.name.toLowerCase().includes('theory of knowledge'));
        const hasEe = subjects.some(s => s.name.toLowerCase().includes('ee') || s.name.toLowerCase().includes('extended essay'));
        
        const creations: Promise<any>[] = [];
        if (!hasTok) creations.push(api.createSubject('Theory of Knowledge', 'CORE', supabase, true));
        if (!hasEe) creations.push(api.createSubject('Extended Essay', 'CORE', supabase, true));
        
        if (creations.length > 0) {
          const results = await Promise.all(creations);
          const newSubjects = results.filter(Boolean);
          if (newSubjects.length > 0) {
            setSubjects(prev => [...prev, ...newSubjects]);
          }
        }
      }
    });
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
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

  const updateSubject = async (id: string, name: string, type: SubjectType, teacher?: string | null, overrideGrade?: number | null, manualPercent?: number | null) => {
    // If switching to a teacher with specific categories, handle category reset
    const teacherConfig = getTeacherConfig(teacher || null);
    if (teacherConfig) {
      const subject = subjects.find(s => s.id === id);
      if (subject) {
        // Delete all existing categories
        for (const category of subject.categories) {
          await api.deleteCategory(category.id, supabase);
        }

        // Clear category assignments from all assessments
        for (const assessment of subject.assessments) {
          if (assessment.categoryId) {
            await api.updateAssessment(assessment.id, { ...assessment, categoryId: null }, supabase);
          }
        }

        // Create teacher-specific categories
        for (const cat of teacherConfig.categories) {
          await api.createCategory(id, cat.name, cat.weight, supabase);
        }
      }
    }

    const updated = await api.updateSubject(id, name, type, teacher, overrideGrade, manualPercent, supabase);
    if (updated) {
      // Reload all subjects to get updated categories and assessments
      await loadSubjects();
    }
  };

  const addAssessment = async (subjectId: string, assessment: Omit<Assessment, 'id'>) => {
    const newAssessment = await api.createAssessment(subjectId, assessment, supabase);
    if (newAssessment) {
      setSubjects(prev => prev.map(s => s.id === subjectId ? { 
        ...s, 
        assessments: [newAssessment, ...s.assessments],
        predictionDirty: true 
      } : s));
    }
  };

  const updateAssessment = async (subjectId: string, assessmentId: string, updatedAssessment: Omit<Assessment, 'id'>) => {
    const updated = await api.updateAssessment(assessmentId, updatedAssessment, supabase);
    if (updated) {
      setSubjects(prev => prev.map(s => s.id === subjectId ? {
        ...s,
        assessments: s.assessments.map(a => a.id === assessmentId ? updated! : a),
        predictionDirty: true
      } : s));
    }
  };

  const deleteAssessment = async (subjectId: string, assessmentId: string) => {
    const success = await api.deleteAssessment(assessmentId, supabase);
    if (success) {
      setSubjects(prev => prev.map(s => s.id === subjectId ? {
        ...s,
        assessments: s.assessments.filter(a => a.id !== assessmentId),
        predictionDirty: true
      } : s));
    }
  };

  // Calculate total predicted grade
  const regularSubjects = subjects.filter(s => !s.isCore).slice(0, 6);
  const coreSubjects = subjects.filter(s => s.isCore);
  const tokSubject = coreSubjects.find(s => s.name.toLowerCase().includes('tok') || s.name.toUpperCase() === 'TOK');
  const eeSubject = coreSubjects.find(s => s.name.toLowerCase().includes('ee') || s.name.toUpperCase() === 'EE' || s.name.toLowerCase().includes('extended essay'));

  const getSubjectGrade = (subject: Subject) => {
    // Check for manual override first
    if (subject.overrideGrade !== undefined && subject.overrideGrade !== null) {
      return subject.overrideGrade;
    }

    if (subject.assessments.length === 0) return 0;

    // Check for teacher-specific calculation
    const teacherConfig = getTeacherConfig(subject.teacher || null);
    const teacherCalculation = teacherConfig?.calculateGrade
      ? teacherConfig.calculateGrade(subject, subject.assessments)
      : null;

    if (teacherCalculation) {
      return teacherCalculation.grade;
    }

    // Use local prediction
    const localPrediction = calculateLocalPrediction(subject, subject.assessments, subject.categories || []);
    const basicGrade = calculatePredictedGrade(subject.assessments);

    return localPrediction?.grade || basicGrade;
  };

  const subjectsTotal = regularSubjects.reduce((total, subject) => {
    return total + getSubjectGrade(subject);
  }, 0);

  let bonusPoints = 0;
  if (userSettings.includeBonus && tokSubject && eeSubject) {
    const tokGrade = getSubjectLetterGrade(tokSubject);
    const eeGrade = getSubjectLetterGrade(eeSubject);
    bonusPoints = (tokGrade !== 'N' && eeGrade !== 'N') ? (BONUS_POINTS_MATRIX[tokGrade]?.[eeGrade] ?? 0) : 0;
  }

  const totalPredicted = userSettings.totalScoreOverride ?? (subjectsTotal + bonusPoints);
  const maxPoints = userSettings.includeBonus ? 45 : 42;

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

  const totalWeightedPercentage = (() => {
    const activeSubjects = subjects.filter(s => {
      const isCore = s.type === 'CORE' || s.isCore;
      if (isCore) return s.manualPercent !== null && s.manualPercent !== undefined;
      return s.assessments.length > 0 || s.manualPercent !== null || s.overrideGrade !== null;
    });

    if (activeSubjects.length === 0) return 0;

    const sum = activeSubjects.reduce((acc, s) => {
      if (s.manualPercent !== null && s.manualPercent !== undefined) return acc + s.manualPercent;
      
      const midpoints: Record<number, number> = {
        7: 98, 6: 92, 5: 87, 4: 80, 3: 72, 2: 60, 1: 30
      };
      
      if (s.overrideGrade !== null && s.overrideGrade !== undefined) {
        return acc + (midpoints[s.overrideGrade as number] || 0);
      }

      const localPred = calculateLocalPrediction(s, s.assessments, s.categories || []);
      return acc + (localPred?.percentage ?? 0);
    }, 0);

    return sum / activeSubjects.length;
  })();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Show auth screen if not logged in
  if (!session) {
    return <Auth onLogin={() => { loadSubjects(); }} />;
  }

  // Trends view
  if (showTrends) {
    return <TrendsView key={JSON.stringify(subjects)} subjects={subjects} onBack={() => setShowTrends(false)} onShowHelp={() => setShowHelp(true)} supabase={supabase} />;
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
      <header className="bg-background/20 backdrop-blur-sm border-b border-border/10">
        <div className="container mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <img src="/iblogo.png" alt="IB" className="h-6 w-auto" />
              <h1 className="font-bold text-xl tracking-tighter text-foreground">Tracker</h1>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHelp(true)}>
              <Info className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-2">
            <Button variant="outline" onClick={() => setShowTrends(true)}>
              <TrendingUp className="mr-2 h-4 w-4" />
              View Trends
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/feedback'}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Feedback
            </Button>
            <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </Button>
          </div>

          {/* Mobile Navigation */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="md:hidden h-10 w-10 inline-flex items-center justify-center">
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full border-none p-0 [&>button]:!h-10 [&>button]:!w-10 [&>button>svg]:!h-6 [&>button>svg]:!w-6 [&>button]:!top-[24px] [&>button]:!right-[calc(50vw-640px+16px)] [&>button]:hover:bg-transparent [&>button]:hover:opacity-70 max-[1280px]:[&>button]:!right-4">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex flex-col gap-1 p-8 pt-12">
                <button
                  onClick={() => setShowTrends(true)}
                  className="text-left text-2xl font-medium py-3 px-4 rounded-md outline-none"
                >
                  View Trends
                </button>
                <button
                  onClick={() => window.location.href = '/feedback'}
                  className="text-left text-2xl font-medium py-3 px-4 rounded-md outline-none"
                >
                  Feedback
                </button>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="text-left text-2xl font-medium py-3 px-4 rounded-md outline-none"
                >
                  Sign Out
                </button>
                <button
                  onClick={() => setShowChangelog(true)}
                  className="text-left text-2xl font-medium py-3 px-4 rounded-md outline-none text-muted-foreground"
                >
                  Changelog
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 min-h-0 overflow-hidden">
        <section className="group relative flex flex-col items-center justify-center mb-2">
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] opacity-30">Predicted Total</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-[8.5rem] font-bold leading-none px-2 ${hideMainScore ? 'text-muted-foreground/30' : `bg-gradient-to-br ${getTotalColor(totalPredicted)} bg-clip-text text-transparent`}`}>
              {hideMainScore ? '●●' : totalPredicted}
            </span>
            <span className={`text-3xl font-medium ${hideMainScore ? 'text-muted-foreground/20' : 'text-muted-foreground opacity-20'}`}>{hideMainScore ? '/●●' : `/${maxPoints}`}</span>
            
            <button
              type="button"
              className="absolute -right-10 self-center flex items-center justify-center h-7 w-7 rounded-full border border-border/40 text-muted-foreground/60 hover:text-foreground hover:border-border transition-all opacity-0 group-hover:opacity-100 bg-background/50 backdrop-blur-sm"
              onClick={() => {
                setHideMainScore(!hideMainScore);
              }}
              title={hideMainScore ? 'Show score' : 'Hide score'}
            >
              {hideMainScore ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>
          
          <div className="group relative mt-1">
            <div className={`text-[11px] font-medium tracking-widest uppercase transition-all duration-300 ${hideTotalPercent ? 'text-muted-foreground/10' : 'text-muted-foreground/40'}`}>
              <span className="mr-2">AVG PERCENT:</span>
              <span className="font-bold font-mono">{hideTotalPercent ? '●●.●' : totalWeightedPercentage.toFixed(1)}%</span>
            </div>
            <button
              type="button"
              className="absolute -right-6 top-1/2 -translate-y-1/2 flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground/20 hover:text-muted-foreground transition-all opacity-0 group-hover:opacity-100"
              onClick={() => setHideTotalPercent(!hideTotalPercent)}
              title={hideTotalPercent ? 'Show average' : 'Hide average'}
            >
              {hideTotalPercent ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
            </button>
          </div>
        </section>

        {/* Subject Grades Grid - 2 per row, transparent */}
        <section className="w-full max-w-2xl">
          <div className="grid grid-cols-2 gap-x-12 gap-y-3">
            {regularSubjects.map((subject) => {
              // Use local prediction for weighted percentage (respects category weights)
              const localPred = calculateLocalPrediction(subject, subject.assessments, subject.categories || []);

              let rawPercentage = 0;
              if (localPred?.percentage !== undefined) {
                rawPercentage = localPred.percentage;
              } else if (localPred && subject.type === 'SL') {
                // Fallback for old cached predictions?
                rawPercentage = parseFloat(localPred.details.match(/(\d+\.?\d*)%/)?.[1] || '0');
              } else {
                rawPercentage = calculatePercentage(subject.assessments, subject.type);
              }

              // Use manual percent if available, otherwise use prediction
              const percentage = subject.manualPercent ?? (subject.type === 'SL' ? Math.round(rawPercentage) : rawPercentage);
              const grade = calculatePredictedGrade(subject.assessments);

              return (
                <SubjectGradeCard
                  key={subject.id}
                  subject={subject}
                  grade={grade}
                  percentage={percentage}
                  hideScores={hiddenSubjects.has(subject.id)}
                  onToggleHide={() => {
                    setHiddenSubjects(prev => {
                      const next = new Set(prev);
                      if (next.has(subject.id)) {
                        next.delete(subject.id);
                      } else {
                        next.add(subject.id);
                      }
                      return next;
                    });
                  }}
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

          {userSettings.includeBonus && (
            <div className="mt-4 border-t border-border/10 pt-4">
              <h3 className="text-center text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em] mb-2 font-medium italic">Bonus Points</h3>
              <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                {coreSubjects.map((subject) => {
                  const percentage = subject.manualPercent ?? 0;
                  const grade = 0; // Not used for CORE
                  const nameLower = subject.name.toLowerCase();
                  const displayName = nameLower === 'tok' ? 'Theory of Knowledge' : (nameLower === 'ee' ? 'Extended Essay' : subject.name);

                  return (
                    <SubjectGradeCard
                      key={subject.id}
                      subject={subject}
                      grade={grade}
                      percentage={percentage}
                      hideScores={hiddenSubjects.has(subject.id)}
                      onToggleHide={() => {
                        setHiddenSubjects(prev => {
                          const next = new Set(prev);
                          if (next.has(subject.id)) {
                            next.delete(subject.id);
                          } else {
                            next.add(subject.id);
                          }
                          return next;
                        });
                      }}
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
            </div>
          )}
        </section>
      </main>

      <footer className="py-2 border-t border-border/10 bg-background/50">
        <div className="container mx-auto px-6 flex justify-between items-center opacity-30 hover:opacity-100 transition-opacity">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">© 2026 IB Tracker</p>
          <button onClick={() => setShowChangelog(true)} className="text-[9px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer">Changelog</button>
        </div>
      </footer>

      {/* Mini Bonus Toggle in corner - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center space-x-2 bg-background/80 backdrop-blur-sm p-2 rounded-lg border border-border/50 opacity-40 hover:opacity-100 transition-opacity">
        <Checkbox
          id="bonus-mode-small"
          checked={userSettings.includeBonus}
          onCheckedChange={toggleBonus}
        />
        <Label htmlFor="bonus-mode-small" className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest cursor-pointer select-none">
          Bonus
        </Label>
      </div>

      {/* Changelog Dialog */}
      <Dialog open={showChangelog} onOpenChange={setShowChangelog}>
        <DialogContent className="sm:max-w-md max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Changelog
            </DialogTitle>
            <DialogDescription>Notable updates and features</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { date: 'Apr 1, 2026', changes: [
                'Unified dashboard fonts and refined layout',
                'Added Bonus Points matrix (TOK/EE) to help page',
                'Standardized labels (Theory of Knowledge & Extended Essay)',
                'Optimistic UI for instant bonus toggle',
                'Fixed redundant calculation lines in teacher-specific views',
              ]},
              { date: 'Feb 21, 2026', changes: [
                'Score hide/show toggle for privacy',
                'Allow 0-weight categories (excluded from grade)',
                'Sort & filter assessments by date, grade, or name',
              ]},
              { date: 'Feb 20, 2026', changes: [
                'Improved prediction logic and authentication flow',
              ]},
              { date: 'Dec 11, 2025', changes: [
                'Updated HL grade boundary estimation',
                'Fixed weight normalization for categories',
              ]},
              { date: 'Dec 10, 2025', changes: [
                'Manual grade override feature',
                'Updated Next.js to fix security vulnerability',
              ]},
              { date: 'Dec 3, 2025', changes: [
                'Teacher-specific grading support',
                'UI restyling',
              ]},
              { date: 'Nov 30, 2025', changes: [
                'Feedback page',
                'Mobile responsiveness improvements',
                'Forgot password flow',
              ]},
              { date: 'Nov 29, 2025', changes: [
                'Initial launch with AI-powered grade predictions',
                'Assessment tracking with categories & weights',
                'Trends view for grade history',
              ]},
            ].map((entry) => (
              <div key={entry.date}>
                <p className="text-xs font-medium text-muted-foreground mb-1">{entry.date}</p>
                <ul className="space-y-0.5">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <span className="text-muted-foreground/60">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {selectedSubjectForCategories && manageCategoriesOpen && (
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
  hideScores,
  onToggleHide,
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
  hideScores: boolean;
  onToggleHide: () => void;
  onAddAssessment: (sid: string, assessment: Omit<Assessment, 'id'>) => void;
  onUpdateAssessment: (sid: string, aid: string, assessment: Omit<Assessment, 'id'>) => void;
  onDeleteAssessment: (sid: string, aid: string) => void;
  onUpdateSubject: (id: string, name: string, type: SubjectType, teacher?: string | null, overrideGrade?: number | null, manualPercent?: number | null) => void;
  onManageCategories: (subject: Subject) => void;
  onRefresh: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [showTeacherConfirm, setShowTeacherConfirm] = useState(false);
  const [pendingTeacher, setPendingTeacher] = useState<string | null>(null);
  const [isConfirmingTeacher, setIsConfirmingTeacher] = useState(false);

  // Sorting & filtering state
  const [sortBy, setSortBy] = useState<'date' | 'grade' | 'name'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showSortFilter, setShowSortFilter] = useState(false);

  const sortedFilteredAssessments = useMemo(() => {
    let list = [...subject.assessments];

    // Filter by category
    if (filterCategory !== 'all') {
      if (filterCategory === 'uncategorized') {
        list = list.filter(a => !a.categoryId);
      } else {
        list = list.filter(a => a.categoryId === filterCategory);
      }
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') {
        cmp = a.date.localeCompare(b.date);
      } else if (sortBy === 'grade') {
        cmp = (a.ibGrade ?? 0) - (b.ibGrade ?? 0);
      } else if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [subject.assessments, sortBy, sortDir, filterCategory]);

  const handleTeacherChange = (value: string) => {
    const newTeacher = value === 'general' ? null : value;
    const currentTeacherConfig = getTeacherConfig(subject.teacher || null);

    // If switching TO a teacher with specific categories
    const teacherConfig = getTeacherConfig(newTeacher);
    if (teacherConfig && (subject.categories.length > 0 || subject.assessments.length > 0)) {
      setPendingTeacher(newTeacher);
      setShowTeacherConfirm(true);
    }
    // If switching FROM a teacher back to general
    else if (!newTeacher && currentTeacherConfig && subject.assessments.length > 0) {
      setPendingTeacher(newTeacher);
      setShowTeacherConfirm(true);
    }
    // Otherwise, just update directly
    else {
      onUpdateSubject(subject.id, subject.name, subject.type, newTeacher, subject.overrideGrade);
    }
  };

  const confirmTeacherChange = async () => {
    if (pendingTeacher !== undefined && !isConfirmingTeacher) {
      setIsConfirmingTeacher(true);
      try {
        await onUpdateSubject(subject.id, subject.name, subject.type, pendingTeacher, subject.overrideGrade);
        setShowTeacherConfirm(false);
        setPendingTeacher(null);
      } finally {
        setIsConfirmingTeacher(false);
      }
    }
  };

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
  // Skip AI prediction if teacher-specific grading is enabled
  useEffect(() => {
    const hasTeacher = !!subject.teacher;
    if (subject.predictionDirty && !isPredicting && subject.assessments.length > 0 && !hasTeacher) {
      setIsPredicting(true);
      api.predictGrade(subject, subject.assessments, subject.categories || [])
        .then((result) => {
          if (result) {
            onRefresh(); // This reloads all subjects, updating the total score
          }
        })
        .finally(() => setIsPredicting(false));
    }
  }, [subject.predictionDirty, subject.id, subject.teacher]);

  // Force recalculation on mount for all subjects (page refresh)
  // Skip AI prediction if teacher-specific grading is enabled
  useEffect(() => {
    const hasTeacher = !!subject.teacher;
    if (subject.assessments.length > 0 && !isPredicting && !hasTeacher) {
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

  // Check for teacher-specific calculation first
  const teacherConfig = getTeacherConfig(subject.teacher || null);
  const teacherCalculation = teacherConfig?.calculateGrade
    ? teacherConfig.calculateGrade(subject, subject.assessments)
    : null;

  // Calculate local exact mathematical prediction
  const localPrediction = calculateLocalPrediction(subject, subject.assessments, subject.categories || []);

  // Determine which prediction to show
  // Priority: Teacher calculation > Local exact calculation
  let displayGrade: number;
  let displayPercentage: number;
  let isTeacher = false;
  let isOverride = false;
  let predictionDetails: string | undefined;

  if (subject.overrideGrade !== undefined && subject.overrideGrade !== null) {
    displayGrade = subject.overrideGrade;
    displayPercentage = subject.manualPercent ?? teacherCalculation?.percentage ?? localPrediction?.percentage ?? percentage;
    predictionDetails = `Manual Grade Override (Predicted: ${teacherCalculation?.grade ?? localPrediction?.grade ?? grade})`;
    // Prefer teacher-specific breakdown, fall back to local prediction details
    const calculationDetails = teacherCalculation?.explanation || localPrediction?.details;
    if (calculationDetails) predictionDetails += ` • ${calculationDetails}`;
    isOverride = true;
  } else if (subject.manualPercent !== undefined && subject.manualPercent !== null) {
    displayPercentage = subject.manualPercent;
    displayGrade = getGrade(displayPercentage, subject.type);
    predictionDetails = `Manual Percentage Override (Exact: ${teacherCalculation?.percentage?.toFixed(1) ?? localPrediction?.percentage?.toFixed(1) ?? percentage.toFixed(1)}%)`;
    // Prefer teacher-specific breakdown, fall back to local prediction details
    const calculationDetails = teacherCalculation?.explanation || localPrediction?.details;
    if (calculationDetails) predictionDetails += ` • ${calculationDetails}`;
    isOverride = true;
  } else if (teacherCalculation) {
    // Use teacher-specific calculation
    displayGrade = teacherCalculation.grade;
    displayPercentage = teacherCalculation.percentage;
    predictionDetails = teacherCalculation.explanation;
    isTeacher = true;
  } else {
    // For both SL and HL subjects, use exact local mathematical grade calculation
    displayGrade = localPrediction?.grade || grade;
    displayPercentage = localPrediction?.percentage ?? percentage;
    predictionDetails = localPrediction?.details;
  }

  const isCore = subject.type === 'CORE' || subject.isCore;
  const displayLetterGrade = isCore ? getSubjectLetterGrade(subject) : null;

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
          <div className="flex flex-col items-center space-y-1">
            <div className="relative inline-flex items-center justify-center">
              <span className={`${isCore ? 'text-2xl' : 'text-5xl'} font-semibold ${subject.assessments.length === 0 ? 'text-muted-foreground/30 font-medium' : hideScores ? 'text-muted-foreground/40' : getGradeColor(isCore ? 7 : displayGrade)}`}>
                {subject.assessments.length === 0 ? '-' : hideScores ? '●' : isCore ? displayLetterGrade : displayGrade}
              </span>
              <button
                type="button"
                className="absolute -right-7 flex items-center justify-center h-4.5 w-4.5 rounded-full text-muted-foreground/30 hover:text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onToggleHide(); }}
                title={hideScores ? 'Show score' : 'Hide score'}
              >
                {hideScores ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
              </button>
            </div>
            <div className="text-center -mt-1">
              <p className={`${isCore ? 'text-[12px] opacity-70' : 'text-[15px] font-medium'} text-foreground/80`}>
                {subject.name.toLowerCase() === 'tok' ? 'Theory of Knowledge' : (subject.name.toLowerCase() === 'ee' ? 'Extended Essay' : subject.name)}
              </p>
              <p className={`${isCore ? 'text-[8px] opacity-30' : 'text-[9px] text-muted-foreground/40'} leading-tight`}>
                {subject.assessments.length === 0 ? 'No data' : hideScores ? '●●%' : `${isCore ? `${displayLetterGrade || 'N'}` : `${displayPercentage.toFixed(0)}% • ${subject.type}`}`}
                {isTeacher && subject.teacher && ` • ${subject.teacher.toUpperCase()}`}
              </p>
            </div>
            {isPredicting && <span className="text-[10px] text-muted-foreground animate-pulse">Updating...</span>}
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl p-4 sm:p-6 max-h-[75vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-6 sm:pr-8">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {subject.name} {!isCore && `(${subject.type})`}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-transparent active:bg-transparent border-none outline-none focus-visible:ring-0 ring-0"
                onClick={() => setIsEditingSubject(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-transparent active:bg-transparent"
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
                    <span>Predicted Grade: <strong>{isCore ? displayLetterGrade : displayGrade}</strong> {!isCore && displayPercentage > 0 && `(${displayPercentage.toFixed(1)}%)`}</span>
                    {isTeacher && subject.teacher && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded">{subject.teacher.toUpperCase()}</span>}
                    {isOverride && <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded">Manual</span>}
                  </div>
                  {predictionDetails && (
                    <div className="text-xs text-muted-foreground mt-2 space-y-1 bg-muted/30 p-2 rounded-md border border-border/50">
                      {predictionDetails.split(' • ').map((detail, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-muted-foreground/50">•</span>
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
 
        {/* Core Manual Percentage Input */}
        {isCore && (
          <div className="mx-6 my-2 p-3 bg-muted/20 border border-border/50 rounded-lg">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Manual Grade Entry</p>
                <p className="text-[10px] text-muted-foreground/40 italic">Type your percentage to update your grade</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="any"
                  value={subject.manualPercent ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : parseFloat(e.target.value);
                    onUpdateSubject(subject.id, subject.name, subject.type, subject.teacher, subject.overrideGrade, val);
                  }}
                  placeholder="Enter %"
                  className="h-8 w-24 text-right text-sm font-mono bg-background border-border/50"
                />
                <span className="text-xs font-medium text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        )}

        {/* Teacher Note */}
        {(() => {
          const teacherConfig = getTeacherConfig(subject.teacher || null);
          if (teacherConfig) {
            if (teacherConfig.id === 'Greenwood') {
              return (
                <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
                  <p className="text-muted-foreground">
                    <strong>{teacherConfig.displayName}:</strong> {teacherConfig.note}
                  </p>
                </div>
              );
            }
            return (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                <p className="text-blue-900 dark:text-blue-100">
                  <strong>{teacherConfig.displayName}:</strong> {teacherConfig.note}
                </p>
              </div>
            );
          }
          return null;
        })()}

        <div className="space-y-4 py-2 sm:py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-medium">Assessments</h3>
            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
              <Select
                value={subject.teacher || 'general'}
                onValueChange={handleTeacherChange}
              >
                <SelectTrigger className="h-8 w-auto min-w-[120px] sm:min-w-[140px] font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Algorithm</SelectItem>
                  {getAllTeachers().map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onManageCategories(subject)}
                className="flex-1 sm:flex-none"
              >
                <TrendingUp className="h-3 w-3 mr-2" />
                Categories
              </Button>
              <AddAssessmentDialog subject={subject} onAdd={onAddAssessment} />
            </div>
          </div>

          {/* Sort & Filter Toggle */}
          {subject.assessments.length > 0 && (
            <div>
              <button
                type="button"
                className="text-xs text-primary hover:text-primary/80 underline underline-offset-2 cursor-pointer bg-transparent border-none p-0"
                onClick={() => setShowSortFilter(v => !v)}
              >
                {showSortFilter ? 'Hide sort & filter' : 'Sort & filter'}
              </button>
              {showSortFilter && (
                <div className="flex flex-wrap items-center gap-2 text-xs mt-2">
                  {/* Sort By */}
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'grade' | 'name')}>
                      <SelectTrigger className="h-7 w-auto min-w-[80px] text-xs px-2 py-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="grade">Grade</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                      title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      <span className="text-[10px] font-mono">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    </Button>
                  </div>

                  {/* Filter by Category */}
                  <div className="flex items-center gap-1">
                    <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="h-7 w-auto min-w-[90px] text-xs px-2 py-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="uncategorized">Uncategorized</SelectItem>
                        {subject.categories?.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reset button */}
                  {(sortBy !== 'date' || sortDir !== 'desc' || filterCategory !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                      onClick={() => { setSortBy('date'); setSortDir('desc'); setFilterCategory('all'); }}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {subject.assessments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No assessments yet</p>
          ) : sortedFilteredAssessments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No assessments match the selected filter</p>
          ) : (
            <div className="space-y-2">
              {sortedFilteredAssessments.map((assessment) => {
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
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors cursor-pointer gap-2 sm:gap-4"
                    onClick={() => setEditingAssessment(assessment)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{assessment.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{formatDateForDisplay(assessment.date)}</span>
                        {assessment.categoryId && (
                          <span className="bg-secondary px-1.5 rounded text-[10px] truncate max-w-[100px]">
                            {subject.categories?.find(c => c.id === assessment.categoryId)?.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto mt-1 sm:mt-0">
                      <div className="flex items-center gap-2 sm:gap-4 text-sm">
                        {displayRawGrade && (
                          <span className="text-muted-foreground whitespace-nowrap">
                            {displayRawGrade}
                          </span>
                        )}
                        {displayPercent > 0 && (
                          <span className="font-medium whitespace-nowrap">
                            {displayPercent.toFixed(0)}%
                          </span>
                        )}
                        <span className="font-medium whitespace-nowrap">
                          {isCore ? `Grade: ${assessment.letterGrade || (assessment.ibGrade ? (assessment.ibGrade >= 7 ? 'A' : assessment.ibGrade >= 6 ? 'B' : 'C') : 'N')}` : `IB: ${displayGrade}`}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 ml-2"
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

        {/* Teacher Change Confirmation Dialog */}
        <Dialog open={showTeacherConfirm} onOpenChange={setShowTeacherConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pendingTeacher ? 'Switch to Teacher-Specific Grading?' : 'Switch to General Algorithm?'}
              </DialogTitle>
              <DialogDescription>
                {pendingTeacher ? (
                  <>Selecting {pendingTeacher} will:</>
                ) : (
                  <>Switching back to General Algorithm will:</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2 text-sm">
                {pendingTeacher ? (
                  <>
                    <p className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      <span>Delete all existing categories</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      <span>Create teacher-specific categories</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      <span>Remove category assignments from all assessments</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-yellow-600">•</span>
                      <span>You&apos;ll need to reassign categories to your assessments</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">Categories cannot be edited under teacher-specific grading</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="flex items-start gap-2">
                      <span className="text-yellow-600">•</span>
                      <span>Keep teacher-specific categories (Tests, Labs, etc.)</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-yellow-600">•</span>
                      <span>Categories will remain assigned to assessments</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-blue-600">•</span>
                      <span>You can now edit and manage categories freely</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">If you switch back to {subject.teacher}, you&apos;ll need to reassign categories to all assessments</span>
                    </p>
                  </>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowTeacherConfirm(false)} disabled={isConfirmingTeacher}>
                Cancel
              </Button>
              <Button
                variant={pendingTeacher ? "destructive" : "default"}
                onClick={confirmTeacherChange}
                disabled={isConfirmingTeacher}
              >
                {isConfirmingTeacher ? 'Loading...' : 'Continue'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog >
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
  const [letterGrade, setLetterGrade] = useState<string>("");
  const [open, setOpen] = useState(false);
  
  const isCore = subject.type === 'CORE' || subject.isCore;

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
      setLetterGrade("");
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
      letterGrade: letterGrade || null,
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
      <DialogContent className="sm:max-w-[425px] p-4 sm:p-6 max-h-[75vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Add Assessment for {subject.name}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Enter the details of your assessment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 sm:py-4">
          <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0">
            <Label htmlFor="name" className="text-sm sm:text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3 text-sm h-9"
              placeholder="e.g. Unit 1 Test"
              required
            />
          </div>

          <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0">
            <Label htmlFor="category" className="text-sm sm:text-right">
              Category
            </Label>
            <div className="col-span-3">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-9 text-sm">
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

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {isCore ? (
              <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0 sm:col-span-2">
                <Label htmlFor="letterGrade" className="text-sm sm:text-right sm:col-span-1">
                  Grade
                </Label>
                <div className="col-span-3">
                  <Select value={letterGrade} onValueChange={setLetterGrade}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="A-E" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="E">E</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0 sm:col-span-2">
                <Label htmlFor="ibGrade" className="text-sm sm:text-right sm:col-span-1">
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
                    className="text-sm h-9"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0 sm:col-span-2">
              <Label htmlFor="rawGrade" className="text-sm sm:text-right sm:col-span-1">
                Raw Score
              </Label>
              <Input
                id="rawGrade"
                value={rawGrade}
                onChange={(e) => setRawGrade(e.target.value)}
                className="col-span-3 text-sm h-9"
                placeholder="e.g. 31/32"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0 sm:col-span-2">
              <Label htmlFor="rawPercent" className="text-sm sm:text-right sm:col-span-1">
                Percent
              </Label>
              <Input
                id="rawPercent"
                type="number"
                step="any"
                value={rawPercent}
                onChange={(e) => handlePercentChange(e.target.value)}
                className="col-span-3 text-sm h-9"
                placeholder="%"
              />
            </div>

            <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0 sm:col-span-2">
              <Label htmlFor="date" className="text-sm sm:text-right sm:col-span-1">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="col-span-3 text-sm h-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0">
            <Label htmlFor="notes" className="text-sm sm:text-right">
              Notes
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3 text-sm h-9"
              placeholder="Add any notes..."
            />
          </div>

          <DialogFooter>
            <Button type="submit" className="h-9 text-sm">Add Assessment</Button>
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
  const [letterGrade, setLetterGrade] = useState<string>(assessment.letterGrade || "");
  
  const isCore = subject.type === 'CORE' || subject.isCore;

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

  // Autosave logic
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!open) return;

    // Skip the initial render - no changes have been made yet
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (name && (ibGrade || rawPercent || rawGrade || letterGrade)) {
        onUpdate({
          name,
          ibGrade: ibGrade ? parseInt(ibGrade) : null,
          letterGrade: letterGrade || null,
          rawGrade: rawGrade || null,
          rawPercent: rawPercent ? parseFloat(rawPercent) : null,
          date,
          notes: notes || null,
          categoryId: categoryId === "uncategorized" ? null : categoryId
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [name, ibGrade, letterGrade, rawGrade, rawPercent, date, notes, categoryId, open, onUpdate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-4 sm:p-6 max-h-[75vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Edit Assessment</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Update the details of your assessment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 sm:py-4">
          <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0">
            <Label htmlFor="edit-name" className="text-sm sm:text-right">
              Name
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3 text-sm h-9"
              required
            />
          </div>

          <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0">
            <Label htmlFor="edit-category" className="text-sm sm:text-right">
              Category
            </Label>
            <div className="col-span-3">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-9 text-sm">
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

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {isCore ? (
              <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0 sm:col-span-2">
                <Label htmlFor="edit-letterGrade" className="text-sm sm:text-right sm:col-span-1">
                  Grade
                </Label>
                <div className="col-span-3">
                  <Select value={letterGrade} onValueChange={setLetterGrade}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="A-E" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="E">E</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0 sm:col-span-2">
                <Label htmlFor="edit-ibGrade" className="text-sm sm:text-right sm:col-span-1">
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
                    className="text-sm h-9"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0 sm:col-span-2">
              <Label htmlFor="edit-rawGrade" className="text-sm sm:text-right sm:col-span-1">
                Raw Score
              </Label>
              <Input
                id="edit-rawGrade"
                value={rawGrade}
                onChange={(e) => setRawGrade(e.target.value)}
                className="col-span-3 text-sm h-9"
                placeholder="e.g. 31/32"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0 sm:col-span-2">
              <Label htmlFor="edit-rawPercent" className="text-sm sm:text-right sm:col-span-1">
                Percent
              </Label>
              <Input
                id="edit-rawPercent"
                type="number"
                step="any"
                value={rawPercent}
                onChange={(e) => handlePercentChange(e.target.value)}
                className="col-span-3 text-sm h-9"
                placeholder="%"
              />
            </div>

            <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0 sm:col-span-2">
              <Label htmlFor="edit-date" className="text-sm sm:text-right sm:col-span-1">
                Date
              </Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="col-span-3 text-sm h-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4 sm:space-y-0">
            <Label htmlFor="edit-notes" className="text-sm sm:text-right">
              Notes
            </Label>
            <Input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3 text-sm h-9"
              placeholder="Add any notes..."
            />
          </div>

          <div className="pt-2 text-center">
            <p className="text-[10px] text-muted-foreground/40 italic">Changes are saved automatically</p>
          </div>
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
            <h2 className="text-xl font-semibold mb-4">welcome to IB tracker!!!</h2>
            <p className="text-muted-foreground">
              i made this website to visualize and log my IB grades because i'm failing. let's fail together 🫡
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

            <AccordionItem value="bonus-matrix">
              <AccordionTrigger className="text-lg font-semibold">Bonus Points Matrix (TOK & EE)</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    TOK and Extended Essay (EE) combine to award up to 3 bonus points. Use this table to find your score:
                  </p>
                  
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="p-2 text-left border-r border-border font-bold">TOK / EE</th>
                          <th className="p-2 text-center border-r border-border font-bold text-green-600">A</th>
                          <th className="p-2 text-center border-r border-border font-bold text-lime-600">B</th>
                          <th className="p-2 text-center border-r border-border font-bold text-yellow-600">C</th>
                          <th className="p-2 text-center border-r border-border font-bold text-orange-600">D</th>
                          <th className="p-2 text-center font-bold text-red-600">E</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border">
                          <td className="p-2 font-bold bg-muted/20 border-r border-border text-center">A</td>
                          <td className="p-2 text-center border-r border-border bg-green-500/10 font-bold">3</td>
                          <td className="p-2 text-center border-r border-border bg-green-500/10 font-bold">3</td>
                          <td className="p-2 text-center border-r border-border bg-lime-500/10">2</td>
                          <td className="p-2 text-center border-r border-border bg-lime-500/10">2</td>
                          <td rowSpan={4} className="p-2 text-center bg-red-500/20 text-red-800 font-bold text-[10px] leading-tight uppercase align-middle">Failing Condition</td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="p-2 font-bold bg-muted/20 border-r border-border text-center">B</td>
                          <td className="p-2 text-center border-r border-border bg-green-500/10 font-bold">3</td>
                          <td className="p-2 text-center border-r border-border bg-lime-500/10">2</td>
                          <td className="p-2 text-center border-r border-border bg-lime-500/10">2</td>
                          <td className="p-2 text-center border-r border-border bg-yellow-500/10">1</td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="p-2 font-bold bg-muted/20 border-r border-border text-center">C</td>
                          <td className="p-2 text-center border-r border-border bg-lime-500/10">2</td>
                          <td className="p-2 text-center border-r border-border bg-lime-500/10">2</td>
                          <td className="p-2 text-center border-r border-border bg-yellow-500/10">1</td>
                          <td className="p-2 text-center border-r border-border bg-orange-500/5">0</td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="p-2 font-bold bg-muted/20 border-r border-border text-center">D</td>
                          <td className="p-2 text-center border-r border-border bg-lime-500/10">2</td>
                          <td className="p-2 text-center border-r border-border bg-yellow-500/10">1</td>
                          <td className="p-2 text-center border-r border-border bg-orange-500/5">0</td>
                          <td className="p-2 text-center border-r border-border bg-orange-500/5">0</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold bg-muted/20 border-r border-border text-center">E</td>
                          <td colSpan={5} className="p-2 text-center bg-red-500/20 text-red-800 font-bold text-[10px] leading-tight uppercase">Failing Condition</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                    <p className="text-red-700/80 text-[11px] leading-relaxed italic text-center">
                      Note: A grade E in either the Extended Essay or Theory of Knowledge will result in an IB Diploma not being awarded.
                    </p>
                  </div>
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

function TrendsView({ subjects, onBack, onShowHelp, supabase }: { subjects: Subject[], onBack: () => void, onShowHelp: () => void, supabase: any }) {
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
              <Badge variant="secondary" className="text-xs">BETA</Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShowHelp}>
              <Info className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-2">
            <Button variant="outline" onClick={onBack}>
              <HomeIcon className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          {/* Mobile Navigation */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="md:hidden h-10 w-10 inline-flex items-center justify-center">
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full border-none p-0 [&>button]:!h-10 [&>button]:!w-10 [&>button>svg]:!h-6 [&>button>svg]:!w-6 [&>button]:!top-[24px] [&>button]:!right-[calc(50vw-640px+16px)] [&>button]:hover:bg-transparent [&>button]:hover:opacity-70 max-[1280px]:[&>button]:!right-4">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex flex-col gap-1 p-8 pt-12">
                <button
                  onClick={onBack}
                  className="text-left text-2xl font-medium py-3 px-4 rounded-md outline-none"
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => window.location.href = '/feedback'}
                  className="text-left text-2xl font-medium py-3 px-4 rounded-md outline-none"
                >
                  Feedback
                </button>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="text-left text-2xl font-medium py-3 px-4 rounded-md outline-none"
                >
                  Sign Out
                </button>
              </div>
            </SheetContent>
          </Sheet>
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

  const onlySubjects = !showPredicted && visibleSubjects.size > 0;
  const onlyPredicted = showPredicted && visibleSubjects.size === 0;
  const showYAxis = onlySubjects || onlyPredicted;

  const padding = { top: 30, right: 30, bottom: 50, left: showYAxis ? 70 : 30 };

  // Dynamic Y-axis: find actual min/max from data
  let dataMin = Infinity;
  let dataMax = -Infinity;

  data.forEach(point => {
    if (showPredicted && point.predictedGrade > 0) {
      dataMin = Math.min(dataMin, point.predictedGrade);
      dataMax = Math.max(dataMax, point.predictedGrade);
    }
    visibleSubjects.forEach(subjectName => {
      if (point.subjectGrades[subjectName] !== undefined) {
        dataMin = Math.min(dataMin, point.subjectGrades[subjectName]);
        dataMax = Math.max(dataMax, point.subjectGrades[subjectName]);
      }
    });
  });

  // Apply dynamic range with padding
  let yMin: number, yMax: number;
  if (onlyPredicted) {
    const range = dataMax - dataMin;
    const pad = Math.max(range * 0.3, 2);
    yMin = Math.max(0, Math.floor(dataMin - pad));
    yMax = Math.min(45, Math.ceil(dataMax + pad));
  } else if (onlySubjects) {
    const range = dataMax - dataMin;
    const pad = Math.max(range * 0.4, 0.5);
    yMin = Math.max(1, Math.floor(dataMin - pad));
    yMax = Math.min(7, Math.ceil(dataMax + pad));
  } else {
    const range = dataMax - dataMin;
    const pad = Math.max(range * 0.3, 1);
    yMin = Math.max(0, Math.floor(dataMin - pad));
    yMax = Math.ceil(dataMax + pad);
  }

  const xScale = (index: number) => {
    if (data.length === 1) return chartWidth / 2;
    return padding.left + (index / (data.length - 1)) * (chartWidth - padding.left - padding.right);
  };

  const yScale = (value: number) => {
    return chartHeight - padding.bottom - ((value - yMin) / (yMax - yMin)) * (chartHeight - padding.top - padding.bottom);
  };

  const bottomY = chartHeight - padding.bottom;

  // Catmull-Rom to cubic Bézier smooth path
  function smoothPath(points: Array<{ x: number; y: number }>): string {
    if (points.length < 2) return '';
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    const tension = 0.3;
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return d;
  }

  // Build a closed area path for gradient fill
  function areaPath(points: Array<{ x: number; y: number }>): string {
    if (points.length < 2) return '';
    const linePath = smoothPath(points);
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    return `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;
  }

  // Predicted points
  const predictedPoints = showPredicted ? data.map((point, index) => ({
    x: xScale(index),
    y: yScale(point.predictedGrade),
    value: point.predictedGrade,
    index,
  })).filter(p => p.value > 0) : [];

  // Subject paths
  const subjectPaths: Array<{ name: string, points: Array<{ x: number, y: number, dataIndex: number }>, color: string, subjectIndex: number }> = [];
  subjects.forEach((subject, subjectIndex) => {
    if (!visibleSubjects.has(subject.name)) return;

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
      subjectIndex,
    });
  });

  // Y-axis labels
  function generateYLabels(): number[] {
    const labels: number[] = [];
    if (onlyPredicted) {
      const step = Math.max(1, Math.round((yMax - yMin) / 6));
      for (let i = yMin; i <= yMax; i += step) labels.push(i);
      if (labels[labels.length - 1] !== yMax) labels.push(yMax);
    } else if (onlySubjects) {
      for (let i = Math.ceil(yMin); i <= Math.floor(yMax); i++) labels.push(i);
    }
    return labels;
  }

  return (
    <div className="w-full flex justify-center relative">
      {hoveredDataIndex !== null && (() => {
        const dataPoint = data[hoveredDataIndex];
        const hoveredItems: Array<{ label: string, value: number, color: string }> = [];

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
        <defs>
          {/* Gradient fills for each subject */}
          {subjectPaths.map((sp) => (
            <linearGradient key={`grad-${sp.name}`} id={`grad-${sp.subjectIndex}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sp.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={sp.color} stopOpacity="0" />
            </linearGradient>
          ))}
          {/* Predicted gradient */}
          {showPredicted && (
            <linearGradient id="grad-predicted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          )}
        </defs>

        {/* Horizontal grid lines */}
        {showYAxis && generateYLabels().map((label) => (
          <line
            key={`grid-${label}`}
            x1={padding.left}
            y1={yScale(label)}
            x2={chartWidth - padding.right}
            y2={yScale(label)}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeDasharray="4 4"
          />
        ))}

        {/* Y-axis labels */}
        {showYAxis && generateYLabels().map((label) => (
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
        ))}

        {/* X-axis labels */}
        {(() => {
          const maxLabels = 8;
          const step = Math.max(1, Math.ceil(data.length / maxLabels));
          return data.map((point, index) => {
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

        {/* Subject area fills + smooth lines */}
        {subjectPaths.map((subjectPath) => {
          const lineD = smoothPath(subjectPath.points);
          const fillD = areaPath(subjectPath.points);

          return (
            <g key={subjectPath.name}>
              {/* Gradient fill area */}
              {subjectPath.points.length > 1 && (
                <path
                  d={fillD}
                  fill={`url(#grad-${subjectPath.subjectIndex})`}
                />
              )}
              {/* Smooth line */}
              {subjectPath.points.length > 1 && (
                <path
                  d={lineD}
                  fill="none"
                  stroke={subjectPath.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* Points */}
              {subjectPath.points.map((point, index) => (
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
              ))}
            </g>
          );
        })}

        {/* Predicted line - draw on top */}
        {showPredicted && predictedPoints.length > 0 && (
          <g>
            {/* Gradient fill */}
            {predictedPoints.length > 1 && (
              <path
                d={areaPath(predictedPoints)}
                fill="url(#grad-predicted)"
              />
            )}
            {/* Smooth line */}
            {predictedPoints.length > 1 && (
              <path
                d={smoothPath(predictedPoints)}
                fill="none"
                stroke="#6366f1"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* Points */}
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
  onUpdate: (id: string, name: string, type: SubjectType, teacher?: string | null, overrideGrade?: number | null, manualPercent?: number | null) => void;
}) {
  const [name, setName] = useState(subject.name);
  const [type, setType] = useState<SubjectType>(subject.type);
  const [teacher, setTeacher] = useState<string>(subject.teacher || '');
  const [overrideGrade, setOverrideGrade] = useState<string>(subject.overrideGrade?.toString() || '');
  const [manualPercent, setManualPercent] = useState<string>(subject.manualPercent?.toString() || '');
  
  const isCore = subject.type === 'CORE' || subject.isCore;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName(subject.name);
      setType(subject.type);
      setTeacher(subject.teacher || '');
      setOverrideGrade(subject.overrideGrade?.toString() || '');
      setManualPercent(subject.manualPercent?.toString() || '');
    }
  }, [open, subject]);

  // Autosave logic
  useEffect(() => {
    if (!open) return;
    
    const timer = setTimeout(() => {
      if (name) {
        const grade = overrideGrade ? parseInt(overrideGrade) : null;
        const percent = manualPercent ? parseFloat(manualPercent) : null;
        onUpdate(subject.id, name, type, teacher || null, grade, percent);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [name, type, teacher, overrideGrade, manualPercent, open, subject.id, onUpdate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenChange(false);
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
            <Select value={type} onValueChange={(v) => setType(v as SubjectType)} disabled={isCore}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HL">Higher Level (HL)</SelectItem>
                <SelectItem value="SL">Standard Level (SL)</SelectItem>
                <SelectItem value="CORE">CORE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className={isCore ? "block" : "grid grid-cols-2 gap-4"}>
            <div className={isCore ? "hidden" : "space-y-2"}>
              <Label htmlFor="edit-subject-override">Override Grade (1-7)</Label>
              <Input
                id="edit-subject-override"
                type="number"
                min="1"
                max="7"
                value={overrideGrade}
                onChange={e => setOverrideGrade(e.target.value)}
                placeholder="Manual grade"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subject-manual-percent">{isCore ? "Manual Grade Percentage (%)" : "Override Percent (%)"}</Label>
              <Input
                id="edit-subject-manual-percent"
                type="number"
                step="any"
                value={manualPercent}
                onChange={e => setManualPercent(e.target.value)}
                placeholder={isCore ? "Enter your actual grade percentage..." : "Manual percent"}
              />
              {isCore && (
                <p className="text-[10px] text-muted-foreground opacity-50 mt-1">
                  For Core subjects, the grade (A-E) is estimated based on this percentage.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-subject-teacher">Teacher</Label>
            <Select value={teacher || 'general'} onValueChange={(v) => setTeacher(v === 'general' ? '' : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Algorithm</SelectItem>
                {getAllTeachers().map(teacher => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Set a teacher for subject-specific grade prediction
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-subject-override">Manual Grade Override</Label>
            <Input
              id="edit-subject-override"
              type="number"
              min="1"
              max="7"
              value={overrideGrade}
              onChange={e => setOverrideGrade(e.target.value)}
              placeholder="Leave empty to use calculated grade"
            />
            <p className="text-xs text-muted-foreground">
              Force a specific grade (1-7) regardless of assessments
            </p>
          </div>
          <div className="pt-2 text-center">
            <p className="text-[10px] text-muted-foreground/40 italic">Changes are saved automatically</p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
