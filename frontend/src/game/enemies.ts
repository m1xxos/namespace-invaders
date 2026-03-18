import * as THREE from 'three'
import { Resource } from './api'

const COLOR_MAP: Record<string, number> = {
  Pod: 0x00aaff,
  Deployment: 0xff0055,
  ReplicaSet: 0xffaa00,
  StatefulSet: 0xaa00ff,
  ConfigMap: 0x00ff88,
  Secret: 0x00ff88,
  Service: 0xaaaaaa,
  Ingress: 0xaaaaaa,
  // Default for unknown resources and CRDs
}

export interface Enemy {
  uid: string
  name: string
  kind: string
  resource: Resource
  mesh: THREE.Mesh
  label: THREE.Sprite
  row: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  color: number
  isRecovering?: boolean
  recoverTime?: number
  orbitalPods?: OrbitalPod[]
  maxOrbitalPods?: number
}

export interface EnemyMovementConfig {
  horizontalSpeed: number
  horizontalBounds: number
  rowDirections: Record<number, number>
}

export interface OrbitalPod {
  uid: string
  name: string
  mesh: THREE.Mesh
  label: THREE.Sprite
  angle: number
  radius: number
  isRecovering: boolean
  recoverTime: number
}

type GuardMode = 'replicaset' | 'deployment'

export function createEnemyGeometry(kind: string): { geometry: THREE.BufferGeometry; color: number } {
  let geometry: THREE.BufferGeometry
  let color = COLOR_MAP[kind] || 0xaaaaaa

  // Determine color for CRDs based on type name
  if (!COLOR_MAP[kind]) {
    const hashCode = kind.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const hue = (hashCode % 360) / 360
    const rgbColor = new THREE.Color().setHSL(hue, 0.7, 0.5)
    color = rgbColor.getHex()
  }

  switch (kind) {
    case 'Pod':
      geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8)
      break
    case 'Deployment':
      geometry = new THREE.ConeGeometry(0.8, 1.5, 8)
      break
    case 'ReplicaSet':
      geometry = new THREE.CylinderGeometry(1, 1, 0.5, 16)
      break
    case 'StatefulSet':
      geometry = new THREE.TorusGeometry(1, 0.4, 16, 32)
      break
    case 'ConfigMap':
    case 'Secret':
      geometry = new THREE.OctahedronGeometry(0.7)
      break
    case 'Service':
    case 'Ingress':
      geometry = new THREE.DodecahedronGeometry(0.6)
      break
    default:
      // For CRDs: use sphere by default
      geometry = new THREE.SphereGeometry(0.7, 16, 16)
  }

  return { geometry, color }
}

interface EnemySpawnPosition {
  x: number
  z: number
  row: number
}

export function createEnemy(
  resource: Resource,
  scene: THREE.Scene,
  spawn?: EnemySpawnPosition,
): Enemy {
  const { geometry, color } = createEnemyGeometry(resource.kind)
  const material = new THREE.MeshPhongMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.3,
    shininess: 100,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true

  const x = spawn?.x ?? (Math.random() - 0.5) * 40
  const z = spawn?.z ?? -(Math.random() * 18 + 6)
  const row = spawn?.row ?? 0

  mesh.position.set(x, 0, z)
  const label = createResourceLabel(resource.kind, resource.name)
  label.position.set(0, 1.8, 0)
  mesh.add(label)

  scene.add(mesh)

  const enemy: Enemy = {
    uid: resource.uid,
    name: resource.name,
    kind: resource.kind,
    resource,
    mesh,
    label,
    row,
    position: new THREE.Vector3(x, 0, z),
    velocity: new THREE.Vector3(0, 0, 0),
    color,
    isRecovering: false,
    recoverTime: 0,
  }

  // Handle ReplicaSet with orbital pods
  if (resource.kind === 'ReplicaSet' && resource.ownerPods && resource.ownerPods.length > 0) {
    createOrbitalPods(enemy, resource.ownerPods, 'replicaset')
  }

  // Deployment receives larger guard pods derived from owned workload pods.
  if (resource.kind === 'Deployment' && resource.ownerPods && resource.ownerPods.length > 0) {
    createOrbitalPods(enemy, resource.ownerPods, 'deployment')
  }

  return enemy
}

function kindAbbrev(kind: string): string {
  const map: Record<string, string> = {
    Pod: 'pod',
    Deployment: 'deploy',
    ReplicaSet: 'rs',
    StatefulSet: 'sts',
    ConfigMap: 'cm',
    Secret: 'sec',
    Service: 'svc',
    Ingress: 'ing',
  }
  return map[kind] || kind.toLowerCase().slice(0, 4)
}

function shortenResourceName(name: string, maxLen = 16): string {
  if (name.length <= maxLen) {
    return name
  }

  const head = Math.max(6, maxLen - 7)
  return `${name.slice(0, head)}...${name.slice(-3)}`
}

function createResourceLabel(kind: string, name: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 92
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    const fallback = new THREE.SpriteMaterial({ color: 0xffffff })
    const sprite = new THREE.Sprite(fallback)
    sprite.scale.set(2.2, 0.55, 1)
    return sprite
  }

  const text = `${kindAbbrev(kind)}/${shortenResourceName(name)}`
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'rgba(10, 14, 39, 0.7)'
  ctx.fillRect(0, 8, canvas.width, 76)
  ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)'
  ctx.lineWidth = 2
  ctx.strokeRect(2, 9, canvas.width - 4, 74)
  ctx.fillStyle = '#e0e0ff'
  ctx.font = 'bold 38px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(5.8, 1.35, 1)
  return sprite
}

function createGuardLabel(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 260
  canvas.height = 64
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }))
  }

  const text = `pod/${shortenResourceName(name, 12)}`
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'rgba(10, 14, 39, 0.7)'
  ctx.fillRect(0, 6, canvas.width, 50)
  ctx.strokeStyle = 'rgba(255, 102, 119, 0.85)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 7, canvas.width - 2, 48)
  ctx.fillStyle = '#ffe6ea'
  ctx.font = 'bold 22px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(2.8, 0.72, 1)
  return sprite
}

function createOrbitalPods(enemy: Enemy, podUids: string[], mode: GuardMode) {
  enemy.orbitalPods = []
  const uniquePodUids = Array.from(new Set(podUids))
  enemy.maxOrbitalPods = mode === 'deployment' ? uniquePodUids.length : 8

  const numPodsToShow = Math.min(uniquePodUids.length, enemy.maxOrbitalPods)
  const radius = mode === 'deployment' ? 3.4 : 2.5
  const podSize = mode === 'deployment' ? 0.92 : 0.5
  const podColor = mode === 'deployment' ? 0xff6677 : 0x00aaff

  for (let i = 0; i < numPodsToShow; i++) {
    const podGeometry = new THREE.BoxGeometry(podSize, podSize, podSize)
    const podMaterial = new THREE.MeshPhongMaterial({
      color: podColor,
      emissive: podColor,
      emissiveIntensity: mode === 'deployment' ? 0.38 : 0.2,
    })

    const podMesh = new THREE.Mesh(podGeometry, podMaterial)
    podMesh.castShadow = true

    const angle = (i / numPodsToShow) * Math.PI * 2
    podMesh.position.set(radius * Math.cos(angle), 0, radius * Math.sin(angle))

    const label = createGuardLabel(uniquePodUids[i])
    label.position.set(0, podSize + 0.55, 0)
    podMesh.add(label)

    enemy.mesh.add(podMesh)

    enemy.orbitalPods.push({
      uid: uniquePodUids[i],
      name: uniquePodUids[i],
      mesh: podMesh,
      label,
      angle,
      radius,
      isRecovering: false,
      recoverTime: 0,
    })
  }
}

export function updateEnemies(
  enemies: Enemy[],
  movement: EnemyMovementConfig,
): { touchedRows: number[] } {
  const touchedRows = new Set<number>()

  for (const enemy of enemies) {
    const dir = movement.rowDirections[enemy.row] ?? 1
    enemy.position.x += dir * movement.horizontalSpeed

    if (
      enemy.position.x >= movement.horizontalBounds ||
      enemy.position.x <= -movement.horizontalBounds
    ) {
      touchedRows.add(enemy.row)
      enemy.position.x = Math.max(-movement.horizontalBounds, Math.min(movement.horizontalBounds, enemy.position.x))
    }

    enemy.mesh.position.copy(enemy.position)

    // Update orbital pods
    if (enemy.orbitalPods) {
      for (const pod of enemy.orbitalPods) {
        if (pod.isRecovering) {
          pod.recoverTime -= 1
          const recoveryProgress = 1 - pod.recoverTime / 180 // 3 seconds at 60 FPS
          const podMaterial = pod.mesh.material as THREE.MeshPhongMaterial
          podMaterial.opacity = 0.3 + recoveryProgress * 0.7
          podMaterial.transparent = true

          if (pod.recoverTime <= 0) {
            pod.isRecovering = false
            podMaterial.transparent = false
            podMaterial.opacity = 1
          }
        }

        // Rotate orbit
        pod.angle += 0.02
        pod.mesh.position.x = pod.radius * Math.cos(pod.angle)
        pod.mesh.position.z = pod.radius * Math.sin(pod.angle)
      }
    }

    // Update recovery state
    if (enemy.isRecovering && enemy.recoverTime !== undefined) {
      enemy.recoverTime--
      if (enemy.recoverTime <= 0) {
        enemy.isRecovering = false
      }
    }
  }

  return { touchedRows: Array.from(touchedRows) }
}

export function removeEnemy(enemy: Enemy, scene: THREE.Scene) {
  scene.remove(enemy.mesh)
  if (enemy.label.material) {
    const spriteMaterial = enemy.label.material as THREE.SpriteMaterial
    if (spriteMaterial.map) {
      spriteMaterial.map.dispose()
    }
    spriteMaterial.dispose()
  }
  if (enemy.orbitalPods) {
    for (const pod of enemy.orbitalPods) {
      const podLabelMaterial = pod.label.material as THREE.SpriteMaterial
      if (podLabelMaterial.map) {
        podLabelMaterial.map.dispose()
      }
      podLabelMaterial.dispose()
    }
  }
  if (enemy.mesh.geometry) {
    enemy.mesh.geometry.dispose()
  }
  if (enemy.mesh.material) {
    ;(enemy.mesh.material as any).dispose()
  }
}
