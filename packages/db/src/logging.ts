import { Logger, LogLevel, Layer } from 'effect';

export { LogLevel };

export interface LoggingConfig {
  readonly level?: LogLevel.LogLevel;
  readonly format?: 'json' | 'pretty' | 'structured';
}

export const LoggingLive = (config: LoggingConfig = {}): Layer.Layer<never> => {
  const levelLayer = config.level
    ? Logger.minimumLogLevel(config.level)
    : Layer.empty;

  const formatLayer =
    config.format === 'json'
      ? Logger.json
      : config.format === 'pretty'
        ? Logger.pretty
        : Layer.empty;

  return Layer.mergeAll(levelLayer, formatLayer);
};
