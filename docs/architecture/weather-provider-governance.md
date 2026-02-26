# Weather Provider Governance (Open-Meteo)

Reference provider for `weather.current` demo tool.

## Allowlisted Host

- `api.open-meteo.com`

## Outbound Data Minimization

Only these outbound fields are sent:

- `latitude`
- `longitude`
- `current` projection (`temperature_2m`, `weather_code`, `wind_speed_10m`, `wind_direction_10m`)
- `timezone`

No auth/session claims, user identifiers, or prompt text are sent.

## Privacy and Terms Assumptions

- This demo uses public weather inputs only.
- No persistent storage of provider raw payloads is required.
- Provider response is normalized immediately into internal schema.

## Swap/Disable Triggers

Disable or swap provider when one or more occur:

- provider terms/privacy change and violate template constraints
- repeated schema drift failures exceed acceptable operational threshold
- reliability SLO for tool availability is repeatedly breached

## Operational Safety

- fixed timeout budget for outbound request
- fail closed on non-JSON or schema drift payloads
- explicit provider rate-limit handling
