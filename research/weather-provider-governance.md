# Weather Provider Governance (Open-Meteo Demo)

Date: 2026-02-26
Provider: [Open-Meteo](https://open-meteo.com/en/docs)
Endpoint: `https://api.open-meteo.com/v1/forecast`

## Outbound Policy

- Allowlisted host only: `api.open-meteo.com`
- Outbound fields: `latitude`, `longitude`, `current`, `timezone`, `temperature_unit`, `wind_speed_unit`
- Never send: auth/session claims, prompt text, or free-form user text

## Privacy + Terms Assumptions

- Coordinates can be personal data in some contexts; treat as sensitive in telemetry/logs.
- Demo usage assumes provider terms permit non-commercial template demonstration.
- Provider payloads are untrusted and must be schema-validated before model exposure.

## Disable / Swap Triggers

- Terms/privacy policy drift invalidates assumptions above.
- Repeated schema drift incidents (`WeatherToolSchemaDriftError`) within one release cycle.
- Reliability breach: sustained timeout/provider failures causing user-facing degradation.

If any trigger fires, disable `weather.current` in tool registry and replace provider before re-enable.
