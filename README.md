# README: Namespace Invaders

A Space Invaders game where Kubernetes resources become enemies. Destroy resources in your cluster to win! 🚀

## Overview

**Namespace Invaders** is an interactive 3D game built with Three.js and Vue 3 that lets you manage your Kubernetes resources in a fun way. Each resource type is represented by a unique geometric shape:

- **Pod** → Cube (blue)
- **Deployment** → Pyramid (red)
- **ReplicaSet** → Cylinder (yellow) with orbiting pods
- **StatefulSet** → Torus (purple)
- **ConfigMap/Secret** → Octahedron (green)
- **Service/Ingress** → Dodecahedron (silver)
- **Custom Resources** → Sphere (color-based on type)

When you destroy an enemy (resource), it's permanently deleted from your Kubernetes cluster with all finalizers removed.

## Quick Start

### Prerequisites

- Kubernetes cluster running (e.g., Kind)
- kubeconfig accessible at `~/.kube/config`
- Docker & Docker Compose
- Node.js 18+
- Go 1.21+

### Setup

1. **Create a Kind cluster** (if you don't have one):

```bash
kind create cluster --name namespace-invaders
```

2. **Apply demo resources** to the cluster:

```bash
kubectl apply -f demo/resources.yaml
```

3. **Start the game**:

```bash
docker-compose up
```

The game will be available at `http://localhost:5173`

### Controls

- **Arrow Keys** or **WASD** - Move your ship
- **Space** - Shoot

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (Vue 3 + Three.js)            │
│  - 3D rendering on canvas               │
│  - Game controls                        │
│  - UI for namespace selection           │
│  Port: 5173                             │
└────────────┬────────────────────────────┘
             │ HTTP/REST
┌────────────▼────────────────────────────┐
│  Backend (Go)                           │
│  - K8s API integration (client-go)      │
│  - Resource loading & deletion          │
│  - CORS enabled                         │
│  Port: 8080                             │
└────────────┬────────────────────────────┘
             │ K8s API
┌────────────▼────────────────────────────┐
│  Kubernetes Cluster (Kind)              │
│  - Resources to destroy                 │
│  - Finalizer removal                    │
│  - Forced deletion                      │
└─────────────────────────────────────────┘
```

## API Endpoints

### Backend

- `GET /api/namespaces` - Get available namespaces
- `GET /api/resources?namespace=default` - Get all resources in a namespace
- `POST /api/resources/delete` - Delete a resource
  ```json
  {
    "namespace": "default",
    "kind": "Pod",
    "name": "my-pod"
  }
  ```

## Game Mechanics

### ReplicaSet with Orbital Pods

When you target a ReplicaSet:
- Up to 5 owned pods orbit around the cylinder
- Destroying an individual pod makes it become transparent for 3 seconds (recovery period)
- After recovery, the pod becomes active gain
- Destroying the ReplicaSet removes it and all its pods

### Resource-Specific Behavior

- **Pods** (standalone) - Simple enemies, can be destroyed directly
- **Deployments** - Destroy the deployment to remove all related resources
- **StatefulSets** - Similar to deployments but with ordered pod destruction
- **ConfigMaps/Secrets** - Small enemies, quick destruction
- **Services** - Utility resources, can be deleted
- **Custom Resources** - Dynamically discovered and displayed based on type

## Demo Resources

The `demo/resources.yaml` file creates:

- 1 Deployment (nginx) with 2 replicas
- 1 ReplicaSet with 3 pods
- 1 StatefulSet
- 2 ConfigMaps
- 1 Service
- Custom Resources (SimpleResource examples)

## Development

### Local Development with docker-compose

```bash
# Terminal 1: Start backend and database
docker-compose up backend

# Terminal 2: Start frontend dev server  
docker-compose up frontend
```

Frontend dev server will watch for changes and hot-reload.

### Building for Production

```bash
docker-compose build
docker-compose up
```

## Project Structure

```
namespace-invaders/
├── backend/
│   ├── main.go              # Server entry point
│   ├── api/
│   │   ├── handler.go       # HTTP handlers
│   │   └── response.go      # Response structures
│   ├── k8s/
│   │   ├── client.go        # K8s client initialization
│   │   ├── loader.go        # Resource loading
│   │   └── deleter.go       # Resource deletion
│   └── go.mod
├── frontend/
│   ├── src/
│   │   ├── main.ts          # Vue app entry
│   │   ├── App.vue          # Main component
│   │   ├── game/
│   │   │   ├── api.ts       # API client
│   │   │   ├── scene.ts     # Three.js scene
│   │   │   ├── enemies.ts   # Enemy class & geometry
│   │   │   ├── player.ts    # Player ship
│   │   │   ├── projectiles.ts # Shooting mechanics
│   │   │   └── game.ts      # Game logic
│   │   └── styles/
│   │       └── main.css     # Styling
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── demo/
│   ├── start.sh             # Quick setup script
│   ├── resources.yaml       # Demo K8s resources
│   └── crd-example.yaml     # Custom resource examples
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## Troubleshooting

### Backend can't connect to K8s

Make sure:
- Kind cluster is running: `kind get clusters`
- kubeconfig is accessible: `kubectl cluster-info`
- Kubeconfig path is correct: `echo $KUBECONFIG` or `~/.kube/config`

### Frontend showing no resources

1. Check backend logs: `docker-compose logs backend`
2. Test API: `curl http://localhost:8080/api/namespaces`
3. Check K8s resources: `kubectl get all -A`

### Collision detection not working

- Enemies may spawn too far away
- Check browser console for errors
- Verify projectile mesh is being created

## Future Enhancements

- [ ] Health system for enemies
- [ ] Score/leaderboard
- [ ] Wave-based difficulty progression
- [ ] Power-ups
- [ ] More complex CRD handling
- [ ] Sound effects
- [ ] Multiplayer

## License

MIT

## Contributing

Feel free to submit issues and pull requests!
