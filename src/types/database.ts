export type Subject = {
  id: string
  user_id: string
  name: string
  type: 'HL' | 'SL'
  target_grade: number
  created_at: string
  updated_at: string
}

export type Assessment = {
  id: string
  subject_id: string
  user_id: string
  name: string
  ib_grade: number
  raw_grade: string | null
  raw_percent: number | null
  date: string
  notes: string | null
  created_at: string
  updated_at: string
}
