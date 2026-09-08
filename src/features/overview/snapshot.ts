export const facilities = [
  {
    id: 'northstar',
    name: 'Northstar Logistics',
    location: 'Memphis · Distribution center',
    floors: ['Ground floor', 'Mezzanine'],
    fleet: 48,
    active: 34,
    charging: 8,
    attention: 3,
    missions: 126,
    throughput: 94,
    area: '24,800',
    zones: ['Inbound', 'Storage A', 'Storage B', 'Outbound'],
    activity: [
      'AGV-017 waiting at corridor C4',
      'AMR-032 localization confidence low',
      'CHG-04 scheduled for inspection',
    ],
  },
  {
    id: 'meridian',
    name: 'Meridian Assembly',
    location: 'Detroit · Manufacturing',
    floors: ['Assembly floor', 'Parts level'],
    fleet: 32,
    active: 23,
    charging: 5,
    attention: 2,
    missions: 87,
    throughput: 91,
    area: '18,200',
    zones: ['Receiving', 'Assembly A', 'Assembly B', 'Dispatch'],
    activity: ['AMR-006 temperature above nominal', 'AMR-014 awaiting inspection clearance'],
  },
] as const;
export type FacilitySnapshot = (typeof facilities)[number];
export function resolveFacility(id: string | null) {
  return facilities.find((facility) => facility.id === id) ?? facilities[0];
}
