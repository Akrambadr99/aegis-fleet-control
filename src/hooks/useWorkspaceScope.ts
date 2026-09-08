import { useSearchParams } from 'react-router-dom';
import { useDomain } from '../app/FleetProvider';
export function useScope() {
  const state = useDomain(),
    [params, setParams] = useSearchParams();
  const selectedRobot = state.robots[params.get('robot') ?? ''];
  const raw = params.get('facility') ?? selectedRobot?.facilityId ?? 'FAC-001';
  const aliases: Record<string, string> = {
    northstar: 'FAC-001',
    meridian: 'FAC-002',
    atlas: 'FAC-003',
    harbor: 'FAC-004',
  };
  const candidate = aliases[raw] ?? raw;
  const facility = state.facilities[candidate] ?? state.facilities['FAC-001'];
  const floorId = params.get('floor') ?? selectedRobot?.floorId;
  const floor =
    floorId && state.floors[floorId]?.facilityId === facility.id
      ? state.floors[floorId]
      : state.floors[facility.floorIds[0]];
  function change(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      if (key === 'floor') {
        next.delete('robot');
        next.delete('resource');
        next.delete('page');
      }
      if (key === 'robot' && state.robots[value]) {
        next.delete('resource');
        next.set('facility', state.robots[value].facilityId);
        next.set('floor', state.robots[value].floorId);
      }
      if (key === 'facility') {
        next.delete('floor');
        next.delete('resource');
        next.delete('job');
        next.delete('jobGroup');
        next.delete('jobPage');
        next.delete('robot');
        next.delete('page');
      }
      return next;
    });
  }
  return { state, facility, floor, params, setParams, change };
}
