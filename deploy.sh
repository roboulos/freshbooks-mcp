#!/bin/bash

# Cloudflare MCP Server Deployment Script

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Environment selection
ENVIRONMENT=${1:-dev}
echo -e "${BLUE}Deploying to ${ENVIRONMENT} environment...${NC}"

# Function to check for required tools
check_requirements() {
  echo -e "${CYAN}Checking requirements...${NC}"
  
  # Check for Wrangler
  if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler is not installed. Please install it with 'npm install -g wrangler'${NC}"
    exit 1
  fi
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install it from https://nodejs.org/${NC}"
    exit 1
  fi
  
  # Check for NPM
  if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}All requirements satisfied!${NC}"
}

# Function to install dependencies
install_dependencies() {
  echo -e "${CYAN}Installing dependencies...${NC}"
  npm install
  echo -e "${GREEN}Dependencies installed!${NC}"
}

# Function to run tests
run_tests() {
  echo -e "${CYAN}Running tests...${NC}"
  if npm test; then
    echo -e "${GREEN}Tests passed!${NC}"
  else
    echo -e "${RED}Tests failed!${NC}"
    read -p "Do you want to continue with deployment anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}Deployment cancelled.${NC}"
      exit 1
    fi
  fi
}

# Function to typecheck
run_typechecking() {
  echo -e "${CYAN}Running type checking...${NC}"
  if npm run type-check; then
    echo -e "${GREEN}Type checking passed!${NC}"
  else
    echo -e "${RED}Type checking failed!${NC}"
    read -p "Do you want to continue with deployment anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}Deployment cancelled.${NC}"
      exit 1
    fi
  fi
}

# Function to deploy to Cloudflare Workers
deploy() {
  echo -e "${CYAN}Deploying to Cloudflare Workers (${ENVIRONMENT})...${NC}"
  
  if [ "$ENVIRONMENT" == "production" ]; then
    # Check if we're ready for production
    read -p "Are you sure you want to deploy to PRODUCTION? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}Production deployment cancelled.${NC}"
      exit 1
    fi
    
    # Deploy to production
    npx wrangler deploy --env production
  else
    # Deploy to dev/staging
    npx wrangler deploy
  fi
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Deployment successful!${NC}"
  else
    echo -e "${RED}Deployment failed!${NC}"
    exit 1
  fi
}

# Main execution flow
check_requirements
install_dependencies
run_tests
run_typechecking
deploy

echo -e "${PURPLE}✨ MCP Server deployment complete! ✨${NC}"