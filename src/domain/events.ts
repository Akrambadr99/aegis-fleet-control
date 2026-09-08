import type { Command } from './model';
export type DomainEventType =
  | Command['type']
  | 'robot.connected'
  | 'mission.assigned'
  | 'control.lost'
  | 'mission.completed'
  | 'robot.low-battery'
  | 'job.picked-up'
  | 'job.delivered'
  | 'job.started'
  | 'job.completed'
  | 'dispatch-lock.expired'
  | 'resource.expired'
  | 'resource.released'
  | 'resource.acquired'
  | 'automation.confirmed'
  | 'automation.skipped'
  | 'automation.failed';
