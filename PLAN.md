# Simulation State
- `workflowStep`: 'GET_TIP' | 'INTAKE_SAMPLE' | 'LOAD_WELL' | 'RUN_GEL' | 'COMPLETE'
- `pipetteLevel`: 0 to 1 (0 = up, 0.7 = soft stop, 1.0 = hard stop)
- `liquidInTip`: 0 to 1 (volume)
- `failureMode`: null | 'PUNCTURE' | 'OVERFLOW' | 'EMPTY_EJECT'
- `isBoxOn`: boolean
