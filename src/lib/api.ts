import { createClient } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { Subject, Assessment, SubjectType, Category } from './types';
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
                categories: (sub.categories || []).map((cat: any) => ({
                    id: cat.id,
                    name: cat.name,
                    rawWeight: cat.raw_weight
                })),
                assessments: (sub.assessments || []).map((assess: any) => ({
                    id: assess.id,
                    name: assess.name,
                    ibGrade: assess.ib_grade,
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

    createSubject: async (name: string, type: SubjectType, client?: SupabaseClient): Promise<Subject | null> => {
        const supabase = client || createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) return null;

        const { data, error } = await supabase
            .from('subjects')
            .insert({
                user_id: session.user.id,
                name,
                type,
                target_grade: 7
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

    updateSubject: async (id: string, name: string, type: SubjectType, client?: SupabaseClient): Promise<Subject | null> => {
        const supabase = client || createClient();
        const { data, error } = await supabase
            .from('subjects')
            .update({ name, type, prediction_dirty: true }) // Mark dirty on update
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
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) return null;

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
            return null;
        }

        await supabase.from('subjects').update({ prediction_dirty: true }).eq('id', subjectId);

        return {
            id: data.id,
            name: data.name,
            rawWeight: data.raw_weight
        };
    },

    updateCategory: async (id: string, name: string, rawWeight: number, client?: SupabaseClient): Promise<Category | null> => {
        const supabase = client || createClient();

        // Get subject_id first
        const { data: existing } = await supabase.from('categories').select('subject_id').eq('id', id).single();

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

        if (existing) {
            await supabase.from('subjects').update({ prediction_dirty: true }).eq('id', existing.subject_id);
        }

        return {
            id: data.id,
            name: data.name,
            rawWeight: data.raw_weight
        };
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
    }
};
