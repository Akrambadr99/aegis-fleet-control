export interface OperationResult {
  revision: number;
  operationId: string;
  correlationId: string;
  outcome: 'success' | 'partial';
  affectedEntities: string[];
  failures: { entityId: string; message: string }[];
}
