#!/bin/bash
# Automated deployment script for Vercel
# This script helps deploy to Vercel with environment variables

set -e

echo "🚀 Deploying SAS Market Validation Platform to Vercel"
echo "=================================================="
echo ""

# Check if logged in to Vercel
if ! vercel whoami &>/dev/null; then
  echo "⚠️  Not logged in to Vercel"
  echo "📝 Please login first: vercel login"
  exit 1
fi

echo "✅ Logged in to Vercel"
echo ""

# Check if project is linked
if [ -f .vercel/project.json ]; then
  echo "✅ Project already linked to Vercel"
  PROJECT_LINKED=true
else
  echo "⚠️  Project not linked - will link during deployment"
  PROJECT_LINKED=false
fi

echo ""
echo "📋 Pre-deployment checks:"
echo "  1. Building project..."
if npm run build; then
  echo "     ✅ Build successful"
else
  echo "     ❌ Build failed!"
  exit 1
fi

echo ""
echo "🌍 Environment Variables:"
echo "  Checking .env.local..."

if [ ! -f .env.local ]; then
  echo "     ❌ .env.local not found!"
  echo "     Please create it with your environment variables"
  exit 1
fi

# Check if environment variables are set
if grep -q "your_service_role_key_here" .env.local || grep -q "your_anon_key_here" .env.local; then
  echo "     ⚠️  .env.local contains placeholder values!"
  echo "     Please update with actual values before deploying"
  read -p "     Continue anyway? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "     ✅ .env.local found"
echo ""

# Deploy
echo "🚀 Deploying to Vercel..."
echo ""

if [ "$PROJECT_LINKED" = false ]; then
  echo "📝 First deployment - will prompt for:"
  echo "   - Project name"
  echo "   - Link to existing project (N)"
  echo "   - Directory (./)"
  echo ""
  echo "Starting deployment in 3 seconds..."
  sleep 3
  vercel
else
  # Already linked, just deploy
  vercel --prod
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Set environment variables on Vercel:"
echo "      vercel env add SUPABASE_URL"
echo "      vercel env add SUPABASE_SERVICE_KEY"
echo "      vercel env add SUPABASE_ANON_KEY"
echo "      vercel env add ANTHROPIC_API_KEY"
echo ""
echo "   2. Redeploy to production:"
echo "      vercel --prod"
echo ""
echo "   3. Test your deployment:"
echo "      ./test-vercel-deployment.sh https://your-project.vercel.app"
