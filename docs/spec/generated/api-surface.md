# API Contract Surface (Generated)

- Endpoints: 5
- Tags: chat, events, runs

| Method | Path | Operation ID | Tags | Streaming | Summary |
|---|---|---|---|---|---|
| POST | /chat/general | chat.general | chat | yes |  |
| POST | /chat/tools/weather/current | chat.weatherCurrent | chat | no |  |
| GET | /events/ | events.subscribe | events | yes |  |
| GET | /runs/ | runs.list | runs | no | List runs |
| POST | /runs/ | runs.create | runs | no | Create run |
