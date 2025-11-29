# AI-Based IB Predicted Grades Implementation Plan

This plan summarizes the steps to implement the AI-enhanced predicted grades feature for the IB Tracker app.

## Phase 1: Database & Data Model
- [x] **Schema Update**:
    - [x] Create `categories` table (id, user_id, name, raw_weight).
    - [x] Add `category_id` to `assessments` table.
    - [x] Add `prediction_dirty`, `ai_predicted_grade`, `ai_explanation` to `subjects` table.
- [x] **Type Definitions**: Update `src/types/database.ts` to include new tables and fields.

## Phase 2: Core Logic & Utilities
- [x] **Weight Normalization**: Implement logic to normalize category weights per subject.
- [x] **Canonical Score**: Implement helper to determine the score to use (HL: IB grade, SL: raw % or converted IB grade).
- [x] **Local Prediction Engine**:
    - [x] Implement weighted average calculation for HL (IB grade based).
    - [x] Implement weighted average calculation for SL (Percentage based).
    - [x] Implement fallback logic.

## Phase 3: UI Implementation
    - [ ] Show "Updating..." indicator.

## Phase 4: AI Integration (Gemini)
- [ ] **Backend API**: Create an API route (e.g., `/api/predict-grade`) to handle AI requests securely.
- [ ] **Prompt Engineering**: Construct the prompt with subject info, weighted assessments, notes, and local baseline.
- [ ] **Trigger Logic**:
    - [ ] Check `prediction_dirty` flag on subject load.
    - [ ] Call AI if dirty, update DB, clear dirty flag.
    - [ ] Mark dirty when assessments/weights change.

## Phase 5: Documentation
- [ ] **Info Page**: Update the Info/Help page with details on how predictions work (Weighted, HL vs SL, AI).

## Phase 6: Testing & Refinement
- [ ] Test with HL subject (trend focus).
- [ ] Test with SL subject (math focus).
- [ ] Verify fallback when AI fails.
