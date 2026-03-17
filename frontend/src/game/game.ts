import * as THREE from 'three'
import { Scene } from './scene'
import { Player } from './player'
import { Enemy, createEnemy, updateEnemies, removeEnemy } from './enemies'
import { ProjectileManager } from './projectiles'
import { getResources, deleteResource } from './api'

export interface GameSettings {
  playerSpeed: number
  enemySpeed: number
  mapTiltDeg: number
  playerModelScale: number
}

const DEFAULT_SETTINGS: GameSettings = {
  playerSpeed: 0.5,
  enemySpeed: 0.015,
  mapTiltDeg: 37,
  playerModelScale: 1.0,
}

export class Game {
  private scene: Scene
  private player: Player
  private projectileManager: ProjectileManager
  private enemies: Enemy[] = []
  private namespace: string
  private isRunning = false
  private frameCount = 0
  private spawnTimer = 0
  private enemyHorizontalSpeed = DEFAULT_SETTINGS.enemySpeed
  private enemyHorizontalBounds = 22
  private enemyStepTowardPlayer = 0.55
  private rowDirections: Record<number, number> = {}

  onKill: (() => void) | null = null
  onGameOver: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement, namespace: string, settings?: Partial<GameSettings>) {
    this.namespace = namespace
    this.scene = new Scene(canvas)
    this.player = new Player(this.scene.scene)
    this.projectileManager = new ProjectileManager(
      this.scene.scene,
      () => this.player.position.clone(),
    )

    this.applySettings({ ...DEFAULT_SETTINGS, ...(settings || {}) })
  }

  async start() {
    this.isRunning = true

    // Load initial resources
    try {
      const resources = await getResources(this.namespace)
      const rows = Math.max(3, Math.min(6, Math.ceil(resources.length / 4)))
      const placed: Array<{ x: number; z: number; row: number }> = []

      for (let i = 0; i < resources.length; i++) {
        const resource = resources[i]
        const row = Math.floor(Math.random() * rows)

        let spawnX = 0
        let spawnZ = 0
        let attempts = 0
        do {
          spawnX = (Math.random() - 0.5) * 40
          spawnZ = -6 - row*4.2 + (Math.random() - 0.5) * 2.4
          attempts++
        } while (
          attempts < 24 &&
          placed.some((p) => p.row === row && Math.abs(p.x - spawnX) < 2.5 && Math.abs(p.z - spawnZ) < 1.8)
        )

        placed.push({ x: spawnX, z: spawnZ, row })

        if (this.rowDirections[row] === undefined) {
          this.rowDirections[row] = row % 2 === 0 ? 1 : -1
        }

        const enemy = createEnemy(resource, this.scene.scene, {
          x: spawnX,
          z: spawnZ,
          row,
        })
        this.enemies.push(enemy)
      }
    } catch (error) {
      console.error('Error loading resources:', error)
      throw error
    }

    this.gameLoop()
  }

  private gameLoop = () => {
    if (!this.isRunning) return

    this.frameCount++
    this.spawnTimer++

    // Update game state
    this.player.update()
    this.projectileManager.update()
    const movementResult = updateEnemies(this.enemies, {
      horizontalSpeed: this.enemyHorizontalSpeed,
      horizontalBounds: this.enemyHorizontalBounds,
      rowDirections: this.rowDirections,
    })

    if (movementResult.touchedRows.length > 0) {
      for (const row of movementResult.touchedRows) {
        this.rowDirections[row] = (this.rowDirections[row] ?? 1) * -1
        for (const enemy of this.enemies) {
          if (enemy.row === row) {
            enemy.position.z += this.enemyStepTowardPlayer
            enemy.mesh.position.copy(enemy.position)
          }
        }
      }
    }

    // Check collisions
    this.checkCollisions()

    // Check if all enemies are defeated
    if (this.enemies.length === 0 && this.frameCount > 120) {
      this.isRunning = false
      if (this.onGameOver) {
        this.onGameOver()
      }
      return
    }

    // Render
    this.scene.render()

    requestAnimationFrame(this.gameLoop)
  }

  private checkCollisions() {
    for (let i = this.projectileManager.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectileManager.projectiles[i]

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j]

        // Check collision with main enemy mesh
        const distance = projectile.position.distanceTo(enemy.mesh.position)
        const collisionDist = 1.5

        if (distance < collisionDist) {
          // Check if this is an orbital pod
          if (enemy.orbitalPods) {
            let hitPod = false
            for (const pod of enemy.orbitalPods) {
              const podWorldPos = new THREE.Vector3()
              pod.mesh.getWorldPosition(podWorldPos)
              const podDistance = projectile.position.distanceTo(podWorldPos)

              if (podDistance < 0.8) {
                // Hit a pod
                hitPod = true
                pod.isRecovering = true
                pod.recoverTime = 180 // 3 seconds at 60 FPS

                projectile.cleanup(this.scene.scene)
                this.projectileManager.projectiles.splice(i, 1)
                break
              }
            }

            if (hitPod) {
              break
            }
          }

          if (distance < collisionDist) {
            // Hit the main enemy
            this.deleteEnemy(enemy, j)

            projectile.cleanup(this.scene.scene)
            this.projectileManager.projectiles.splice(i, 1)

            if (this.onKill) {
              this.onKill()
            }
            break
          }
        }
      }
    }
  }

  private async deleteEnemy(enemy: Enemy, index: number) {
    try {
      const resource = enemy.resource

      // For ReplicaSet, also delete the owned pods
      if (resource.kind === 'ReplicaSet' && enemy.orbitalPods) {
        // Owned pods are implicitly deleted together with the parent ReplicaSet.
      }

      // Delete the resource from K8s
      await deleteResource(resource.namespace, resource.kind, resource.name)

      // Remove from scene
      removeEnemy(enemy, this.scene.scene)
      this.enemies.splice(index, 1)
    } catch (error) {
      console.error('Error deleting enemy:', error)
    }
  }

  cleanup() {
    this.isRunning = false
    this.player.cleanup()
    this.projectileManager.cleanup()

    for (const enemy of this.enemies) {
      removeEnemy(enemy, this.scene.scene)
    }
    this.enemies = []

    this.scene.cleanup()
  }

  setPlayerSpeed(speed: number) {
    this.player.setMoveSpeed(speed)
  }

  setEnemySpeed(speed: number) {
    this.enemyHorizontalSpeed = speed
  }

  setMapTilt(degrees: number) {
    this.scene.setTilt(degrees)
  }

  setPlayerModelScale(scale: number) {
    this.player.setModelScale(scale)
  }

  applySettings(settings: Partial<GameSettings>) {
    if (settings.playerSpeed !== undefined) this.setPlayerSpeed(settings.playerSpeed)
    if (settings.enemySpeed !== undefined) this.setEnemySpeed(settings.enemySpeed)
    if (settings.mapTiltDeg !== undefined) this.setMapTilt(settings.mapTiltDeg)
    if (settings.playerModelScale !== undefined) this.setPlayerModelScale(settings.playerModelScale)
  }
}
