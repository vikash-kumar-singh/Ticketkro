# Enterprise Ticket Management System

A production-minded, stateless ticket platform built as an npm monorepo. The API uses Express, TypeScript, MongoDB, JWT rotation, RBAC, layered services, audit logs, notifications, pagination, indexes, security middleware, health checks, and graceful shutdown. The React client provides a responsive role-aware dashboard and ticket workflows.

## Quick start

1. Install Node.js 20+ and MongoDB 7+ (or create a MongoDB Atlas database).
2. Run `npm install` from this directory.
3. Copy `.env.example` to `backend/.env` and create `frontend/.env` with `VITE_API_URL=http://localhost:5000/api/v1`.
4. Run `npm run dev`.
5. Open `http://localhost:5173`. The first registered account becomes `super_admin`; later public registrations become employees.

## Commands

- `npm run dev` — both apps with hot reload
- `npm run build` — production builds
- `npm run typecheck` — verify both workspaces

## Deploy

Deploy `frontend/` to Vercel and set `VITE_API_URL` to the Render API `/api/v1` URL. Deploy through `render.yaml`, then set MongoDB and frontend environment values. Uploaded files currently use local disk for development; replace `StorageService` with S3-compatible storage before horizontally scaling attachments.

## API

All responses use `{ success, data, message?, meta? }`. API routes are versioned under `/api/v1`. Important endpoints include authentication, `/tickets`, `/tickets/:id/comments`, `/notifications`, `/dashboard`, `/users`, and `/audit-logs`. `/health` is outside the version prefix for infrastructure probes.

## Architecture notes

The server is stateless; refresh tokens are hashed in MongoDB. Repository/service boundaries, notification channels, cache/queue interfaces, and storage isolation make Redis, BullMQ, email, push, Socket.IO, and S3 additions non-disruptive. Tenant-ready `companyId` fields and compound indexes provide a migration path to multi-tenant SaaS.
