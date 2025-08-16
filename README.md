# JuiceVault 🎵

> A modern music streaming platform dedicated to JuiceWRLD fans, featuring AI-powered lyrics transcription and synchronization.

## ✨ Features

- 🎵 Music streaming and management
- 🤖 AI-powered lyrics transcription using OpenAI Whisper
- ⏱️ Automatic lyrics synchronization with timestamps
- 📊 OpenTelemetry observability with Grafana
- 🎨 Modern UI with dark theme
- 🔐 Secure authentication with NextAuth
- ☁️ AWS S3 integration for audio storage

## 🚀 Quick Start

### Prerequisites

- Docker Desktop
- OpenAI API key (for lyrics transcription)
- AWS S3 credentials (for audio storage) - optional for local development

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/juice-vault.git
   cd juice-vault
   ```

2. **Copy environment variables** (optional)
   ```bash
   cp .env.docker .env
   # Edit .env with your API keys
   ```

3. **Start the development environment**
   ```bash
   ./scripts/start.sh
   ```
   
   This will:
   - Build and start all Docker containers
   - Set up PostgreSQL database
   - Start Next.js with hot reloading
   - Launch Grafana for observability

Visit:
- **App**: http://localhost:3000
- **Grafana**: http://localhost:3001 (admin/admin)
- **Database**: postgresql://localhost:5432/juicevault

## 📊 Observability

JuiceVault includes comprehensive observability with OpenTelemetry:

- **Traces**: View in Grafana Tempo at http://localhost:3001
- **Logs**: Aggregated in Loki
- **Metrics**: Collected by Prometheus

See [Docker Setup Guide](./docs/DOCKER.md) for details.

### Useful Commands

```bash
# Each script does ONE thing - no arguments needed!
./scripts/start.sh         # Start all services
./scripts/stop.sh          # Stop all services
./scripts/restart.sh       # Restart everything
./scripts/logs.sh          # View all logs
./scripts/status.sh        # Check what's running

# Database
./scripts/studio.sh        # Open Prisma Studio
./scripts/db-push.sh       # Push schema changes
./scripts/db-reset.sh      # Reset database
./scripts/psql.sh          # PostgreSQL shell

# Development
./scripts/lint.sh          # Run linting
./scripts/typecheck.sh     # Type checking
./scripts/test-lyrics.sh   # Test lyrics service
./scripts/clean.sh         # Clean everything
```

## 🧪 Testing

Run the lyrics service test with tracing:
```bash
./scripts/test-lyrics.sh
```

View traces in Grafana:
1. Open http://localhost:3001 (admin/admin)
2. Go to Explore → Tempo
3. Search for `{resource.service.name="lyrics-test-service"}`

## 📚 Documentation

- [Quick Start Guide](./docs/QUICKSTART.md) - Get up and running quickly
- [Development Guide](./docs/DEVELOPMENT.md) - Development workflow and common tasks
- [Architecture & Patterns](./docs/PATTERNS.md) - Code patterns and best practices
- [Docker Setup Guide](./docs/DOCKER.md) - Complete Docker and observability setup
- [API Documentation](./docs/API.md) - tRPC API endpoints

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Backend**: tRPC, Prisma, PostgreSQL
- **AI**: OpenAI (Whisper, GPT-4)
- **Infrastructure**: AWS S3, Docker
- **Observability**: OpenTelemetry, Grafana, Tempo
- **Type Safety**: TypeScript, Zod, Effect

## 📦 Project Structure

```
juice-vault/
├── src/
│   ├── app/             # Next.js 15 app router
│   ├── server/          # tRPC API routes
│   ├── domain/          # Business logic (Effect-based services)
│   │   ├── ai/          # AI services (lyrics transcription)
│   │   ├── infra/       # Infrastructure services (S3)
│   │   ├── lyrics/      # Lyrics domain service
│   │   └── song/        # Song domain service
│   ├── features/        # Feature modules
│   │   ├── song/        # Song management components
│   │   ├── player/      # Music player component
│   │   └── shared/      # Shared UI components
│   └── trpc/            # tRPC configuration
├── scripts/             # Individual task scripts
│   ├── start.sh         # Start all services
│   ├── stop.sh          # Stop all services
│   └── ...              # Other single-purpose scripts
├── docs/                # Documentation
├── docker-compose.yml   # Docker configuration
└── prisma/              # Database schema
```

## 🔧 Environment Variables

The development environment includes default values for most settings. You only need to provide:

```env
# OpenAI (required for lyrics transcription)
OPENAI_API_KEY=sk-...

# AWS S3 (optional for local development)
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# OAuth (optional)
AUTH_DISCORD_ID=...
AUTH_DISCORD_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

Copy `.env.docker` to `.env` and add your keys. The database is automatically configured in Docker.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

## 📄 License

MIT License - see LICENSE file for details