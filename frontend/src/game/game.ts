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
  playerSpeed: 0.25,
  enemySpeed: 0.02,
  mapTiltDeg: 70,
  playerModelScale: 0.7,
}

export class Game {
  private scene: Scene
  private player: Player
  private projectileManager: ProjectileManager
  private enemies: Enemy[] = []
  private namespace: string
  private isRunning = false
  private frameCount = 0
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
      const shuffledResources = [...resources]
      for (let i = shuffledResources.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffledResources[i], shuffledResources[j]] = [shuffledResources[j], shuffledResources[i]]
      }

      const columns = 7
      const spacingX = 5.2
      const spacingZ = 3.2
      const originX = -((columns - 1) * spacingX) / 2
      const originZ = -7

      for (let i = 0; i < shuffledResources.length; i++) {
        const resource = shuffledResources[i]
        const row = Math.floor(i / columns)
        const col = i % columns
        const spawnX = originX + col * spacingX
        const spawnZ = originZ - row * spacingZ

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

        // Guard pods block shots physically for deployments and replicasets.
        if (enemy.orbitalPods && enemy.orbitalPods.length > 0) {
          let consumedByGuard = false
          for (const pod of enemy.orbitalPods) {
            if (pod.isRecovering) {
              continue
            }

            const podWorldPos = new THREE.Vector3()
            pod.mesh.getWorldPosition(podWorldPos)
            const podDistance = projectile.position.distanceTo(podWorldPos)

            // Make deployment guards true blockers with larger hit radius.
            const podCollisionDist = enemy.kind === 'Deployment' ? 1.1 : 0.8
            if (podDistance < podCollisionDist) {
              pod.isRecovering = true
              pod.recoverTime = enemy.kind === 'Deployment' ? 260 : 180
              projectile.cleanup(this.scene.scene)
              this.projectileManager.projectiles.splice(i, 1)
              consumedByGuard = true
              break
            }
          }

          if (consumedByGuard) {
            break
          }
        }

        // Check collision with main enemy mesh
        const distance = projectile.position.distanceTo(enemy.mesh.position)
        const collisionDist = 1.5

        if (distance < collisionDist) {
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
