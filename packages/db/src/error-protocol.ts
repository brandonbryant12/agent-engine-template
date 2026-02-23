export interface HttpErrorProtocol<E = unknown> {
  readonly httpStatus: number;
  readonly httpCode: string;
  readonly httpMessage: string | ((error: E) => string);
  readonly logLevel: 'silent' | 'warn' | 'error' | 'error-with-stack';
  getData?: (error: E) => Record<string, unknown>;
}

export const hasHttpProtocol = (
  ErrorClass: unknown,
): ErrorClass is HttpErrorProtocol => {
  if (typeof ErrorClass !== 'function' && typeof ErrorClass !== 'object') {
    return false;
  }
  const proto = ErrorClass as Record<string, unknown>;
  return (
    typeof proto.httpStatus === 'number' &&
    typeof proto.httpCode === 'string' &&
    (typeof proto.httpMessage === 'string' ||
      typeof proto.httpMessage === 'function') &&
    typeof proto.logLevel === 'string'
  );
};

export type LogLevel = HttpErrorProtocol['logLevel'];
