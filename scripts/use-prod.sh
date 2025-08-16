#!/bin/bash
# Switch to production database
[ -f .env.prod ] && cp .env.prod .env && echo "✅ Using production database"