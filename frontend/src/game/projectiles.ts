import * as THREE from 'three'

export class Projectile {
  mesh: THREE.Mesh
  position: THREE.Vector3
  velocity: THREE.Vector3 = new THREE.Vector3(0, 0, -0.8)
  speed = 0.8

  constructor(startPos: THREE.Vector3, scene: THREE.Scene) {
    const geometry = new THREE.SphereGeometry(0.15, 8, 8)
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.8,
    })

    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.castShadow = true

    this.position = startPos.clone()
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  update() {
    this.position.add(this.velocity)
    this.mesh.position.copy(this.position)
  }

  isOutOfBounds(): boolean {
    return this.position.z < -30
  }

  cleanup(scene: THREE.Scene) {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as any).dispose()
  }
}

export class ProjectileManager {
  projectiles: Projectile[] = []
  canShoot = true
  shootCooldown = 0
  shootDelay = 10 // frames

  constructor(
    private scene: THREE.Scene,
    private getShootOrigin: () => THREE.Vector3,
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        this.shoot(this.getShootOrigin())
      }
    })
  }

  shoot(startPos?: THREE.Vector3) {
    if (!this.canShoot || this.shootCooldown > 0) return

    const pos = startPos || new THREE.Vector3(0, 0, 16)
    const projectile = new Projectile(pos, this.scene)
    this.projectiles.push(projectile)

    this.shootCooldown = this.shootDelay
  }

  update() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.update()

      if (p.isOutOfBounds()) {
        p.cleanup(this.scene)
        this.projectiles.splice(i, 1)
      }
    }

    if (this.shootCooldown > 0) {
      this.shootCooldown--
    }
  }

  cleanup() {
    for (const p of this.projectiles) {
      p.cleanup(this.scene)
    }
    this.projectiles = []
  }
}
