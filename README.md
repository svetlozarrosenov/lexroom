# Lexroom – contract review

- `frontend/` – React + Vite (TypeScript)
- `backend/` – NestJS

## Run

```bash
docker compose up --build
```

After adding or upgrading an npm dependency, renew the containers' `node_modules`
volumes too, otherwise the stale ones are reattached:

```bash
docker compose up --build -V
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3101
