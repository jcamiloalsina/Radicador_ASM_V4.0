#!/bin/bash
# MongoDB Daily Backup Script
# Runs via cron to create daily backups with 7-day retention

set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${DATE}"
RETENTION_DAYS=7

# MongoDB connection details from environment
MONGO_HOST="${MONGO_HOST:-mongodb}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_USER="${MONGO_APP_USER:-app_user}"
MONGO_PASS="${MONGO_APP_PASSWORD:-}"
MONGO_DB="${MONGO_INITDB_DATABASE:-catastro_asomunicipios}"

echo "========================================"
echo "📦 Starting MongoDB Backup: ${BACKUP_NAME}"
echo "========================================"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Build connection string
if [ -n "$MONGO_PASS" ]; then
    MONGO_URI="mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=admin"
else
    MONGO_URI="mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}"
fi

# Run mongodump
mongodump \
    --uri="${MONGO_URI}" \
    --out="${BACKUP_DIR}/${BACKUP_NAME}" \
    --gzip

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "✅ Backup completed successfully: ${BACKUP_DIR}/${BACKUP_NAME}"
    
    # Calculate backup size
    BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}" | cut -f1)
    echo "📊 Backup size: ${BACKUP_SIZE}"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Clean up old backups (older than RETENTION_DAYS)
echo "🗑️ Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -maxdepth 1 -type d -name "backup_*" -mtime +${RETENTION_DAYS} -exec rm -rf {} \;

# List remaining backups
echo "📋 Current backups:"
ls -lh "${BACKUP_DIR}" | grep "backup_" || echo "  No backups found"

echo "========================================"
echo "✅ Backup process completed"
echo "========================================"
