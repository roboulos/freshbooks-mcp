#!/bin/bash

# Safe deployment script that ensures environment variables are set

echo "🔒 Safe Deployment Script for Xano MCP Server"
echo "============================================"

# Check if environment variables are set
if [ -z "$XANO_BASE_URL" ]; then
    echo "⚠️  WARNING: XANO_BASE_URL is not set!"
    echo "   Set it with: export XANO_BASE_URL='https://your-instance.xano.io'"
    echo "   The app will run but authentication features won't work."
    echo ""
fi

if [ -z "$COOKIE_ENCRYPTION_KEY" ]; then
    echo "⚠️  WARNING: COOKIE_ENCRYPTION_KEY is not set!"
    echo "   Generate one with: openssl rand -base64 32"
    echo "   Set it with: export COOKIE_ENCRYPTION_KEY='your-generated-key'"
    echo "   The app will run but OAuth sessions won't be secure."
    echo ""
fi

# Deploy with environment variables if they exist
echo "📦 Deploying to Cloudflare Workers..."

# Set secrets if environment variables exist
if [ ! -z "$XANO_BASE_URL" ]; then
    echo "Setting XANO_BASE_URL secret..."
    echo "$XANO_BASE_URL" | wrangler secret put XANO_BASE_URL
fi

if [ ! -z "$COOKIE_ENCRYPTION_KEY" ]; then
    echo "Setting COOKIE_ENCRYPTION_KEY secret..."
    echo "$COOKIE_ENCRYPTION_KEY" | wrangler secret put COOKIE_ENCRYPTION_KEY
fi

# Deploy the worker
wrangler deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Go to Cloudflare Workers dashboard"
echo "2. Navigate to Settings > Variables"
echo "3. Add these environment variables if not already set:"
echo "   - XANO_BASE_URL: Your Xano instance URL"
echo "   - COOKIE_ENCRYPTION_KEY: A secure random string"
echo ""
echo "🔐 Security reminder: Never commit these values to git!"