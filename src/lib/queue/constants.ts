/**
 * Appointment type weight multipliers.
 *
 * Applied to the moving-average base consultation time to produce
 * a per-patient time estimate that reflects visit complexity.
 *
 * Calibration rationale:
 *   NEW_PATIENT    — full history taking, first exam          → +30%
 *   REPORT_CHECK   — doctor reviews results, brief discussion → −30%
 *   FOLLOW_UP      — known patient, focused discussion        → baseline
 *   EMERGENCY      — complex assessment, possible referral    → +60%
 */
export const APPOINTMENT_TYPE_WEIGHTS: Record<string, number> = {
  NEW_PATIENT:  1.3,
  REPORT_CHECK: 0.7,
  FOLLOW_UP:    1.0,
  EMERGENCY:    1.6,
} as const;

/**
 * How many recent completed consultations to include in the moving average.
 * A smaller window adapts faster to the doctor's current pace.
 */
export const MOVING_AVERAGE_WINDOW = 10;

/**
 * Minimum duration (minutes) a consultation can be estimated at,
 * regardless of weight. Prevents degenerate zero-estimates.
 */
export const MIN_CONSULTATION_MINS = 2;
