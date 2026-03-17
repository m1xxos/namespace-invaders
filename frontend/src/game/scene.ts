import * as THREE from 'three'

export class Scene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  width: number
  height: number
  private cameraDistance = 25

  constructor(canvas: HTMLCanvasElement) {
    this.width = window.innerWidth
    this.height = window.innerHeight

    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0e27)
    this.scene.fog = new THREE.FogExp2(0x0a0e27, 0.003)

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000)
    this.setTilt(37)

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = true

    // Lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 20, 10)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    this.scene.add(directionalLight)

    const ambientLight = new THREE.AmbientLight(0x00ff88, 0.4)
    ambientLight.color.setHSL(0.25, 1, 0.5)
    this.scene.add(ambientLight)

    // Add a subtle grid
    const gridHelper = new THREE.GridHelper(60, 30, 0x00ff88, 0x00ff88)
    gridHelper.position.y = -2
    gridHelper.material.transparent = true
    gridHelper.material.opacity = 0.15
    this.scene.add(gridHelper)

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize())
  }

  private onWindowResize() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.width, this.height)
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  setTilt(degrees: number) {
    const safeDeg = Math.max(18, Math.min(70, degrees))
    const rad = (safeDeg * Math.PI) / 180
    const y = Math.sin(rad) * this.cameraDistance
    const z = Math.cos(rad) * this.cameraDistance
    this.camera.position.set(0, y, z)
    this.camera.lookAt(0, 0, 0)
  }

  cleanup() {
    this.renderer.dispose()
    window.removeEventListener('resize', () => this.onWindowResize())
  }
}
