import { createClient } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { Subject, Assessment, SubjectType, Category, Feedback, UserSettings } from './types';
import { Subject as DBSubject, Assessment as DBAssessment } from '@/types/database';

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

// Helper function to ensure we have a valid session
async function ensureSession(client: SupabaseClient): Promise<any> {
    const { data: { session }, error } = await client.auth.getSession();

    if (error) {
        console.error('Session error:', error);
        throw new Error('Failed to get session');
    }

    if (!session) {
        throw new Error('No active session');
    }

    return session;
}

export const api = {
    fetchSubjects: async (client?: SupabaseClient): Promise<Subject[]> => {
        console.log('fetchSubjects: Using provided client or creating new one...');
        const supabase = client || createClient();

        try {
            console.log('fetchSubjects: Querying subjects...');
            const { data, error } = await supabase
                .from('subjects')
                .select(`
        *,
        assessments (*),
        categories (*)
      `)
                .order('created_at', { ascending: true });

            console.log('fetchSubjects: Query complete. Error:', error, 'Data:', data);

            if (error) {
                console.error('Error fetching subjects:', error);
                return [];
            }

            // Map DB types to App types
            return data.map((sub: any) => ({
                id: sub.id,
                name: sub.name,
                type: sub.type as SubjectType,
                aiPredictedGrade: sub.ai_predicted_grade,
                aiExplanation: sub.ai_explanation,
                predictionDirty: sub.prediction_dirty,
                teacher: sub.teacher,
                overrideGrade: sub.override_grade,
                manualPercent: sub.manual_percent,
                isCore: sub.is_core,
                categories: (sub.categories || []).map((cat: any) => ({
                    id: cat.id,
                    name: cat.name,
                    rawWeight: cat.raw_weight
                })),
                assessments: (sub.assessments || []).map((assess: any) => ({
                    id: assess.id,
                    name: assess.name,
                    ibGrade: assess.ib_grade,
                    letterGrade: assess.letter_grade,
                    rawGrade: assess.raw_grade,
                    rawPercent: assess.raw_percent,
                    date: assess.date,
                    notes: assess.notes,
                    categoryId: assess.category_id
                })).sort((a: Assessment, b: Assessment) => new Date(b.date).getTime() - new Date(a.date).getTime())
            }));
        } catch (err) {
            console.error('fetchSubjects: Error getting data:', err);
            return [];
        }
    },

    createSubject: async (name: string, type: SubjectType, client?: SupabaseClient, isCore: boolean = false): Promise<Subject | null> => {
        const supabase = client || createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) return null;

        const { data, error } = await supabase
            .from('subjects')
            .insert({
                user_id: session.user.id,
                name,
                type,
                target_grade: 7,
                is_core: isCore || type === 'CORE'
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating subject:', error);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            type: data.type as SubjectType,
            isCore: data.is_core,
            assessments: [],
            categories: []
        };
    },

    deleteSubject: async (id: string, client?: SupabaseClient): Promise<boolean> => {
        const supabase = client || createClient();
        const { error } = await supabase
            .from('subjects')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting subject:', error);
            return false;
        }
        return true;
    },

    updateSubject: async (id: string, name: string, type: SubjectType, teacher?: string | null, overrideGrade?: number | null, manualPercent?: number | null, client?: SupabaseClient): Promise<Subject | null> => {
        const supabase = client || createClient();
        const updateData: any = { name, type, prediction_dirty: true }; // Mark dirty on update

        // Only update teacher if it's provided (could be null to clear)
        if (teacher !== undefined) {
            updateData.teacher = teacher;
        }

        if (overrideGrade !== undefined) {
            updateData.override_grade = overrideGrade;
        }

        if (manualPercent !== undefined) {
            updateData.manual_percent = manualPercent;
        }

        const { data, error } = await supabase
            .from('subjects')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating subject:', error);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            type: data.type as SubjectType,
            teacher: data.teacher,
            overrideGrade: data.override_grade,
            manualPercent: data.manual_percent,
            isCore: data.is_core,
            assessments: [], // We don't need to return assessments here
            categories: []
        };
    },

    createAssessment: async (subjectId: string, assessment: Omit<Assessment, 'id'>, client?: SupabaseClient): Promise<Assessment | null> => {
        const supabase = client || createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) return null;

        const { data, error } = await supabase
            .from('assessments')
            .insert({
                subject_id: subjectId,
                user_id: session.user.id,
                name: assessment.name,
                ib_grade: assessment.ibGrade,
                letter_grade: assessment.letterGrade,
                raw_grade: assessment.rawGrade,
                raw_percent: assessment.rawPercent,
                date: assessment.date,
                notes: assessment.notes,
                category_id: assessment.categoryId
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating assessment:', error);
            return null;
        }

        // Mark subject as dirty
        await supabase.from('subjects').update({ prediction_dirty: true }).eq('id', subjectId);

        return {
            id: data.id,
            name: data.name,
            ibGrade: data.ib_grade,
            letterGrade: data.letter_grade,
            rawGrade: data.raw_grade,
            rawPercent: data.raw_percent,
            date: data.date,
            notes: data.notes,
            categoryId: data.category_id
        };
    },

    updateAssessment: async (id: string, assessment: Omit<Assessment, 'id'>, client?: SupabaseClient): Promise<Assessment | null> => {
        const supabase = client || createClient();

        // Get subject_id first to mark dirty
        const { data: existing } = await supabase.from('assessments').select('subject_id').eq('id', id).single();

        const { data, error } = await supabase
            .from('assessments')
            .update({
                name: assessment.name,
                ib_grade: assessment.ibGrade,
                letter_grade: assessment.letterGrade,
                raw_grade: assessment.rawGrade,
                raw_percent: assessment.rawPercent,
                date: assessment.date,
                notes: assessment.notes,
                category_id: assessment.categoryId
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating assessment:', error);
            return null;
        }

        if (existing) {
            await supabase.from('subjects').update({ prediction_dirty: true }).eq('id', existing.subject_id);
        }

        return {
            id: data.id,
            name: data.name,
            ibGrade: data.ib_grade,
            letterGrade: data.letter_grade,
            rawGrade: data.raw_grade,
            rawPercent: data.raw_percent,
            date: data.date,
            notes: data.notes,
            categoryId: data.category_id
        };
    },

    deleteAssessment: async (id: string, client?: SupabaseClient): Promise<boolean> => {
        const supabase = client || createClient();

        // Get subject_id first to mark dirty
        const { data: existing } = await supabase.from('assessments').select('subject_id').eq('id', id).single();

        const { error } = await supabase
            .from('assessments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting assessment:', error);
            return false;
        }

        if (existing) {
            await supabase.from('subjects').update({ prediction_dirty: true }).eq('id', existing.subject_id);
        }

        return true;
    },

    // Category Methods

    createCategory: async (subjectId: string, name: string, rawWeight: number, client?: SupabaseClient): Promise<Category | null> => {
        const supabase = client || createClient();

        try {
            // Refresh session first to avoid stale session issues
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                console.error('Session error:', sessionError);
                return null;
            }

            console.log('Creating category with session:', session.user.id);

            const { data, error } = await supabase
                .from('categories')
                .insert({
                    subject_id: subjectId,
                    user_id: session.user.id,
                    name,
                    raw_weight: rawWeight
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating category:', error);
                console.error('Error details:', JSON.stringify({
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint
                }, null, 2));
                return null;
            }

            if (!data) {
                console.error('No data returned from category insert');
                return null;
            }

            console.log('Category created successfully:', data);

            // Mark subject dirty (don't await - run in background)
            supabase.from('subjects').update({ prediction_dirty: true }).eq('id', subjectId)
                .then(() => console.log('Subject marked dirty'))
                .catch((err: any) => console.warn('Failed to mark subject dirty:', err));

            return {
                id: data.id,
                name: data.name,
                rawWeight: data.raw_weight
            };
        } catch (err) {
            console.error('Exception in createCategory:', err);
            if (err instanceof Error) {
                console.error('Error message:', err.message);
                console.error('Error stack:', err.stack);
            }
            return null;
        }
    },

    updateCategory: async (id: string, name: string, rawWeight: number, client?: SupabaseClient): Promise<Category | null> => {
        const supabase = client || createClient();

        try {
            console.log('Updating category:', id, 'with weight:', rawWeight);

            // Get subject_id first
            const { data: existing } = await supabase.from('categories').select('subject_id').eq('id', id).single();

            if (!existing) {
                console.error('Category not found:', id);
                return null;
            }

            console.log('Found category, subject_id:', existing.subject_id);

            const { data, error } = await supabase
                .from('categories')
                .update({ name, raw_weight: rawWeight })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error updating category:', error);
                return null;
            }

            console.log('Category updated successfully:', data);

            // Mark subject dirty
            const { error: dirtyError } = await supabase
                .from('subjects')
                .update({ prediction_dirty: true })
                .eq('id', existing.subject_id);

            if (dirtyError) {
                console.error('Error marking subject dirty:', dirtyError);
            } else {
                console.log('Subject marked dirty:', existing.subject_id);
            }

            return {
                id: data.id,
                name: data.name,
                rawWeight: data.raw_weight
            };
        } catch (err) {
            console.error('Exception in updateCategory:', err);
            return null;
        }
    },

    deleteCategory: async (id: string, client?: SupabaseClient): Promise<boolean> => {
        const supabase = client || createClient();

        const { data: existing } = await supabase.from('categories').select('subject_id').eq('id', id).single();

        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting category:', error);
            return false;
        }

        if (existing) {
            await supabase.from('subjects').update({ prediction_dirty: true }).eq('id', existing.subject_id);
        }

        return true;
    },

    predictGrade: async (subject: Subject, assessments: Assessment[], categories: Category[]) => {
        try {
            const response = await fetch('/api/predict-grade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ subject, assessments, categories }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch prediction');
            }

            return await response.json();
        } catch (error) {
            console.error('Error predicting grade:', error);
            return null;
        }
    },

    // Feedback Methods

    fetchFeedback: async (client?: SupabaseClient): Promise<Feedback[]> => {
        const supabase = client || createClient();

        try {
            console.log('fetchFeedback: Starting query...');
            const { data, error } = await supabase
                .from('feedback')
                .select('*')
                .order('created_at', { ascending: false });

            console.log('fetchFeedback: Query complete. Error:', error, 'Data count:', data?.length);

            if (error) {
                console.error('Error fetching feedback:', error);
                return [];
            }

            if (!data) {
                console.log('fetchFeedback: No data returned');
                return [];
            }

            const mapped = data.map((fb: any) => ({
                id: fb.id,
                userId: fb.user_id,
                userEmail: fb.user_email,
                content: fb.content,
                type: fb.type,
                createdAt: fb.created_at
            }));

            console.log('fetchFeedback: Returning', mapped.length, 'items');
            return mapped;
        } catch (err) {
            console.error('Exception in fetchFeedback:', err);
            if (err instanceof Error) {
                console.error('Error details:', err.message, err.stack);
            }
            return [];
        }
    },

    createFeedback: async (content: string, type: 'feedback' | 'feature', client?: SupabaseClient): Promise<Feedback | null> => {
        const supabase = client || createClient();

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                console.error('Session error:', sessionError);
                return null;
            }

            const { data, error } = await supabase
                .from('feedback')
                .insert({
                    user_id: session.user.id,
                    user_email: session.user.email,
                    content,
                    type
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating feedback:', error);
                return null;
            }

            return {
                id: data.id,
                userId: data.user_id,
                userEmail: data.user_email,
                content: data.content,
                type: data.type,
                createdAt: data.created_at
            };
        } catch (err) {
            console.error('Exception in createFeedback:', err);
            return null;
        }
    },

    // User Settings Methods
    fetchUserSettings: async (client?: SupabaseClient): Promise<UserSettings | null> => {
        const supabase = client || createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching user settings:', error);
            return null;
        }

        if (!data) {
            // Create default settings if not exists
            const { data: newData, error: createError } = await supabase
                .from('user_settings')
                .insert({ user_id: session.user.id, include_bonus: false })
                .select()
                .single();
            
            if (createError) return null;
            return {
                includeBonus: newData.include_bonus,
                totalScoreOverride: newData.total_score_override,
                totalPercentOverride: newData.total_percent_override
            };
        }

        return {
            includeBonus: data.include_bonus,
            totalScoreOverride: data.total_score_override,
            totalPercentOverride: data.total_percent_override
        };
    },

    updateUserSettings: async (settings: Partial<UserSettings>, client?: SupabaseClient): Promise<UserSettings | null> => {
        const supabase = client || createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        const updateData: any = {};
        if (settings.includeBonus !== undefined) updateData.include_bonus = settings.includeBonus;
        if (settings.totalScoreOverride !== undefined) updateData.total_score_override = settings.totalScoreOverride;
        if (settings.totalPercentOverride !== undefined) updateData.total_percent_override = settings.totalPercentOverride;

        const { data, error } = await supabase
            .from('user_settings')
            .upsert({ user_id: session.user.id, ...updateData }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) {
            console.error('Error updating user settings:', error);
            if (error.code === '42P01') {
              console.error('HINT: The "user_settings" table likely does not exist. Please run the SQL migration in supabase-bonus-migration.sql');
            }
            return null;
        }
        
        return {
            includeBonus: data.include_bonus,
            totalScoreOverride: data.total_score_override,
            totalPercentOverride: data.total_percent_override
        };
    }
};
