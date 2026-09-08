import type { FacilitySnapshot } from './snapshot';
import { NavigationMap } from '../facilities';
export function FacilityPreview({ facility }: { facility: FacilitySnapshot }) {
  return (
    <NavigationMap
      floorId={facility.floorId}
      label={`${facility.name} ground floor navigation graph and robot routes`}
    />
  );
}
