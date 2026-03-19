#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🚀 Namespace Invaders Setup Script 🚀  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if Kind is installed
if ! command -v kind &> /dev/null; then
    echo -e "${YELLOW}Kind is not installed. Installing...${NC}"
    if command -v brew &> /dev/null; then
        brew install kind
    else
        echo -e "${RED}Please install Kind manually: https://kind.sigs.k8s.io/docs/user/quick-start/${NC}"
        exit 1
    fi
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl is not installed. Please install it first.${NC}"
    exit 1
fi

# Create Kind cluster if it doesn't exist
CLUSTER_NAME="namespace-invaders"
echo -e "${YELLOW}Setting up Kind cluster: ${CLUSTER_NAME}${NC}"

if kind get clusters | grep -q "$CLUSTER_NAME"; then
    echo -e "${GREEN}Cluster ${CLUSTER_NAME} already exists${NC}"
else
    echo -e "${YELLOW}Creating new cluster...${NC}"
    kind create cluster --name "$CLUSTER_NAME"
    echo -e "${GREEN}Cluster created successfully${NC}"
fi

# Set kubeconfig
export KUBECONFIG="$HOME/.kube/config"
echo -e "${GREEN}Using kubeconfig: $KUBECONFIG${NC}"

# Resolve demo directory early for generated files
DEMO_DIR="$(dirname "$0")"

# Wait for cluster to be ready
echo -e "${YELLOW}Waiting for cluster to be ready...${NC}"
sleep 5

# Verify cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot access Kubernetes cluster${NC}"
    exit 1
fi

# Generate internal kubeconfig for containers (localhost in host kubeconfig is not reachable from containers)
INTERNAL_KUBECONFIG="$DEMO_DIR/kubeconfig.internal"
echo -e "${YELLOW}Generating internal kubeconfig for Docker services...${NC}"
kind get kubeconfig --name "$CLUSTER_NAME" --internal > "$INTERNAL_KUBECONFIG"
chmod 600 "$INTERNAL_KUBECONFIG"
echo -e "${GREEN}Internal kubeconfig generated: $INTERNAL_KUBECONFIG${NC}"

# Apply demo resources
echo -e "${YELLOW}Applying demo resources...${NC}"
kubectl apply -f "$DEMO_DIR/resources.yaml" --wait=true

# Try to apply CRD examples if they exist
if [ -f "$DEMO_DIR/crd-example.yaml" ]; then
    echo -e "${YELLOW}Applying CRD examples...${NC}"
    kubectl apply -f "$DEMO_DIR/crd-example.yaml" --wait=true 2>/dev/null || echo -e "${YELLOW}(CRD examples skipped - some may not be available)${NC}"
fi

# Show what got created
echo ""
echo -e "${GREEN}Resources created:${NC}"
kubectl get all -n default --no-headers | head -10

# Start docker-compose
echo ""
echo -e "${YELLOW}Starting docker-compose...${NC}"
cd "$(dirname "$DEMO_DIR")"
docker-compose up -d

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Setup Complete!                    ║${NC}"
echo -e "${GREEN}║  🎮 Game Ready!                        ║${NC}"
echo -e "${GREEN}║  URL: http://localhost:5173            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"

