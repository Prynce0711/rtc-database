# RTC Database Relay Server

Standalone UDP discovery responder for LAN clients.

## What It Does

- Listens for `DISCOVER_BACKEND` UDP requests.
- Responds with the configured backend host and port.
- Designed to run on a LAN relay/proxy machine.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `UDP_ADVERTISED_HOST` and `BACKEND_PORT` for your relay/proxy endpoint.
3. Run:

```bash
pnpm --filter rtc-database-relay dev
```

## Production

```bash
pnpm --filter rtc-database-relay build
pnpm --filter rtc-database-relay start
```
