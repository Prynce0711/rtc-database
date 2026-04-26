# RTC Database Relay Server

Standalone LAN relay service for RTC Database.

## What It Does

- Listens for `DISCOVER_BACKEND` UDP requests.
- Responds with the relay host and port that clients should use.
- Reverse proxies HTTP and WebSocket traffic to an upstream server (for example via Tailscale).
- Designed to run on a LAN relay/proxy machine.

## Environment

- `RELAY_TARGET_URL`: upstream server URL (required)
- `RELAY_LISTEN_HOST`: local bind address for relay proxy (default `0.0.0.0`)
- `RELAY_PORT`: local bind port for relay proxy (default `3000`)
- `RELAY_INSECURE_TLS`: set `true` to skip TLS cert verification for HTTPS upstream
- `RELAY_USE_HTTPS`: set `true` to serve relay on HTTPS
- `RELAY_TLS_DIR`: directory for auto-generated/managed relay TLS files (default `.relay-tls`)
- `RELAY_TLS_KEY_PATH`: custom key path (optional)
- `RELAY_TLS_CERT_PATH`: custom cert path (optional)
- `RELAY_TLS_AUTO_GENERATE`: auto-generate self-signed cert/key when missing (default `true`)
- `RELAY_TLS_CERT_HOSTS`: comma-separated SAN hosts/IPs for generated cert

- `UDP_PORT`: UDP discovery port to listen on (default `41234`)
- `UDP_ADVERTISED_HOST`: hostname/IP advertised to clients
- `UDP_ADVERTISED_PORT`: port advertised to clients (defaults to `RELAY_PORT`)
- `UDP_ADVERTISED_PROTOCOL`: protocol advertised to clients (`http`/`https`). Defaults to `https` when `RELAY_USE_HTTPS=true`, otherwise `http`.

## TLS Notes

- Auto-generated certificates are self-signed and not automatically trusted by browsers/OS trust stores.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `RELAY_TARGET_URL` to your central server (Tailscale URL/IP).
3. Set `UDP_ADVERTISED_HOST` to the relay machine's LAN IP or DNS name.
4. Ensure `UDP_ADVERTISED_PORT` matches `RELAY_PORT` (or leave default behavior).
5. Run:

```bash
pnpm --filter rtc-database-relay dev
```

## Production

```bash
pnpm --filter rtc-database-relay build
pnpm --filter rtc-database-relay start
```
