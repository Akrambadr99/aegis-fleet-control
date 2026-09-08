import type { OperationResult } from '../application/operations';
import type { Actor, Command, DomainState, Robot, RoutePreview } from '../domain/model';
import type { Ticket } from './requests';
export interface FleetQueries {
  getSnapshot(): DomainState;
  subscribe(listener: () => void): () => void;
  readRobot(id: string, signal?: AbortSignal): Ticket<Robot>;
  previewRoute(id: string, signal?: AbortSignal): Ticket<RoutePreview>;
}
export interface FleetCommands {
  command(actor: Actor, command: Command, signal?: AbortSignal): Ticket<OperationResult>;
  advance(ticks?: number): void;
}
