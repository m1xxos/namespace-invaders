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
  const hullMaterial = new THREE.MeshPhongMaterial({
    color: 0x7dd3fc,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.42,
    shininess: 110,
  })
  const accentMaterial = new THREE.MeshPhongMaterial({
    color: 0xbfdbfe,
    emissive: 0x3b82f6,
    emissiveIntensity: 0.28,
    shininess: 90,
  })

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 8), hullMaterial)
  nose.rotation.x = -Math.PI / 2
  nose.position.z = -0.75
  nose.castShadow = true
  group.add(nose)

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 1.5, 12), hullMaterial)
  body.rotation.x = -Math.PI / 2
  body.position.z = 0.15
  body.castShadow = true
  group.add(body)

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), accentMaterial)
  canopy.position.set(0, 0.22, -0.05)
  canopy.scale.set(1.25, 0.7, 1)
  canopy.castShadow = true
  group.add(canopy)

  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.6), hullMaterial)
  leftWing.position.set(-0.68, 0, 0.18)
  leftWing.rotation.z = 0.08
  leftWing.castShadow = true
  group.add(leftWing)

  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.6), hullMaterial)
  rightWing.position.set(0.68, 0, 0.18)
  rightWing.rotation.z = -0.08
  rightWing.castShadow = true
  group.add(rightWing)

  const leftEngine = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.58, 10), accentMaterial)
  leftEngine.rotation.x = -Math.PI / 2
  leftEngine.position.set(-0.55, -0.12, 0.76)
  leftEngine.castShadow = true
  group.add(leftEngine)

  const rightEngine = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.58, 10), accentMaterial)
  rightEngine.rotation.x = -Math.PI / 2
  rightEngine.position.set(0.55, -0.12, 0.76)
  rightEngine.castShadow = true
  group.add(rightEngine)

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.08), accentMaterial)
  tail.position.set(0, 0.28, 0.65)
  tail.castShadow = true
  group.add(tail)

  group.scale.set(1, 1, 1)
  return group
}
