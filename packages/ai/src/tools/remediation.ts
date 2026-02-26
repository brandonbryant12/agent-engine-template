export type ToolFailureTag =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'timeout'
  | 'provider'
  | 'schemaDrift'
  | 'rateLimited';

export interface ToolRemediation {
  readonly title: string;
  readonly action: string;
}
