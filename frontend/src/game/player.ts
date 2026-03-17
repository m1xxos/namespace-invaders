import * as THREE from 'three'

export class Player {
  mesh: THREE.Group
  position: THREE.Vector3
  velocity: THREE.Vector3
  moveSpeed = 0.5
  private baseModelScale = 1.8
  leftPressed = false
  rightPressed = false
  upPressed = false
  downPressed = false

  constructor(scene: THREE.Scene) {
    this.mesh = createK8sLogoModel()
    this.mesh.position.set(0, 0.5, 14)

    this.position = new THREE.Vector3(0, 0.5, 14)
    this.velocity = new THREE.Vector3(0, 0, 0)

    scene.add(this.mesh)

    this.setupControls()
  }

  private setupControls() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase()
      if (key === 'arrowleft' || key === 'a') this.leftPressed = true
      if (key === 'arrowright' || key === 'd') this.rightPressed = true
      if (key === 'arrowup' || key === 'w') this.upPressed = true
      if (key === 'arrowdown' || key === 's') this.downPressed = true
    })

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase()
      if (key === 'arrowleft' || key === 'a') this.leftPressed = false
      if (key === 'arrowright' || key === 'd') this.rightPressed = false
      if (key === 'arrowup' || key === 'w') this.upPressed = false
      if (key === 'arrowdown' || key === 's') this.downPressed = false
    })
  }

  update() {
    // Horizontal movement
    if (this.leftPressed) {
      this.position.x -= this.moveSpeed
    }
    if (this.rightPressed) {
      this.position.x += this.moveSpeed
    }

    // Clamp position
    this.position.x = Math.max(-20, Math.min(20, this.position.x))

    this.mesh.position.copy(this.position)
  }

  setMoveSpeed(speed: number) {
    this.moveSpeed = Math.max(0.1, speed)
  }

  setModelScale(scale: number) {
    const s = Math.max(0.6, scale)
    this.mesh.scale.set(
      this.baseModelScale * s,
      this.baseModelScale * s,
      this.baseModelScale * s,
    )
  }

  cleanup() {
    this.mesh.traverse((child: THREE.Object3D) => {
      const anyChild = child as THREE.Mesh
      if (anyChild.geometry) {
        anyChild.geometry.dispose()
      }
      const material = anyChild.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) {
        for (const m of material) {
          m.dispose()
        }
      } else if (material) {
        material.dispose()
      }
    })
  }
}

function createK8sLogoModel(): THREE.Group {
  const group = new THREE.Group()
  const mainMaterial = new THREE.MeshPhongMaterial({
    color: 0x60a5fa,
    emissive: 0x2563eb,
    emissiveIntensity: 0.55,
    shininess: 120,
  })

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.14, 16, 32), mainMaterial)
  ring.rotation.x = Math.PI / 2
  ring.castShadow = true
  group.add(ring)

  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 16), mainMaterial)
  hub.castShadow = true
  group.add(hub)

  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2

    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), mainMaterial)
    spoke.rotation.y = angle
    spoke.position.set(0.45 * Math.cos(angle), 0, 0.45 * Math.sin(angle))
    spoke.castShadow = true
    group.add(spoke)

    const node = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), mainMaterial)
    node.position.set(0.95 * Math.cos(angle), 0, 0.95 * Math.sin(angle))
    node.castShadow = true
    group.add(node)
  }

  group.scale.set(1, 1, 1)
  return group
}
