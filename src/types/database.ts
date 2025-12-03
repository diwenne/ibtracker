export type Subject = {
  id: string
  user_id: string
  name: string
  type: 'HL' | 'SL'
  target_grade: number
  ai_predicted_grade: number | null
  ai_explanation: string | null
  prediction_dirty: boolean
  teacher: string | null
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  user_id: string
  subject_id: string
  name: string
  raw_weight: number
  created_at: string
  updated_at: string
}

export type Assessment = {
  id: string
  subject_id: string
  user_id: string
  name: string
  ib_grade: number | null
  raw_grade: string | null
  raw_percent: number | null
  date: string
  notes: string | null
  category_id: string | null
  created_at: string
  updated_at: string
}

export type Feedback = {
  id: string
  user_id: string
  user_email: string | null
  content: string
  type: 'feedback' | 'feature'
  created_at: string
}
