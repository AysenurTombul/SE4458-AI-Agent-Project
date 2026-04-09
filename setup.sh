#!/bin/bash

# SE4458 Assignment 2 - Quick Start Script
# This script sets up the entire project for development

set -e  # Exit on error

echo "🚀 SE4458 Assignment 2 - Listing System Setup"
echo "=============================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "${BLUE}[1/5] Checking prerequisites...${NC}"
command -v node >/dev/null 2>&1 || { echo "${RED}❌ Node.js not installed${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "${RED}❌ npm not installed${NC}"; exit 1; }
echo "${GREEN}✓ Node.js $(node -v) and npm $(npm -v)${NC}"
echo ""

# Setup MCP Server
echo "${BLUE}[2/5] Setting up MCP Server...${NC}"
cd mcp-server
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "${YELLOW}⚠️  Created .env file - please edit with API_GATEWAY_URL${NC}"
fi
npm install
echo "${GREEN}✓ MCP Server ready${NC}"
cd ..
echo ""

# Setup Agent Backend
echo "${BLUE}[3/5] Setting up Agent Backend...${NC}"
cd agent-backend
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "${RED}❌ IMPORTANT: Add your OPENAI_API_KEY and FIREBASE credentials to .env${NC}"
    echo "Then run this script again."
    exit 1
fi
npm install
echo "${GREEN}✓ Agent Backend ready${NC}"
cd ..
echo ""

# Setup Frontend
echo "${BLUE}[4/5] Setting up Frontend...${NC}"
cd web-frontend
npm install
echo "${GREEN}✓ Frontend ready${NC}"
cd ..
echo ""

# Root dependencies
echo "${BLUE}[5/5] Installing root dependencies...${NC}"
npm install
echo "${GREEN}✓ Root dependencies ready${NC}"
echo ""

# Final instructions
echo "${GREEN}✨ Setup Complete!${NC}"
echo ""
echo "📚 Next steps:"
echo ""
echo "1. ${YELLOW}Configure environment variables:${NC}"
echo "   - agent-backend/.env (add OPENAI_API_KEY, FIREBASE credentials)"
echo "   - mcp-server/.env (add API_GATEWAY_URL if needed)"
echo ""
echo "2. ${YELLOW}Start services in separate terminals:${NC}"
echo ""
echo "   Terminal 1 (Your existing Midterm API & Gateway):"
echo "     ${BLUE}npm run dev${NC}"
echo ""
echo "   Terminal 2 (MCP Server):"
echo "     ${BLUE}cd mcp-server && npm run dev${NC}"
echo ""
echo "   Terminal 3 (Agent Backend):"
echo "     ${BLUE}cd agent-backend && npm run dev${NC}"
echo ""
echo "   Terminal 4 (Frontend):"
echo "     ${BLUE}cd web-frontend && npm run dev${NC}"
echo ""
echo "3. ${YELLOW}Open browser:${NC}"
echo "   ${BLUE}http://localhost:3000${NC}"
echo ""
echo "4. ${YELLOW}Create a conversation and try:${NC}"
echo "   ${BLUE}\"Find a place for 2 people in Paris\"${NC}"
echo ""
echo "📖 For more details, see:"
echo "   - ARCHITECTURE.md (system design)"
echo "   - IMPLEMENTATION_GUIDE.md (detailed walkthrough)"
echo "   - DEPLOYMENT_GUIDE.md (production deployment)"
echo ""
