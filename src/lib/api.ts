import { createClient } from './supabase';
import { Subject, Assignment, SubjectType } from './types';
import { Subject as DBSubject, Assignment as DBAssignment } from '@/types/database';

export const api = {
    fetchSubjects: async (): Promise<Subject[]> => {
        const supabase = createClient();
        const { data: user } = await supabase.auth.getUser();

        if (!user.user) return [];

        const { data, error } = await supabase
            .from('subjects')
            .select(`
        *,
        assignments (*)
      `)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching subjects:', error);
            return [];
        }

        // Map DB types to App types
        return data.map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            type: sub.type as SubjectType,
            assignments: (sub.assignments || []).map((assign: any) => ({
                id: assign.id,
                name: assign.name,
                ibGrade: assign.ib_grade,
                rawGrade: assign.raw_grade,
                rawPercent: assign.raw_percent,
                date: assign.date,
            })).sort((a: Assignment, b: Assignment) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }));
    },

    createSubject: async (name: string, type: SubjectType): Promise<Subject | null> => {
        const supabase = createClient();
        const { data: user } = await supabase.auth.getUser();

        if (!user.user) return null;

        const { data, error } = await supabase
            .from('subjects')
            .insert({
                user_id: user.user.id,
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
            assignments: []
        };
    },

    deleteSubject: async (id: string): Promise<boolean> => {
        const supabase = createClient();
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

    updateSubject: async (id: string, name: string, type: SubjectType): Promise<Subject | null> => {
        const supabase = createClient();
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
            assignments: [] // We don't need to return assignments here as we are just updating the subject details
        };
    },

    createAssignment: async (subjectId: string, assignment: Omit<Assignment, 'id'>): Promise<Assignment | null> => {
        const supabase = createClient();
        const { data: user } = await supabase.auth.getUser();

        if (!user.user) return null;

        const { data, error } = await supabase
            .from('assignments')
            .insert({
                subject_id: subjectId,
                user_id: user.user.id,
                name: assignment.name,
                ib_grade: assignment.ibGrade,
                raw_grade: assignment.rawGrade,
                raw_percent: assignment.rawPercent,
                date: assignment.date,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating assignment:', error);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            ibGrade: data.ib_grade,
            rawGrade: data.raw_grade,
            rawPercent: data.raw_percent,
            date: data.date
        };
    },

    updateAssignment: async (id: string, assignment: Omit<Assignment, 'id'>): Promise<Assignment | null> => {
        const supabase = createClient();

        const { data, error } = await supabase
            .from('assignments')
            .update({
                name: assignment.name,
                ib_grade: assignment.ibGrade,
                raw_grade: assignment.rawGrade,
                raw_percent: assignment.rawPercent,
                date: assignment.date,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating assignment:', error);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            ibGrade: data.ib_grade,
            rawGrade: data.raw_grade,
            rawPercent: data.raw_percent,
            date: data.date
        };
    },

    deleteAssignment: async (id: string): Promise<boolean> => {
        const supabase = createClient();
        const { error } = await supabase
            .from('assignments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting assignment:', error);
            return false;
        }
        return true;
    }
};
