import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xeeeeee)

// Camera
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
)
camera.position.set(10, 10, 10)

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.body.appendChild(renderer.domElement)

// Controls
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0, 0)
controls.update()

// Lights (VERY IMPORTANT)
scene.add(new THREE.AmbientLight(0xffffff, 1.2))

const dirLight = new THREE.DirectionalLight(0xffffff, 2)
dirLight.position.set(10, 20, 10)
scene.add(dirLight)

// Grid (debug reference)
scene.add(new THREE.GridHelper(200, 50))

// Load City
const loader = new GLTFLoader()
loader.load(
  '/city.glb',
  (gltf) => {
    const model = gltf.scene
    model.position.set(0, 0, 0)
    model.scale.set(1, 1, 1)
    scene.add(model)

    // Auto-frame camera
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3()).length()
    const center = box.getCenter(new THREE.Vector3())

    camera.position.set(center.x + size, center.y + size * 0.5, center.z + size)
    camera.lookAt(center)
    controls.target.copy(center)
    controls.update()

    console.log('City loaded')
  },
  undefined,
  (err) => {
    console.error('GLB load error', err)
  }
)

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// Render loop
function animate() {
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}
animate()


