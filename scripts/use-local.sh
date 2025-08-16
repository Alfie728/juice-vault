#!/bin/bash
# Switch to local Docker database
[ -f .env ] && cp .env .env.prod
cat > .env << 'EOF'
DATABASE_URL="postgresql://juicevault:juicevault_password@localhost:5432/juicevault?schema=public"
AUTH_SECRET="development-secret"
AUTH_URL="http://localhost:3000"
EOF
if [ -f .env.prod ]; then
    for key in OPENAI_API_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AUTH_DISCORD_ID AUTH_DISCORD_SECRET AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET S3_BUCKET_NAME AWS_REGION; do
        value=$(grep "^${key}=" .env.prod 2>/dev/null | cut -d'=' -f2-)
        [ ! -z "$value" ] && echo "${key}=${value}" >> .env
    done
fi
echo "✅ Using local database"