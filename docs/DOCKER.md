# Docker Setup Guide for JuiceVault

This guide explains the Docker setup for local development.

## 📋 Prerequisites

- Docker Desktop installed ([Download here](https://www.docker.com/products/docker-desktop))
- Docker Compose (included with Docker Desktop)

## 🚀 Quick Start

```bash
# Start all services
./scripts/start.sh

# View logs
./scripts/logs.sh

# Stop everything
./scripts/stop.sh
```

### Manual Docker Commands
```bash
# Start services
docker compose up --build -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Clean everything (including volumes)
docker compose down -v
```

## 🏗️ Architecture

The Docker setup includes a complete development environment:

```
┌──────────────────────────────────────────────────┐
│              Docker Environment                  │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │         Next.js Container                │   │
│  │  ┌─────────────┐  ┌──────────────────┐ │   │
│  │  │  Next.js    │  │  Lyrics Service   │ │   │
│  │  │  App Server │  │   (with Effect    │ │   │
│  │  │  (Port 3000)│  │   OpenTelemetry)  │ │   │
│  │  └──────┬──────┘  └────────┬─────────┘ │   │
│  │         │                   │            │   │
│  │         │   Hot Reloading   │            │   │
│  │         │   Enabled         │            │   │
│  └─────────┼───────────────────┼────────────┘   │
│            │                   │                 │
│            │                   ▼                 │
│  ┌─────────▼────────┐ ┌──────────────────┐     │
│  │    PostgreSQL    │ │  OTLP Collector  │     │
│  │   Container      │ │  (Port 4318)     │     │
│  │   (Port 5432)    │ └────────┬─────────┘     │
│  └──────────────────┘          │                │
│                                ▼                │
│         ┌──────────────────────────────────┐   │
│         │     Grafana LGTM Stack           │   │
│         │                                   │   │
│         │  ┌──────────┐  ┌──────────┐     │   │
│         │  │  Grafana │  │  Tempo   │     │   │
│         │  │  (3001)  │  │ (Traces) │     │   │
│         │  └──────────┘  └──────────┘     │   │
│         │                                   │   │
│         │  ┌──────────┐  ┌──────────┐     │   │
│         │  │   Loki   │  │Prometheus│     │   │
│         │  │  (Logs)  │  │(Metrics) │     │   │
│         │  └──────────┘  └──────────┘     │   │
│         └───────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

## 📦 Services

### Application Services

#### Next.js Application
- **Container**: `nextjs`
- **Port**: 3000
- **Features**: 
  - Hot reloading enabled
  - Automatic database migrations
  - OpenTelemetry instrumentation
  - Development mode with detailed error pages

#### PostgreSQL Database
- **Container**: `postgres`
- **Port**: 5432
- **Credentials**: juicevault / juicevault_password
- **Database**: juicevault
- **Persistent volume for data

### Observability Stack

#### Grafana LGTM
The `otel-lgtm` container includes:

- **Grafana** (Port 3001): Visualization dashboard
- **Tempo**: Distributed tracing backend
- **Loki**: Log aggregation system
- **Prometheus**: Metrics collection
- **OTLP Collector** (Ports 4317/4318): Receives telemetry data

### Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Next.js Application | http://localhost:3000 | - |
| PostgreSQL Database | postgresql://localhost:5432/juicevault | juicevault / juicevault_password |
| Grafana Dashboard | http://localhost:3001 | admin / admin |
| OTLP HTTP Endpoint | http://localhost:4318 | - |
| OTLP GRPC Endpoint | http://localhost:4317 | - |

## 📊 Using Grafana

### Accessing Traces in Tempo

1. Open Grafana: http://localhost:3001
2. Login with `admin` / `admin`
3. Navigate to **Explore** (compass icon)
4. Select **Tempo** from the datasource dropdown
5. Search for traces:
   - Use TraceQL: `{resource.service.name="lyrics-test-service"}`
   - Or use empty query `{}` to see all traces
   - Set time range to "Last 5 minutes"

### Viewing Logs in Loki

1. In Explore, select **Loki** datasource
2. Use LogQL queries:
   - `{service="juice-vault"}`
   - `{level="error"}`

### Checking Metrics in Prometheus

1. In Explore, select **Prometheus** datasource
2. Query examples:
   - `up` - Check which services are running
   - `http_requests_total` - Total HTTP requests

## 🧪 Testing OpenTelemetry

### Test OTLP Connectivity
```bash
# Manual test
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[]}'
```

### Run Lyrics Test with Tracing
```bash
# This will send traces to Tempo
./scripts/test-lyrics.sh
```

## 🔧 Troubleshooting

### Traces Not Appearing in Tempo

1. **Check time range**: Make sure it's set to "Last 5 minutes" or "Last 1 hour"
2. **Check container logs**:
   ```bash
   docker compose logs otel-lgtm
   ```
4. **Try empty query**: Use `{}` in TraceQL to see all traces

### Port Conflicts

If ports are already in use:

1. Stop conflicting services
2. Or modify ports in `docker-compose.yml`:
   ```yaml
   ports:
     - "3002:3000"  # Change Grafana to port 3002
   ```

### Container Won't Start

1. Check Docker is running:
   ```bash
   docker info
   ```
2. Clean up and restart:
   ```bash
   docker compose down -v
   ./scripts/start.sh
   ```

## 🛠️ Advanced Configuration

### Production Deployment

For production deployment, use `docker-compose.prod.yml`:

```bash
# Build and start production containers
docker compose -f docker-compose.prod.yml up --build -d
```

### Enable Additional Services

Uncomment MinIO in `docker-compose.yml` for local S3-compatible storage:

```yaml
minio:
  image: minio/minio:latest
  # ... configuration
```

### Custom Grafana Dashboards

1. Create dashboards in Grafana UI
2. Export as JSON
3. Mount in container:
   ```yaml
   volumes:
     - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
   ```

### Environment Variables

Create `.env.docker` for Docker-specific variables:

```env
# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=juice-vault

# Grafana
GF_SECURITY_ADMIN_PASSWORD=your-secure-password
```

## 📚 Additional Resources

- [Grafana LGTM Documentation](https://github.com/grafana/docker-otel-lgtm)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Effect Tracing Guide](https://effect.website/docs/observability/tracing)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## 🧹 Cleanup

### Stop Services
```bash
./scripts/stop.sh
```

### Remove All Data
```bash
# WARNING: This deletes all volumes and data
./scripts/clean.sh
```

### Complete Fresh Start
```bash
./scripts/clean.sh
./scripts/start.sh
```