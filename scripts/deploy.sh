#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "  GiwaTer Monorepo Deployment Script"
echo "=========================================="

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
DEPLOY_DIR="$HOME/giwater"
REPO_URL="git@github.com:rossjang/giwater.git"
BRANCH="main"
LOG_DIR="${DEPLOY_DIR}/logs"

# ──────────────────────────────────────────────
# OS Detection
# ──────────────────────────────────────────────
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
    else
        echo "Unsupported OS"
        exit 1
    fi
    echo "Detected OS: $OS"
}

# ──────────────────────────────────────────────
# Install Git
# ──────────────────────────────────────────────
install_git() {
    if command -v git &>/dev/null; then
        echo "Git already installed: $(git --version)"
        return
    fi

    echo "Installing Git..."
    case $OS in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y git
            ;;
        amzn|rhel|centos|fedora)
            if command -v dnf &>/dev/null; then
                sudo dnf install -y git
            else
                sudo yum install -y git
            fi
            ;;
        *)
            echo "Unsupported OS for Git installation: $OS"
            exit 1
            ;;
    esac
    echo "Git installed: $(git --version)"
}

# ──────────────────────────────────────────────
# Install Node.js via nvm
# ──────────────────────────────────────────────
install_node() {
    export NVM_DIR="$HOME/.nvm"

    # nvm.sh uses unbound variables internally; disable -u around nvm calls
    set +u
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        echo "nvm already installed"
        . "$NVM_DIR/nvm.sh"
    else
        echo "Installing nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
        . "$NVM_DIR/nvm.sh"
        echo "nvm installed: $(nvm --version)"
    fi

    echo "Installing Node.js LTS..."
    nvm install --lts
    nvm use --lts
    set -u
    echo "Node.js installed: $(node -v)"
}

# ──────────────────────────────────────────────
# Install build tools (make, gcc, g++)
# ──────────────────────────────────────────────
install_build_tools() {
    if command -v make &>/dev/null && command -v gcc &>/dev/null && command -v g++ &>/dev/null; then
        echo "Build tools already installed"
        return
    fi

    echo "Installing build tools..."
    case $OS in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y build-essential
            ;;
        amzn|rhel|centos|fedora)
            if command -v dnf &>/dev/null; then
                sudo dnf install -y make gcc gcc-c++
            else
                sudo yum install -y make gcc gcc-c++
            fi
            ;;
        *)
            echo "Unsupported OS for build tools installation: $OS"
            exit 1
            ;;
    esac
    echo "Build tools installed"
}

# ──────────────────────────────────────────────
# Install pnpm
# ──────────────────────────────────────────────
install_pnpm() {
    if command -v pnpm &>/dev/null; then
        echo "pnpm already installed: $(pnpm --version)"
        return
    fi

    echo "Installing pnpm via corepack..."
    corepack enable
    corepack prepare pnpm@9.0.0 --activate
    echo "pnpm installed: $(pnpm --version)"
}

# ──────────────────────────────────────────────
# Install PM2
# ──────────────────────────────────────────────
install_pm2() {
    if command -v pm2 &>/dev/null; then
        echo "PM2 already installed: $(pm2 -v)"
        return
    fi

    echo "Installing PM2..."
    npm install -g pm2
    echo "PM2 installed: $(pm2 -v)"
}

# ──────────────────────────────────────────────
# Deploy
# ──────────────────────────────────────────────
deploy() {
    echo ""
    echo "=========================================="
    echo "  Starting Deployment"
    echo "=========================================="

    # Clone or pull
    if [ ! -d "${DEPLOY_DIR}/.git" ]; then
        echo "First-time setup: cloning repository..."
        git clone --branch "${BRANCH}" "${REPO_URL}" "${DEPLOY_DIR}"
    else
        echo "Pulling latest changes..."
        cd "${DEPLOY_DIR}"
        git fetch origin "${BRANCH}"
        git reset --hard "origin/${BRANCH}"
    fi

    cd "${DEPLOY_DIR}"
    echo "Commit: $(git rev-parse --short HEAD)"

    # Create log directory
    mkdir -p "${LOG_DIR}"

    # Write environment files
    echo "Writing environment files..."
    if [ -n "${API_ENV:-}" ]; then
        echo "${API_ENV}" > "${DEPLOY_DIR}/apps/api/.env"
        echo "Wrote apps/api/.env"
    else
        echo "API_ENV not set, skipping apps/api/.env"
    fi

    if [ -n "${WEB_ENV:-}" ]; then
        echo "${WEB_ENV}" > "${DEPLOY_DIR}/apps/web/.env.local"
        echo "Wrote apps/web/.env.local"
    else
        echo "WEB_ENV not set, skipping apps/web/.env.local"
    fi

    # Install dependencies
    echo ""
    echo "Installing dependencies..."
    pnpm install --frozen-lockfile

    # Build all packages (Turborepo handles order: shared -> api + web)
    echo ""
    echo "Building all packages..."
    pnpm build

    # Prepare Next.js standalone assets
    echo ""
    echo "Preparing Next.js standalone assets..."
    STANDALONE_DIR="${DEPLOY_DIR}/apps/web/.next/standalone/apps/web"

    if [ -d "${STANDALONE_DIR}" ]; then
        if [ -d "${DEPLOY_DIR}/apps/web/public" ]; then
            cp -r "${DEPLOY_DIR}/apps/web/public" "${STANDALONE_DIR}/public"
            echo "Copied public/ to standalone"
        fi

        if [ -d "${DEPLOY_DIR}/apps/web/.next/static" ]; then
            mkdir -p "${STANDALONE_DIR}/.next"
            cp -r "${DEPLOY_DIR}/apps/web/.next/static" "${STANDALONE_DIR}/.next/static"
            echo "Copied .next/static/ to standalone"
        fi
    else
        echo "WARNING: Standalone directory not found at ${STANDALONE_DIR}"
    fi

    # Run database migrations
    echo ""
    echo "Running database migrations..."
    cd "${DEPLOY_DIR}/apps/api"
    pnpm migration:run || echo "Migration: no pending migrations or failed (check logs)"
    cd "${DEPLOY_DIR}"

    # Restart PM2 processes
    echo ""
    echo "Restarting PM2 processes..."
    if pm2 describe giwater-api &>/dev/null; then
        pm2 reload ecosystem.config.cjs
        echo "PM2 processes reloaded"
    else
        pm2 start ecosystem.config.cjs
        echo "PM2 processes started"
    fi

    pm2 save

    # Health check
    echo ""
    echo "Running health checks..."
    sleep 5

    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null || echo "000")
    WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3007 2>/dev/null || echo "000")

    echo "API health: HTTP ${API_STATUS}"
    echo "Web health: HTTP ${WEB_STATUS}"

    if [ "${API_STATUS}" != "200" ]; then
        echo "WARNING: API health check failed. Run: pm2 logs giwater-api"
    fi
    if [ "${WEB_STATUS}" != "200" ]; then
        echo "WARNING: Web health check failed. Run: pm2 logs giwater-web"
    fi

    echo ""
    echo "=========================================="
    echo "  Deployment Complete!"
    echo "  Commit: $(git rev-parse --short HEAD)"
    echo "=========================================="
    pm2 status
}

# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────
detect_os
install_git
install_node
install_build_tools
install_pnpm
install_pm2
deploy
