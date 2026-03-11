import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const WORLD_LIMIT = 28;
const WALK_SPEED = 10;
const EYE_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.75;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06101d, 0.018);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);
camera.position.set(0, EYE_HEIGHT, 18);
camera.lookAt(0, EYE_HEIGHT, 0);

const controls = new PointerLockControls(camera, document.body);
const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
};

const statusLine = document.getElementById("statusLine");
const lockPanel = document.getElementById("lockPanel");
const startButton = document.getElementById("startButton");

const textureLoader = new THREE.TextureLoader();
const clock = new THREE.Clock();
const animatedObjects = [];
const pulsingLights = [];
const boxColliders = [];
const circleColliders = [];

// Wow point note for the submission:
// the centerpiece is the floating beacon and imported shrine, both staged under layered lighting.

setupPointerLock();

const textures = loadTextures();
buildSkybox(textures.sky);
addGround(textures);
addWalls(textures);
addCourtyardStructures(textures);
addLanternPath();
addTrees();
addCrates(textures);
addBeacon();
addLights();
loadShrineModel().catch((error) => {
  console.error("Failed to load shrine model:", error);
});

window.addEventListener("resize", onWindowResize);
document.addEventListener("keydown", onKeyChange(true));
document.addEventListener("keyup", onKeyChange(false));

renderer.setAnimationLoop(render);

function setupPointerLock() {
  startButton.addEventListener("click", () => controls.lock());

  controls.addEventListener("lock", () => {
    lockPanel.classList.add("hidden");
    statusLine.textContent = "Mouse look active. Explore the observatory with W A S D.";
  });

  controls.addEventListener("unlock", () => {
    lockPanel.classList.remove("hidden");
    statusLine.textContent = "Mouse look is paused.";
  });
}

function loadTextures() {
  const grass = textureLoader.load(new URL("./grass.jpg", import.meta.url).href);
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.wrapS = THREE.RepeatWrapping;
  grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(18, 18);

  const brick = textureLoader.load(new URL("./brick.jpg", import.meta.url).href);
  brick.colorSpace = THREE.SRGBColorSpace;
  brick.wrapS = THREE.RepeatWrapping;
  brick.wrapT = THREE.RepeatWrapping;
  brick.repeat.set(3, 1.5);

  const wood = textureLoader.load(new URL("./wood.png", import.meta.url).href);
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = THREE.RepeatWrapping;
  wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(1.5, 1.5);

  const sky = new URL("./sky.jpg", import.meta.url).href;

  return { grass, brick, wood, sky };
}

function buildSkybox(skyUrl) {
  const cubeTexture = new THREE.CubeTextureLoader().load([
    skyUrl,
    skyUrl,
    skyUrl,
    skyUrl,
    skyUrl,
    skyUrl,
  ]);
  cubeTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = cubeTexture;
}

function addGround(textures) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshStandardMaterial({
      map: textures.grass,
      roughness: 0.95,
      metalness: 0.05,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const innerWalk = new THREE.Mesh(
    new THREE.RingGeometry(8, 15, 48),
    new THREE.MeshStandardMaterial({
      color: 0x5e6873,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  innerWalk.rotation.x = -Math.PI / 2;
  innerWalk.position.y = 0.02;
  innerWalk.receiveShadow = true;
  scene.add(innerWalk);
}

function addWalls(textures) {
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: textures.brick,
    roughness: 0.8,
    metalness: 0.05,
  });

  const wallSpecs = [
    { position: [0, 2.5, -24], size: [44, 5, 2] },
    { position: [0, 2.5, 24], size: [44, 5, 2] },
    { position: [-24, 2.5, 0], size: [2, 5, 44] },
    { position: [24, 2.5, 0], size: [2, 5, 44] },
  ];

  wallSpecs.forEach(({ position, size }) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...size), wallMaterial);
    wall.position.set(...position);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    addBoxCollider(position[0], position[2], size[0], size[2]);
  });

  const towerMaterial = new THREE.MeshStandardMaterial({
    map: textures.brick,
    roughness: 0.75,
    metalness: 0.08,
  });

  [
    [-20, 4, -20],
    [20, 4, -20],
    [-20, 4, 20],
    [20, 4, 20],
  ].forEach((position) => {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.8, 8, 18),
      towerMaterial
    );
    tower.position.set(...position);
    tower.castShadow = true;
    tower.receiveShadow = true;
    scene.add(tower);
    addCircleCollider(position[0], position[2], 2.7);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 2.6, 18),
      new THREE.MeshStandardMaterial({ color: 0x473431, roughness: 0.88 })
    );
    roof.position.set(position[0], 9.2, position[2]);
    roof.castShadow = true;
    scene.add(roof);
  });
}

function addCourtyardStructures(textures) {
  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xa8b0c2,
    roughness: 0.72,
    metalness: 0.15,
  });

  const observatoryBase = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 7, 3.5, 32),
    stoneMaterial
  );
  observatoryBase.position.set(0, 1.75, 0);
  observatoryBase.castShadow = true;
  observatoryBase.receiveShadow = true;
  scene.add(observatoryBase);
  addCircleCollider(0, 0, 6.8);

  const observatoryDome = new THREE.Mesh(
    new THREE.SphereGeometry(4.8, 32, 24),
    new THREE.MeshStandardMaterial({
      color: 0x8798b5,
      roughness: 0.28,
      metalness: 0.4,
      transparent: true,
      opacity: 0.95,
      emissive: 0x2e4d7a,
      emissiveIntensity: 1.1,
    })
  );
  observatoryDome.position.set(0, 5.5, 0);
  observatoryDome.castShadow = true;
  scene.add(observatoryDome);

  const domeGlow = new THREE.PointLight(0x7ec8ff, 2.4, 28, 2);
  domeGlow.position.set(0, 7.5, 0);
  scene.add(domeGlow);
  pulsingLights.push({ light: domeGlow, offset: 2.4, base: 2.4, swing: 0.35 });

  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2, 1.2, 18),
    new THREE.MeshStandardMaterial({
      map: textures.wood,
      roughness: 0.88,
      metalness: 0.05,
    })
  );
  podium.position.set(0, 0.6, 0);
  podium.castShadow = true;
  podium.receiveShadow = true;
  scene.add(podium);

  [
    [-8, 1.5, 0],
    [8, 1.5, 0],
    [0, 1.5, -8],
    [0, 1.5, 8],
  ].forEach((position, index) => {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 3, 14),
      stoneMaterial
    );
    column.position.set(...position);
    column.castShadow = true;
    column.receiveShadow = true;
    scene.add(column);
    addCircleCollider(position[0], position[2], 0.95);

    const cap = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.14, 12, 32),
      new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0xdbd6ff : 0x8fd8ff,
        emissive: index % 2 === 0 ? 0x2c235d : 0x0e3848,
        roughness: 0.35,
        metalness: 0.42,
      })
    );
    cap.rotation.x = Math.PI / 2;
    cap.position.set(position[0], 3.15, position[2]);
    cap.castShadow = true;
    scene.add(cap);
  });
}

function addLanternPath() {
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x45362b,
    roughness: 0.92,
    metalness: 0.08,
  });
  const globeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd77c,
    emissive: 0xffb347,
    emissiveIntensity: 2.2,
    roughness: 0.18,
    metalness: 0.25,
  });

  const lanternPositions = [
    [-12, -12],
    [-12, -4],
    [-12, 4],
    [-12, 12],
    [12, -12],
    [12, -4],
    [12, 4],
    [12, 12],
  ];

  lanternPositions.forEach(([x, z], index) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 3.2, 12),
      postMaterial
    );
    post.position.set(x, 1.6, z);
    post.castShadow = true;
    scene.add(post);
    addCircleCollider(x, z, 0.45);

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 18, 18),
      globeMaterial
    );
    globe.position.set(x, 3.35, z);
    globe.castShadow = true;
    scene.add(globe);

    const light = new THREE.PointLight(0xffd27a, 2.6, 15, 2);
    light.position.set(x, 3.35, z);
    light.castShadow = index < 4;
    scene.add(light);
    pulsingLights.push({ light, offset: index * 0.8, base: 2.6, swing: 0.45 });
  });
}

function addTrees() {
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x553826,
    roughness: 0.98,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f6f4c,
    roughness: 0.86,
  });

  [
    [-16, -15],
    [17, -16],
    [-17, 15],
    [16, 16],
  ].forEach(([x, z]) => {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 2.6, 10),
      trunkMaterial
    );
    trunk.position.set(x, 1.3, z);
    trunk.castShadow = true;
    scene.add(trunk);
    addCircleCollider(x, z, 1.1);

    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 20, 16),
      leafMaterial
    );
    canopy.position.set(x, 3.6, z);
    canopy.castShadow = true;
    scene.add(canopy);
  });
}

function addCrates(textures) {
  const crateMaterial = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.86,
    metalness: 0.05,
  });

  [
    [-6, 0.7, 10],
    [-4.8, 0.7, 11.1],
    [6, 0.7, 10],
    [7.1, 0.7, 8.8],
    [-9, 0.7, -9],
    [9, 0.7, -9],
  ].forEach((position, index) => {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.3, 1.3),
      crateMaterial
    );
    crate.position.set(...position);
    crate.rotation.y = index * 0.35;
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);
    addBoxCollider(position[0], position[2], 1.3, 1.3);
  });
}

function addBeacon() {
  const beaconGroup = new THREE.Group();
  beaconGroup.position.set(0, 2.1, 0);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 28, 24),
    new THREE.MeshStandardMaterial({
      color: 0xb8f5ff,
      emissive: 0x6ae6ff,
      emissiveIntensity: 4.5,
      roughness: 0.05,
      metalness: 0.22,
    })
  );
  core.castShadow = true;
  beaconGroup.add(core);

  const innerHalo = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 24, 20),
    new THREE.MeshBasicMaterial({
      color: 0x6be8ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  beaconGroup.add(innerHalo);

  const outerHalo = new THREE.Mesh(
    new THREE.SphereGeometry(2.3, 24, 20),
    new THREE.MeshBasicMaterial({
      color: 0x5dbfff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  beaconGroup.add(outerHalo);

  const ringA = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.12, 16, 48),
    new THREE.MeshStandardMaterial({
      color: 0xd5e4ff,
      emissive: 0x6f95ff,
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.75,
    })
  );
  ringA.rotation.x = Math.PI / 2;
  beaconGroup.add(ringA);

  const ringB = ringA.clone();
  ringB.rotation.x = Math.PI / 6;
  ringB.rotation.y = Math.PI / 5;
  beaconGroup.add(ringB);

  const glowLight = new THREE.PointLight(0x87e8ff, 5.8, 24, 2);
  glowLight.position.set(0, 0.4, 0);
  glowLight.castShadow = true;
  beaconGroup.add(glowLight);

  scene.add(beaconGroup);
  animatedObjects.push({
    group: beaconGroup,
    core,
    innerHalo,
    outerHalo,
    ringA,
    ringB,
    light: glowLight,
  });
}

function addLights() {
  const ambient = new THREE.AmbientLight(0x5f6f96, 0.45);
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0x6e88b7, 0x182130, 0.6);
  scene.add(hemisphere);

  const moon = new THREE.DirectionalLight(0xd9e8ff, 1.4);
  moon.position.set(12, 20, 8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -30;
  moon.shadow.camera.right = 30;
  moon.shadow.camera.top = 30;
  moon.shadow.camera.bottom = -30;
  scene.add(moon);

  const observatorySpot = new THREE.SpotLight(0xb8d7ff, 2.9, 60, Math.PI / 7, 0.35, 1.2);
  observatorySpot.position.set(-9, 12, 9);
  observatorySpot.target.position.set(0, 3, 0);
  observatorySpot.castShadow = true;
  scene.add(observatorySpot);
  scene.add(observatorySpot.target);
}

async function loadShrineModel() {
  const mtlLoader = new MTLLoader();
  const materials = await mtlLoader.loadAsync(
    new URL("./models/shrine.mtl", import.meta.url).href
  );
  materials.preload();

  const objLoader = new OBJLoader();
  objLoader.setMaterials(materials);

  const shrine = await objLoader.loadAsync(
    new URL("./models/shrine.obj", import.meta.url).href
  );

  shrine.position.set(0, 0, -10);
  shrine.scale.setScalar(1.6);
  shrine.rotation.y = Math.PI / 4;
  shrine.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const modelLight = new THREE.PointLight(0xffa95a, 1.2, 10, 2);
  modelLight.position.set(0, 3.2, -10);
  scene.add(modelLight);
  pulsingLights.push({ light: modelLight, offset: 5.6, base: 1.2, swing: 0.28 });

  scene.add(shrine);
  addBoxCollider(0, -10, 5.5, 5.5);
  animatedObjects.push({ importedModel: shrine });
}

function addBoxCollider(x, z, width, depth) {
  boxColliders.push({ x, z, halfWidth: width / 2, halfDepth: depth / 2 });
}

function addCircleCollider(x, z, radius) {
  circleColliders.push({ x, z, radius });
}

function collidesAt(x, z) {
  if (x < -WORLD_LIMIT || x > WORLD_LIMIT || z < -WORLD_LIMIT || z > WORLD_LIMIT) {
    return true;
  }

  for (const collider of boxColliders) {
    const dx = Math.abs(x - collider.x);
    const dz = Math.abs(z - collider.z);
    if (dx <= collider.halfWidth + PLAYER_RADIUS && dz <= collider.halfDepth + PLAYER_RADIUS) {
      return true;
    }
  }

  for (const collider of circleColliders) {
    const dx = x - collider.x;
    const dz = z - collider.z;
    const minDistance = collider.radius + PLAYER_RADIUS;
    if (dx * dx + dz * dz <= minDistance * minDistance) {
      return true;
    }
  }

  return false;
}

function onKeyChange(isDown) {
  return (event) => {
    if (event.code in keys) {
      keys[event.code] = isDown;
    }
  };
}

function updateMovement(delta) {
  if (!controls.isLocked) {
    return;
  }

  const forward = Number(keys.KeyW) - Number(keys.KeyS);
  const strafe = Number(keys.KeyD) - Number(keys.KeyA);
  if (forward === 0 && strafe === 0) {
    camera.position.y = EYE_HEIGHT;
    return;
  }

  const move = new THREE.Vector3();
  const lookDirection = new THREE.Vector3();
  camera.getWorldDirection(lookDirection);
  lookDirection.y = 0;
  lookDirection.normalize();

  const right = new THREE.Vector3(-lookDirection.z, 0, lookDirection.x);
  move.addScaledVector(lookDirection, forward);
  move.addScaledVector(right, strafe);

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(WALK_SPEED * delta);
  }

  const nextX = THREE.MathUtils.clamp(camera.position.x + move.x, -WORLD_LIMIT, WORLD_LIMIT);
  const nextZ = THREE.MathUtils.clamp(camera.position.z + move.z, -WORLD_LIMIT, WORLD_LIMIT);

  if (!collidesAt(nextX, camera.position.z)) {
    camera.position.x = nextX;
  }

  if (!collidesAt(camera.position.x, nextZ)) {
    camera.position.z = nextZ;
  }

  camera.position.y = EYE_HEIGHT;
}

function render() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  updateMovement(delta);

  animatedObjects.forEach((item, index) => {
    if (item.group) {
      item.group.rotation.y += delta * 0.75;
      item.group.position.y = 2.1 + Math.sin(elapsed * 2 + index) * 0.18;
      item.core.position.y = Math.sin(elapsed * 2.7) * 0.15;
      item.innerHalo.scale.setScalar(1 + Math.sin(elapsed * 2.1) * 0.08);
      item.outerHalo.scale.setScalar(1.04 + Math.sin(elapsed * 1.5 + 0.7) * 0.12);
      item.innerHalo.material.opacity = 0.24 + Math.sin(elapsed * 3.2) * 0.05;
      item.outerHalo.material.opacity = 0.12 + Math.sin(elapsed * 2.4 + 0.4) * 0.04;
      item.ringA.rotation.z += delta * 0.9;
      item.ringB.rotation.y += delta * 1.2;
      item.light.intensity = 5.8 + Math.sin(elapsed * 3.5) * 0.9;
    }

    if (item.importedModel) {
      item.importedModel.rotation.y = Math.PI / 4 + elapsed * 0.18;
    }
  });

  pulsingLights.forEach(({ light, offset, base, swing }) => {
    light.intensity = base + Math.sin(elapsed * 3 + offset) * swing;
  });

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}


