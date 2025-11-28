# IB Grade Tracker Plan

## Goal
Create a clean, simple website to track IB programme grades with a Notion-inspired UI.

## Features
- **Dashboard**: View predicted grades for all subjects.
- **Subject Detail**: View assignments and tests for each subject.
- **Input**: Easy way to input grades (Score / Total).
- **Logic**: Calculate predicted grades based on IB boundaries.
    - **HL**: 7 (98+), 6 (96+), 5 (90+), 4 (86+), 3 (76+), 2 (50+), 1 (<50) - *User Note: "HUGE SCALING"*
    - **SL**: 7 (96-100), 6 (90-95), 5 (86-89), 4 (76-85), 3 (70-75), 2 (50-69), 1 (0-49)
- **Visuals**: Charts/Graphs for progression (Phase 2).

## Design System
- **Theme**: Notion-like. Minimalist, white background, clear typography.
- **Font**: Sans-serif (Inter/Geist) or Serif for headers if Notion-y.
- **Components**: shadcn/ui.

## Data Structure (Local State for now)
```typescript
type SubjectType = 'HL' | 'SL';

interface Assignment {
  id: string;
  name: string;
  score: number;
  total: number;
  date: string;
}

interface Subject {
  id: string;
  name: string;
  type: SubjectType;
  assignments: Assignment[];
  predictedGrade?: number; // Calculated
}
```

## Implementation Steps
1. **Setup**: Install shadcn/ui.
2. **Components**:
    - Layout (Sidebar/Navbar).
    - Subject Card.
    - Grade Input Form.
    - Grade Display (Badge/Ticker).
3. **Pages**:
    - Home: Dashboard.
    - Subject View: Details.
4. **Refinement**: Animations, styling.
