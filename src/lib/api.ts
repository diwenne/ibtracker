import { createClient } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { Subject, Assessment, SubjectType } from './types';
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

        // If client was provided, we assume it's already configured/authenticated
        // But we still need to check if there's a user for RLS? 
        // Actually, let's just try to query. If RLS fails, it returns error.
        // However, the original code returned [] if no session.

        try {
            // Only check session if we created a new client OR if we want to be sure
            // But checking session is what caused the timeout.
            // Let's try to get session ONLY if we don't have a client passed in?
            // No, the client passed in is just the object.

            // Let's use getUser instead of getSession - it's lighter? No.
            // Let's just trust the query.

            console.log('fetchSubjects: Querying subjects...');
            const { data, error } = await supabase
                .from('subjects')
                .select(`
        *,
        assessments (*)
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
                assessments: (sub.assessments || []).map((assess: any) => ({
                    id: assess.id,
                    name: assess.name,
                    ibGrade: assess.ib_grade,
                    rawGrade: assess.raw_grade,
                    rawPercent: assess.raw_percent,
                    date: assess.date,
                    notes: assess.notes,
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
                target_grade: 7 // Default, not really used in UI yet
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
            assessments: []
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
            .update({ name, type })
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
            assessments: [] // We don't need to return assessments here as we are just updating the subject details
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
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating assessment:', error);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            ibGrade: data.ib_grade,
            rawGrade: data.raw_grade,
            rawPercent: data.raw_percent,
            date: data.date,
            notes: data.notes,
        };
    },

    updateAssessment: async (id: string, assessment: Omit<Assessment, 'id'>, client?: SupabaseClient): Promise<Assessment | null> => {
        const supabase = client || createClient();

        const { data, error } = await supabase
            .from('assessments')
            .update({
                name: assessment.name,
                ib_grade: assessment.ibGrade,
                raw_grade: assessment.rawGrade,
                raw_percent: assessment.rawPercent,
                date: assessment.date,
                notes: assessment.notes,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating assessment:', error);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            ibGrade: data.ib_grade,
            rawGrade: data.raw_grade,
            rawPercent: data.raw_percent,
            date: data.date,
            notes: data.notes,
        };
    },

    deleteAssessment: async (id: string, client?: SupabaseClient): Promise<boolean> => {
        const supabase = client || createClient();
        const { error } = await supabase
            .from('assessments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting assessment:', error);
            return false;
        }
        return true;
    }
};
