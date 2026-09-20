export interface QueueItem {
  id: string;
  tokenNumber: number;
  patientName: string;
  visitType: 'NEW' | 'FOLLOW_UP' | 'REPORT';
  status: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'NO_SHOW';
  estimatedTime?: string;
}

const VISIT_MULTIPLIERS = {
  NEW: 1.4,      // ~14 mins default
  FOLLOW_UP: 1.0,// ~10 mins default
  REPORT: 0.6,   // ~6 mins default
};

export function calculateQueueEstimates(
  queue: QueueItem[],
  completedDurations: number[] = [12, 9, 11] // Default baseline sample
): QueueItem[] {
  const alpha = 0.3;
  const baseDuration = completedDurations.length > 0
    ? completedDurations.reduce((acc, val) => alpha * val + (1 - alpha) * acc, 10)
    : 10;

  let cumulativeDelayMinutes = 0;
  const now = new Date();

  return queue.map((item) => {
    if (item.status === 'COMPLETED' || item.status === 'NO_SHOW') {
      return { ...item, estimatedTime: 'Done' };
    }

    if (item.status === 'IN_CONSULTATION') {
      return { ...item, estimatedTime: 'In Progress' };
    }

    const estimatedSlotLength = baseDuration * VISIT_MULTIPLIERS[item.visitType];
    cumulativeDelayMinutes += estimatedSlotLength;

    const estimatedArrival = new Date(now.getTime() + cumulativeDelayMinutes * 60000);
    const timeString = estimatedArrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return { ...item, estimatedTime: timeString };
  });
}
