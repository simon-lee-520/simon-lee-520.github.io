import * as THREE from 'three'

/**
 * 城市幕户外暖色环境探针（程序化夕阳天空 + 橙日）。
 * 用于替换全局 RoomEnvironment，避免室内灰盒 IBL 把赛博夕阳洗平。
 */
export function createCitySunsetEnvScene () {
  const scene = new THREE.Scene()

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vDir = normalize(w.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 zenith = vec3(0.12, 0.04, 0.14);
        vec3 mid = vec3(0.85, 0.28, 0.32);
        vec3 horizon = vec3(1.0, 0.55, 0.28);
        vec3 nadir = vec3(0.03, 0.02, 0.05);
        vec3 col = mix(horizon, mid, smoothstep(-0.05, 0.4, h));
        col = mix(col, zenith, smoothstep(0.35, 0.95, h));
        col = mix(nadir, col, smoothstep(-0.85, 0.02, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), skyMat)
  scene.add(sky)

  // 橙日：写入 env map，给 PBR 反射/漫反射暖高光
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.8, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffc060 })
  )
  sun.position.set(12, 7, -28)
  scene.add(sun)

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(9, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff7a28,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    })
  )
  glow.position.copy(sun.position)
  scene.add(glow)

  scene.add(new THREE.AmbientLight(0xffe0c8, 0.35))
  const key = new THREE.DirectionalLight(0xffb070, 1.4)
  key.position.copy(sun.position)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x6a80c0, 0.25)
  fill.position.set(-20, 8, 10)
  scene.add(fill)

  return scene
}
