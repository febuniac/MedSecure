# MedSecure Platform

HIPAA-compliant healthcare data platform managing electronic health records (EHR), patient portals, clinical data exchange, and regulatory compliance for 500+ healthcare providers.

## Architecture
- **src/api/** — REST API endpoints (Express.js)
- **src/services/** — Business logic layer
- **src/middleware/** — Auth, HIPAA audit, rate limiting
- **src/models/** — Database models (PostgreSQL)
- **src/utils/** — Shared utilities (encryption, PHI handling)

## Tech Stack
- Node.js 20 LTS / Express.js 4.x
- PostgreSQL 15 (encrypted at rest)
- Redis 7 (session cache)
- HL7 FHIR R4 compliant APIs
- AES-256-GCM encryption for PHI
- HIPAA BAA with all cloud providers

## Quick Start
```bash
npm install
cp .env.example .env
docker-compose up -d
npm run migrate && npm run dev
```

## Compliance
- HIPAA Privacy & Security Rule compliant
- SOC2 Type II certified
- HITRUST CSF validated
- Annual third-party penetration testing
