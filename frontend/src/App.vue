<template>
  <div class="app-container">
    <template v-if="gameState === 'namespace-select'">
      <div class="modal">
        <div class="modal-title">⚔️ Namespace Invaders</div>
        <div class="modal-content">
          <div class="form-group">
            <label class="form-label">Select Namespace</label>
            <select v-model="selectedNamespace" :disabled="loading">
              <option value="">-- Choose a namespace --</option>
              <option v-for="ns in namespaces" :key="ns.name" :value="ns.name">
                {{ ns.name }}
              </option>
            </select>
          </div>

          <button @click="startGame" :disabled="!selectedNamespace || loading">
            <span v-if="loading">
              <span class="loading">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </span>
            </span>
            <span v-else>Start Game</span>
          </button>

          <div class="tuning-section">
            <div class="form-label">Gameplay Tuning</div>

            <div class="slider-row">
              <label>Player Speed: {{ playerSpeed.toFixed(2) }}</label>
              <input v-model.number="playerSpeed" type="range" min="0.2" max="1.5" step="0.05" />
            </div>

            <div class="slider-row">
              <label>Resource Speed: {{ enemySpeed.toFixed(3) }}</label>
              <input v-model.number="enemySpeed" type="range" min="0.005" max="0.08" step="0.005" />
            </div>

            <div class="slider-row">
              <label>Map Tilt: {{ mapTiltDeg }}°</label>
              <input v-model.number="mapTiltDeg" type="range" min="18" max="70" step="1" />
            </div>

            <div class="slider-row">
              <label>Model Size: {{ playerModelScale.toFixed(2) }}</label>
              <input v-model.number="playerModelScale" type="range" min="0.6" max="2.4" step="0.05" />
            </div>
          </div>

          <div class="controls-hint">
            Use ARROW KEYS or WASD to move<br />
            Press SPACE to shoot
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="gameState === 'playing'">
      <div class="ui-overlay">
        <div class="ui-top">
          <div class="namespace-display">{{ selectedNamespace }}</div>
          <div class="score">KILLS: {{ killCount }}</div>
        </div>

        <div class="tuning-panel">
          <div class="tuning-title">Live Tuning</div>
          <div class="slider-row compact">
            <label>P: {{ playerSpeed.toFixed(2) }}</label>
            <input v-model.number="playerSpeed" type="range" min="0.2" max="1.5" step="0.05" />
          </div>
          <div class="slider-row compact">
            <label>R: {{ enemySpeed.toFixed(3) }}</label>
            <input v-model.number="enemySpeed" type="range" min="0.005" max="0.08" step="0.005" />
          </div>
          <div class="slider-row compact">
            <label>T: {{ mapTiltDeg }}°</label>
            <input v-model.number="mapTiltDeg" type="range" min="18" max="70" step="1" />
          </div>
          <div class="slider-row compact">
            <label>M: {{ playerModelScale.toFixed(2) }}</label>
            <input v-model.number="playerModelScale" type="range" min="0.6" max="2.4" step="0.05" />
          </div>
        </div>
      </div>
      <canvas ref="canvas"></canvas>
    </template>

    <template v-else-if="gameState === 'game-over'">
      <div class="modal" style="min-width: 450px">
        <div class="modal-title">Game Over!</div>
        <div class="modal-content">
          <div style="font-size: 20px; text-align: center; color: var(--color-accent); margin: 20px 0">
            Resources Destroyed: <strong>{{ killCount }}</strong>
          </div>

          <button @click="backToNamespaceSelect">Back to Menu</button>

          <div class="controls-hint" style="margin-top: 10px">
            All resources in the {{ selectedNamespace }} namespace have been eliminated!
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { getNamespaces } from './game/api'
import { Game, GameSettings } from './game/game'

type GameState = 'namespace-select' | 'playing' | 'game-over'

const gameState = ref<GameState>('namespace-select')
const namespaces = ref<Array<{ name: string }>>([])
const selectedNamespace = ref('')
const loading = ref(false)
const killCount = ref(0)
const canvas = ref<HTMLCanvasElement | null>(null)
const playerSpeed = ref(0.25)
const enemySpeed = ref(0.02)
const mapTiltDeg = ref(70)
const playerModelScale = ref(0.7)
let game: Game | null = null

watch([playerSpeed, enemySpeed, mapTiltDeg, playerModelScale], () => {
  if (!game) return
  game.applySettings({
    playerSpeed: playerSpeed.value,
    enemySpeed: enemySpeed.value,
    mapTiltDeg: mapTiltDeg.value,
    playerModelScale: playerModelScale.value,
  })
})

onMounted(async () => {
  try {
    const data = await getNamespaces()
    namespaces.value = data
    if (data.length > 0) {
      selectedNamespace.value = data[0].name
    }
  } catch (error) {
    console.error('Failed to load namespaces:', error)
    alert('Error loading namespaces. Make sure the backend is running.')
  }
})

const startGame = async () => {
  if (!selectedNamespace.value) return

  loading.value = true
  try {
    if (game) {
      game.cleanup()
      game = null
    }

    gameState.value = 'playing'
    await nextTick()

    if (!canvas.value) {
      throw new Error('Game canvas is not ready yet')
    }

    const settings: Partial<GameSettings> = {
      playerSpeed: playerSpeed.value,
      enemySpeed: enemySpeed.value,
      mapTiltDeg: mapTiltDeg.value,
      playerModelScale: playerModelScale.value,
    }
    game = new Game(canvas.value, selectedNamespace.value, settings)
    if (import.meta.env.DEV) {
      ;(window as any).__namespaceInvadersGame = game
    }
    
    game.onKill = () => {
      killCount.value++
    }

    game.onGameOver = () => {
      gameState.value = 'game-over'
    }

    game.start()
  } catch (error) {
    console.error('Failed to start game:', error)
    alert('Error starting game: ' + error)
    gameState.value = 'namespace-select'
  } finally {
    loading.value = false
  }
}

const backToNamespaceSelect = () => {
  if (game) {
    game.cleanup()
    game = null
      if (import.meta.env.DEV) {
        ;(window as any).__namespaceInvadersGame = null
      }
  }
  gameState.value = 'namespace-select'
  killCount.value = 0
}
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
