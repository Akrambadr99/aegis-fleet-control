import { releaseControl } from './teleoperation';
import type { Actor, Activity, Command, DomainState, Robot, Versioned } from './model';
import { DomainError as GatewayError } from './errors';
export const automationTriggers = [
  'robot.low-battery',
  'corridor.set',
  'charger.set',
  'robot.connection',
  'robot.stop',
  'fault.escalate',
  'mission.failed',
] as const;
export const automationActions = [
  'schedule-charging',
  'pause',
  'reroute',
  'reconsider-charging',
  'escalate',
] as const;
export interface RuleInput {
  name: string;
  facilityId: string;
  enabled: boolean;
  priority: number;
  trigger: (typeof automationTriggers)[number];
  action: (typeof automationActions)[number];
  batteryBelow: number;
  minimumOccurrences: number;
  cooldownTicks: number;
}
export interface AutomationRule extends Versioned, RuleInput {
  owner: Actor;
}
export interface AutomationRun {
  id: string;
  ruleId: string;
  eventId: string;
  robotId: string;
  tick: number;
  action: RuleInput['action'];
  status: 'confirmed' | 'skipped' | 'failed';
  message: string;
}
export type AutomationCommand =
  | { type: 'automation.save'; id: string; expectedRevision: number; input: RuleInput }
  | { type: 'automation.toggle'; id: string; expectedRevision: number; enabled: boolean }
  | { type: 'charging.request'; id: string; expectedRevision: number }
  | { type: 'fault.escalate'; id: string; expectedRevision: number; message: string };
export function isAutomationCommand(command: Command): command is AutomationCommand {
  return (
    command.type.startsWith('automation.') ||
    command.type === 'charging.request' ||
    command.type === 'fault.escalate'
  );
}
export function validateRule(state: DomainState, input: RuleInput) {
  const issues: string[] = [];
  if (!input.name.trim()) issues.push('Rule name is required');
  if (!state.facilities[input.facilityId]) issues.push('Facility not found');
  if (!automationTriggers.includes(input.trigger) || !automationActions.includes(input.action))
    issues.push('Unsupported trigger or action');
  if (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 10)
    issues.push('Priority must be 1–10');
  if (!Number.isFinite(input.batteryBelow) || input.batteryBelow < 0 || input.batteryBelow > 100)
    issues.push('Battery threshold must be 0–100');
  if (
    !Number.isInteger(input.minimumOccurrences) ||
    input.minimumOccurrences < 1 ||
    input.minimumOccurrences > 10
  )
    issues.push('Occurrence threshold must be 1–10');
  if (
    !Number.isInteger(input.cooldownTicks) ||
    input.cooldownTicks < 1 ||
    input.cooldownTicks > 3600
  )
    issues.push('Cooldown must be 1–3600 seconds');
  return issues;
}
export function eventRobots(state: DomainState, event: Activity) {
  const ids = new Set(state.replay.filter((f) => f.eventId === event.id).map((f) => f.robotId));
  if (state.robots[event.entityId]) ids.add(event.entityId);
  if (state.missions[event.entityId]) ids.add(state.missions[event.entityId].robotId);
  return [...ids].map((id) => state.robots[id]);
}
export function evaluateRule(state: DomainState, input: RuleInput, event: Activity) {
  return eventRobots(state, event).map((robot) => {
    const count = state.activity.filter(
      (e) =>
        e.type === input.trigger &&
        e.tick >= event.tick - 600 &&
        e.tick <= event.tick &&
        eventRobots(state, e).some((r) => r.id === robot.id),
    ).length;
    const reason =
      event.type !== input.trigger
        ? 'Trigger does not match'
        : robot.facilityId !== input.facilityId
          ? 'Outside rule facility'
          : robot.battery > input.batteryBelow
            ? 'Battery condition not met'
            : count < input.minimumOccurrences
              ? 'Occurrence threshold not met'
              : 'Conditions match';
    return { robotId: robot.id, matched: reason === 'Conditions match', reason };
  });
}
export function automationAction(
  state: DomainState,
  rule: AutomationRule,
  robot: Robot,
): Command | null {
  if (rule.action === 'pause')
    return robot.status === 'running'
      ? { type: 'robot.pause', id: robot.id, expectedRevision: robot.revision }
      : null;
  if (rule.action === 'reroute') {
    const mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
    return mission && state.routes[mission.routeId].state === 'invalid'
      ? { type: 'robot.reroute', id: robot.id, expectedRevision: robot.revision }
      : null;
  }
  if (rule.action === 'escalate')
    return state.faults['ESC-' + robot.id]?.status === 'active'
      ? null
      : {
          type: 'fault.escalate',
          id: robot.id,
          expectedRevision: robot.revision,
          message: rule.name,
        };
  const reservation = robot.chargerReservationId
    ? state.reservations[robot.chargerReservationId]
    : null;
  return reservation && ['queued', 'charging'].includes(reservation.state)
    ? null
    : { type: 'charging.request', id: robot.id, expectedRevision: robot.revision };
}
export function applyAutomationCommand(
  state: DomainState,
  actor: Actor,
  command: AutomationCommand,
): Robot[] {
  if (command.type === 'automation.save' || command.type === 'automation.toggle') {
    const current = state.automationRules[command.id];
    if ((current?.revision ?? 0) !== command.expectedRevision)
      throw new GatewayError('stale', 'Automation rule changed');
    if (command.type === 'automation.toggle') {
      if (!current) throw new GatewayError('missing', 'Rule not found');
      current.enabled = command.enabled;
      current.revision++;
      return [];
    }
    if (current && current.facilityId !== command.input.facilityId)
      throw new GatewayError('invalid', 'Rule facility cannot change');
    const issues = validateRule(state, command.input);
    if (issues.length) throw new GatewayError('invalid', issues.join('; '));
    state.automationRules[command.id] = {
      ...structuredClone(command.input),
      id: command.id,
      revision: command.expectedRevision + 1,
      owner: structuredClone(actor),
    };
    return [];
  }
  const robot = state.robots[command.id];
  if (!robot) throw new GatewayError('missing', 'Robot not found');
  if (robot.revision !== command.expectedRevision) throw new GatewayError('stale', 'Robot changed');
  if (command.type === 'charging.request') {
    if (!robot.connected || ['maintenance', 'emergency-stopped', 'manual'].includes(robot.status))
      throw new GatewayError('invalid', 'Robot cannot join the charging queue');
    const previous = robot.chargerReservationId
      ? state.reservations[robot.chargerReservationId]
      : null;
    if (previous && ['queued', 'charging'].includes(previous.state))
      throw new GatewayError('unchanged', 'Charging is already scheduled');
    const chargers = Object.values(state.chargers)
      .filter((c) => c.floorId === robot.floorId && c.available)
      .sort(
        (a, b) =>
          Object.values(state.reservations).filter(
            (r) => r.chargerId === a.id && ['queued', 'charging'].includes(r.state),
          ).length -
            Object.values(state.reservations).filter(
              (r) => r.chargerId === b.id && ['queued', 'charging'].includes(r.state),
            ).length || a.id.localeCompare(b.id),
      );
    const charger = chargers[0];
    if (!charger) throw new GatewayError('invalid', 'No available charger on this floor');
    const id = 'RES-CHARGE-' + robot.id + '-' + robot.revision;
    state.reservations[id] = {
      id,
      revision: 1,
      robotId: robot.id,
      chargerId: charger.id,
      state: 'queued',
      priority: 5,
      queuePosition: Object.values(state.reservations).filter(
        (r) => r.chargerId === charger.id && ['queued', 'charging'].includes(r.state),
      ).length,
    };
    robot.chargerReservationId = id;
    charger.revision++;
  } else {
    if (!command.message.trim()) throw new GatewayError('invalid', 'Escalation reason is required');
    if (robot.controlSessionId) releaseControl(state, robot, 'Critical fault escalated');
    const id = 'ESC-' + robot.id;
    state.faults[id] = {
      id,
      revision: (state.faults[id]?.revision ?? 0) + 1,
      robotId: robot.id,
      severity: 'critical',
      status: 'active',
      message: command.message,
      acknowledgedBy: null,
    };
    if (!robot.faultIds.includes(id)) robot.faultIds.push(id);
    if (robot.status === 'running') {
      robot.status = 'paused';
      const mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
      if (mission) {
        mission.status = 'paused';
        mission.pauseReason = 'Escalated operational fault';
        mission.revision++;
        state.routes[mission.routeId].reservationState = 'held';
        state.routes[mission.routeId].revision++;
      }
    }
  }
  robot.revision++;
  return [robot];
}
export function seedAutomation(state: DomainState) {
  const defaults: {
    id: string;
    name: string;
    trigger: RuleInput['trigger'];
    action: RuleInput['action'];
    batteryBelow: number;
  }[] = [
    {
      id: 'AUTO-ROUTE',
      name: 'Recalculate blocked mission routes',
      trigger: 'corridor.set',
      action: 'reroute',
      batteryBelow: 100,
    },
    {
      id: 'AUTO-CHARGE',
      name: 'Queue robots at battery reserve',
      trigger: 'robot.low-battery',
      action: 'schedule-charging',
      batteryBelow: 30,
    },
    {
      id: 'AUTO-CHARGER',
      name: 'Reconsider displaced charger reservations',
      trigger: 'charger.set',
      action: 'reconsider-charging',
      batteryBelow: 100,
    },
  ];
  for (const rule of defaults)
    state.automationRules[rule.id] = {
      ...rule,
      revision: 1,
      facilityId: 'FAC-001',
      enabled: false,
      priority: 5,
      minimumOccurrences: 1,
      cooldownTicks: 30,
      owner: { id: 'local-operator', role: 'administrator' },
    };
}
