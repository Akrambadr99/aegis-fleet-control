import type { Actor, DomainState, Versioned } from './model';
import { newPlan, type MissionPlan } from './planning';
import { DomainError as GatewayError } from './errors';

export interface MissionTemplate extends Versioned {
  title: string;
  facilityId: string;
  createdBy: string;
  sourcePlanId: string;
  sourceRevision: number;
  plan: MissionPlan;
}
export interface TemplateCommand {
  type: 'template.create';
  id: string;
  sourcePlanId: string;
  sourceRevision: number;
  title: string;
}
export function createMissionTemplate(state: DomainState, actor: Actor, command: TemplateCommand) {
  const source = state.plans[command.sourcePlanId];
  if (!source) throw new GatewayError('missing', 'Source mission plan no longer exists');
  if (source.revision !== command.sourceRevision)
    throw new GatewayError(
      'stale',
      'Source mission plan changed; reload before creating a template',
    );
  if (!command.id.trim() || !command.title.trim())
    throw new GatewayError('invalid', 'Template identifier and title are required');
  if (state.missionTemplates[command.id])
    throw new GatewayError('stale', 'This template already exists');
  state.missionTemplates[command.id] = {
    id: command.id,
    revision: 1,
    title: command.title.trim(),
    facilityId: source.facilityId,
    createdBy: actor.id,
    sourcePlanId: source.id,
    sourceRevision: source.revision,
    plan: structuredClone(source),
  };
}

export function instantiateTemplate(
  template: MissionTemplate,
  id: string,
  robotId: string,
  ownerId: string,
): MissionPlan {
  return {
    ...newPlan(id, template.facilityId, robotId),
    title: template.title,
    ownerId,
    templateSource: { id: template.id, revision: template.revision },
    steps: structuredClone(template.plan.steps),
  };
}
