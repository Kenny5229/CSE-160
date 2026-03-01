// World.js
// Upgraded for Assignment: Phong lighting + normals + point light + spotlight + UI toggles
// Keeps your voxel world + first-person camera + add/remove blocks + story elements.

var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  attribute vec3 a_Normal;

  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  uniform mat4 u_NormalMatrix;

  varying vec2 v_UV;
  varying vec3 v_WorldPos;
  varying vec3 v_WorldNormal;

  void main() {
    vec4 worldPos4 = u_ModelMatrix * a_Position;
    v_WorldPos = worldPos4.xyz;

    v_WorldNormal = normalize((u_NormalMatrix * vec4(a_Normal, 0.0)).xyz);

    v_UV = a_UV;
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * worldPos4;
  }
`;

var FSHADER_SOURCE = `
  precision mediump float;

  varying vec2 v_UV;
  varying vec3 v_WorldPos;
  varying vec3 v_WorldNormal;

  uniform vec4 u_BaseColor;
  uniform float u_texColorWeight;

  uniform int u_whichTexture;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  uniform sampler2D u_Sampler3;

  // Toggles
  uniform bool u_LightingOn;
  uniform bool u_ShowNormals;

  // Camera position (specular)
  uniform vec3 u_ViewPos;

  // Point light
  uniform vec3 u_LightPos;
  uniform vec3 u_LightColor;

  // Spotlight (second light)
  uniform bool u_SpotOn;
  uniform vec3 u_SpotPos;
  uniform vec3 u_SpotDir;      // should be normalized
  uniform float u_SpotCutoff;  // cos(angle)

  vec4 pickTexture() {
    if (u_whichTexture == 0) return texture2D(u_Sampler0, v_UV);
    if (u_whichTexture == 1) return texture2D(u_Sampler1, v_UV);
    if (u_whichTexture == 2) return texture2D(u_Sampler2, v_UV);
    return texture2D(u_Sampler3, v_UV);
  }

  void main() {
    vec4 texColor = pickTexture();
    vec4 base = (1.0 - u_texColorWeight) * u_BaseColor + u_texColorWeight * texColor;

    // Normal visualization toggle
    if (u_ShowNormals) {
      vec3 n = normalize(v_WorldNormal);
      gl_FragColor = vec4(n * 0.5 + 0.5, 1.0); // map -1..1 to 0..1
      return;
    }

    // Lighting off toggle
    if (!u_LightingOn) {
      gl_FragColor = base;
      return;
    }

    vec3 N = normalize(v_WorldNormal);
    vec3 V = normalize(u_ViewPos - v_WorldPos);

    // --- Point Light Phong ---
    vec3 L = normalize(u_LightPos - v_WorldPos);
    float diff = max(dot(N, L), 0.0);

    vec3 R = reflect(-L, N);
    float spec = pow(max(dot(V, R), 0.0), 32.0);

    float ka = 0.18;
    float kd = 1.0;
    float ks = 0.45;

    vec3 ambient = ka * base.rgb;
    vec3 diffuse = kd * diff * base.rgb * u_LightColor;
    vec3 specular = ks * spec * u_LightColor;

    // --- Spotlight (optional second light) ---
    if (u_SpotOn) {
      vec3 Ls = normalize(u_SpotPos - v_WorldPos);

      // Compare spotlight direction with direction from light to fragment
      float spotCos = dot(normalize(-u_SpotDir), Ls);

      if (spotCos > u_SpotCutoff) {
        float sdiff = max(dot(N, Ls), 0.0);
        vec3 Rs = reflect(-Ls, N);
        float sspec = pow(max(dot(V, Rs), 0.0), 32.0);

        float t = smoothstep(u_SpotCutoff, 1.0, spotCos); // soften edge

        diffuse += t * (sdiff * base.rgb * u_LightColor);
        specular += t * (0.45 * sspec * u_LightColor);
      }
    }

    gl_FragColor = vec4(ambient + diffuse + specular, base.a);
  }
`;

let canvas, gl;

// attrib/uniform locations
let a_Position, a_UV, a_Normal;
let u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix;
let u_NormalMatrix;

let u_BaseColor, u_texColorWeight, u_whichTexture;
let u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3;

// lighting uniforms
let u_LightingOn, u_ShowNormals;
let u_LightPos, u_LightColor;
let u_ViewPos;
let u_SpotOn, u_SpotPos, u_SpotDir, u_SpotCutoff;

// camera + input
let camera;
let keys = {};
let mouseDown = false;
let lastX = 0, lastY = 0;

// world
const WORLD_SIZE = 32;
const MAX_H = 4;

let mapH = []; // heights [z][x] 0..4
let mapT = []; // texture index [z][x] 0..3

// textures to load (must exist in same folder)
// NOTE: if you don't have brick.jpg, replace it with an existing file
const TEX_FILES = ["sky.jpg", "grass.jpg", "brick.jpg", "wood.png"];

// ===== Story/Game state =====
let hasKey = false;
let gameWon = false;

const KEY_POS = { x: 6, z: 6 };
const GATE_POS = { x: 18, z: 23 };
const GOAL_POS = { x: 23, z: 23 };

let hudEl = null;

// uniforms/attrs pack
let UNIFORMS, ATTRS;

// ===== Lighting state (driven by UI) =====
let g_lightingOn = true;
let g_showNormals = false;

let g_pointOn = true;
let g_spotOn = true;

let g_lightPos = [16, 6, 16];
let g_lightColor = [1.0, 1.0, 1.0];

// spotlight defaults
let g_spotPos = [10, 10, 10];
let g_spotDir = [1, -1, 0]; // aim down-ish
let g_spotCutoff = Math.cos(20 * Math.PI / 180);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function main() {
  canvas = document.getElementById("webgl");
  gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) {
    console.log("WebGL not supported");
    return;
  }
  gl.enable(gl.DEPTH_TEST);

  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log("Shader init failed");
    return;
  }

  // locations
  a_Position = gl.getAttribLocation(gl.program, "a_Position");
  a_UV       = gl.getAttribLocation(gl.program, "a_UV");
  a_Normal   = gl.getAttribLocation(gl.program, "a_Normal");

  u_ModelMatrix      = gl.getUniformLocation(gl.program, "u_ModelMatrix");
  u_ViewMatrix       = gl.getUniformLocation(gl.program, "u_ViewMatrix");
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, "u_ProjectionMatrix");
  u_NormalMatrix     = gl.getUniformLocation(gl.program, "u_NormalMatrix");

  u_BaseColor       = gl.getUniformLocation(gl.program, "u_BaseColor");
  u_texColorWeight  = gl.getUniformLocation(gl.program, "u_texColorWeight");
  u_whichTexture    = gl.getUniformLocation(gl.program, "u_whichTexture");

  u_Sampler0 = gl.getUniformLocation(gl.program, "u_Sampler0");
  u_Sampler1 = gl.getUniformLocation(gl.program, "u_Sampler1");
  u_Sampler2 = gl.getUniformLocation(gl.program, "u_Sampler2");
  u_Sampler3 = gl.getUniformLocation(gl.program, "u_Sampler3");

  // lighting uniforms
  u_LightingOn = gl.getUniformLocation(gl.program, "u_LightingOn");
  u_ShowNormals = gl.getUniformLocation(gl.program, "u_ShowNormals");
  u_LightPos = gl.getUniformLocation(gl.program, "u_LightPos");
  u_LightColor = gl.getUniformLocation(gl.program, "u_LightColor");
  u_ViewPos = gl.getUniformLocation(gl.program, "u_ViewPos");

  u_SpotOn = gl.getUniformLocation(gl.program, "u_SpotOn");
  u_SpotPos = gl.getUniformLocation(gl.program, "u_SpotPos");
  u_SpotDir = gl.getUniformLocation(gl.program, "u_SpotDir");
  u_SpotCutoff = gl.getUniformLocation(gl.program, "u_SpotCutoff");

  UNIFORMS = {
    u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix,
    u_NormalMatrix,
    u_BaseColor, u_texColorWeight, u_whichTexture,
    u_LightingOn, u_ShowNormals,
    u_LightPos, u_LightColor, u_ViewPos,
    u_SpotOn, u_SpotPos, u_SpotDir, u_SpotCutoff
  };
  ATTRS = { a_Position, a_UV, a_Normal };

  // cube buffers (REQUIRES Cube.js updated to include normals)
  initCubeBuffers(gl, a_Position, a_UV, a_Normal);

  // camera
  camera = new Camera(canvas);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);

  // world maps
  makeMaps();

  // input + UI
  initInput();
  hudEl = document.getElementById("hud");
  ensureStoryStatusBlock();
  updateHUD();
  hookLightingUI();

  // texture load then start loop
  initTextures(() => {
    gl.clearColor(0.6, 0.8, 1.0, 1.0);
    requestAnimationFrame(tick);
  });
}

function tick() {
  handleMovement();
  checkStory();
  render();
  requestAnimationFrame(tick);
}

// ----------------- WORLD GEN -----------------

function makeMaps() {
  function setCell(x, z, h, t) {
    if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) return;
    mapH[z][x] = clamp(h, 0, MAX_H);
    mapT[z][x] = clamp(t, 0, 3);
  }
  function rect(x0, z0, x1, z1, h, t) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) setCell(x, z, h, t);
    }
  }
  function hollowRect(x0, z0, x1, z1, h, t) {
    for (let x = x0; x <= x1; x++) { setCell(x, z0, h, t); setCell(x, z1, h, t); }
    for (let z = z0; z <= z1; z++) { setCell(x0, z, h, t); setCell(x1, z, h, t); }
  }
  function roadX(z, x0, x1) { for (let x = x0; x <= x1; x++) setCell(x, z, 0, 1); }
  function roadZ(x, z0, z1) { for (let z = z0; z <= z1; z++) setCell(x, z, 0, 1); }

  // Init empty
  mapH = [];
  mapT = [];
  for (let z = 0; z < WORLD_SIZE; z++) {
    mapH[z] = [];
    mapT[z] = [];
    for (let x = 0; x < WORLD_SIZE; x++) {
      mapH[z][x] = 0;
      mapT[z][x] = 2;
    }
  }

  // Outer fortress
  hollowRect(0, 0, 31, 31, 3, 2);
  rect(0, 0, 2, 2, 4, 2);
  rect(29, 0, 31, 2, 4, 2);
  rect(0, 29, 2, 31, 4, 2);
  rect(29, 29, 31, 31, 4, 2);

  // Gates
  setCell(15, 0, 0, 2); setCell(16, 0, 0, 2);
  setCell(15, 31, 0, 2); setCell(16, 31, 0, 2);
  setCell(0, 15, 0, 2); setCell(0, 16, 0, 2);
  setCell(31, 15, 0, 2); setCell(31, 16, 0, 2);

  // Roads
  roadX(16, 1, 30);
  roadZ(16, 1, 30);
  for (let i = 0; i < 8; i++) setCell(8 + i, 8 + i, 0, 1);

  // Houses
  function house(cx, cz) {
    hollowRect(cx, cz, cx + 4, cz + 4, 2, 3);
    rect(cx + 1, cz + 1, cx + 3, cz + 3, 0, 3);
    setCell(cx + 2, cz + 4, 0, 3);
  }
  house(3, 3);
  house(9, 3);
  house(3, 9);
  roadX(8, 3, 13);
  roadZ(8, 3, 13);

  // Maze
  rect(18, 3, 29, 13, 1, 3);
  for (let z = 4; z <= 12; z += 2) roadX(z, 19, 28);
  for (let x = 20; x <= 28; x += 2) roadZ(x, 4, 12);
  roadX(13, 22, 25);
  setCell(23, 13, 0, 3);

  // Courtyard + tower
  hollowRect(18, 18, 29, 29, 2, 2);
  rect(19, 19, 28, 28, 0, 2);
  setCell(18, 23, 0, 2);
  setCell(18, 24, 0, 2);

  rect(23, 23, 24, 24, 4, 2);
  rect(22, 23, 22, 23, 1, 2);
  rect(21, 23, 21, 23, 2, 2);
  rect(20, 23, 20, 23, 3, 2);

  // Canyon ridge
  for (let x = 2; x <= 13; x++) {
    setCell(x, 22, 3, 2);
    setCell(x, 23, 2, 2);
    setCell(x, 24, 3, 2);
  }
  roadX(23, 6, 9);
  roadZ(7, 19, 26);

  // Spawn safety
  rect(15, 15, 17, 17, 0, 1);

  mapH[KEY_POS.z][KEY_POS.x] = 0;
  mapT[KEY_POS.z][KEY_POS.x] = 2;
}

// ----------------- HUD / STORY -----------------

function ensureStoryStatusBlock() {
  if (!hudEl) return;
  let story = document.getElementById("storyStatus");
  if (!story) {
    story = document.createElement("div");
    story.id = "storyStatus";
    story.style.marginTop = "8px";
    story.className = "small";
    hudEl.appendChild(story);
  }
}

function updateHUD() {
  const story = document.getElementById("storyStatus");
  if (!story) return;

  story.innerHTML =
    `<div>Quest: Find the <b>Golden Key</b>, unlock the gate, reach the tower.</div>
     <div>Key: ${hasKey ? "✅ Acquired" : "❌ Not found"}</div>
     <div>Gate: ${hasKey ? "🔓 Unlocked" : "🔒 Locked"}</div>
     <div>Goal: ${gameWon ? "🏁 You win!" : "Reach the tower"}</div>`;
}

function playerCell() {
  const x = clamp(Math.floor(camera.eye.elements[0]), 0, WORLD_SIZE - 1);
  const z = clamp(Math.floor(camera.eye.elements[2]), 0, WORLD_SIZE - 1);
  return { x, z };
}

function openGate() {
  for (let dz = 0; dz <= 1; dz++) {
    mapH[GATE_POS.z + dz][GATE_POS.x] = 0;
  }
}

function checkStory() {
  if (gameWon) return;

  const { x, z } = playerCell();

  if (!hasKey && x === KEY_POS.x && z === KEY_POS.z) {
    hasKey = true;
    openGate();
    updateHUD();
  }

  if (hasKey && Math.abs(x - GOAL_POS.x) <= 1 && Math.abs(z - GOAL_POS.z) <= 1) {
    gameWon = true;
    updateHUD();
    gl.clearColor(0.8, 0.9, 0.8, 1.0);
  }
}

function drawKey() {
  if (hasKey) return;

  const k = new Cube();
  k.texWeight = 0.0;
  k.baseColor = [1.0, 0.85, 0.15, 1.0];
  k.matrix.setIdentity();
  k.matrix.translate(KEY_POS.x, 0.15, KEY_POS.z + 1);
  k.matrix.scale(0.7, 0.7, 0.7);
  k.render(gl, UNIFORMS, ATTRS);
}

// ----------------- INPUT -----------------

function initInput() {
  document.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === "f") addBlockInFront();
  });

  document.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  canvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  document.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  document.addEventListener("mousemove", (e) => {
    if (!mouseDown) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    camera.look(dx, dy);
  });

  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    removeBlockInFront();
  });
}

function handleMovement() {
  if (keys["w"]) camera.moveForward();
  if (keys["s"]) camera.moveBackwards();
  if (keys["a"]) camera.moveLeft();
  if (keys["d"]) camera.moveRight();
  if (keys["q"]) camera.panLeft(3);
  if (keys["e"]) camera.panRight(3);
}

// ----------------- UI HOOKS -----------------

function hookLightingUI() {
  const btnLight = document.getElementById("btnLight");
  const btnNormals = document.getElementById("btnNormals");

  const lx = document.getElementById("lx");
  const ly = document.getElementById("ly");
  const lz = document.getElementById("lz");
  const lc = document.getElementById("lc");

  const point = document.getElementById("point");
  const spot = document.getElementById("spot");

  if (!btnLight || !btnNormals || !lx || !ly || !lz || !lc || !point || !spot) {
    console.warn("Lighting UI elements missing. Check World.html IDs.");
    return;
  }

  btnLight.onclick = () => {
    g_lightingOn = !g_lightingOn;
    btnLight.textContent = `Lighting: ${g_lightingOn ? "ON" : "OFF"}`;
  };

  btnNormals.onclick = () => {
    g_showNormals = !g_showNormals;
    btnNormals.textContent = `Normals: ${g_showNormals ? "ON" : "OFF"}`;
  };

  const updatePos = () => {
    g_lightPos[0] = parseFloat(lx.value);
    g_lightPos[1] = parseFloat(ly.value);
    g_lightPos[2] = parseFloat(lz.value);
  };
  lx.oninput = updatePos;
  ly.oninput = updatePos;
  lz.oninput = updatePos;

  lc.oninput = () => {
    const h = parseFloat(lc.value) / 360.0;
    g_lightColor = hsvToRgb(h, 1, 1);
  };

  point.onchange = () => { g_pointOn = point.checked; };
  spot.onchange  = () => { g_spotOn  = spot.checked; };
}

function hsvToRgb(h, s, v) {
  let r=0,g=0,b=0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
  }
  return [r,g,b];
}

// ----------------- TEXTURES -----------------

function initTextures(onDone) {
  let loaded = 0;

  function loadOne(texUnit, samplerUniform, src) {
    const tex = gl.createTexture();
    const img = new Image();

    img.onload = () => {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

      gl.activeTexture(texUnit);
      gl.bindTexture(gl.TEXTURE_2D, tex);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.uniform1i(samplerUniform, texUnit - gl.TEXTURE0);

      loaded++;
      if (loaded === TEX_FILES.length) onDone();
    };

    img.onerror = () => console.log("Failed to load texture:", src);
    img.src = src;
  }

  loadOne(gl.TEXTURE0, u_Sampler0, TEX_FILES[0]);
  loadOne(gl.TEXTURE1, u_Sampler1, TEX_FILES[1]);
  loadOne(gl.TEXTURE2, u_Sampler2, TEX_FILES[2]);
  loadOne(gl.TEXTURE3, u_Sampler3, TEX_FILES[3]);
}

// ----------------- BLOCK EDITING -----------------

function cellInFront(dist = 1.2) {
  const f = camera.forwardDir();
  const ex = camera.eye.elements[0];
  const ez = camera.eye.elements[2];

  const tx = Math.floor(ex + f.elements[0] * dist);
  const tz = Math.floor(ez + f.elements[2] * dist);

  return {
    x: clamp(tx, 0, WORLD_SIZE - 1),
    z: clamp(tz, 0, WORLD_SIZE - 1)
  };
}

function addBlockInFront() {
  const { x, z } = cellInFront();
  mapH[z][x] = clamp(mapH[z][x] + 1, 0, MAX_H);
  mapT[z][x] = 3;
}

function removeBlockInFront() {
  const { x, z } = cellInFront();
  mapH[z][x] = clamp(mapH[z][x] - 1, 0, MAX_H);
}

// ----------------- RENDER -----------------

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);

  // Pass lighting toggles + camera pos
  gl.uniform1i(u_LightingOn, g_lightingOn ? 1 : 0);
  gl.uniform1i(u_ShowNormals, g_showNormals ? 1 : 0);

  gl.uniform3f(u_ViewPos,
    camera.eye.elements[0],
    camera.eye.elements[1],
    camera.eye.elements[2]
  );

  // Point light position always set (marker uses it too)
  gl.uniform3f(u_LightPos, g_lightPos[0], g_lightPos[1], g_lightPos[2]);

  // Point light color (turn off individually by setting to 0)
  const pColor = g_pointOn ? g_lightColor : [0, 0, 0];
  gl.uniform3f(u_LightColor, pColor[0], pColor[1], pColor[2]);

  // Spotlight uniforms
  gl.uniform1i(u_SpotOn, g_spotOn ? 1 : 0);
  gl.uniform3f(u_SpotPos, g_spotPos[0], g_spotPos[1], g_spotPos[2]);

  const sdLen = Math.hypot(g_spotDir[0], g_spotDir[1], g_spotDir[2]) || 1;
  gl.uniform3f(u_SpotDir, g_spotDir[0]/sdLen, g_spotDir[1]/sdLen, g_spotDir[2]/sdLen);

  gl.uniform1f(u_SpotCutoff, g_spotCutoff);

  drawSkybox();
  drawGround();
  drawWalls();
  drawKey();
  drawAnimal();
  drawSpheres();

  // Light marker cube so you can see where the point light is
  drawLightMarker();
}

function drawLightMarker() {
  const m = new Cube();
  m.texWeight = 0.0;
  m.baseColor = [1.0, 1.0, 0.2, 1.0];
  m.matrix.setIdentity();
  m.matrix.translate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  m.matrix.scale(0.25, 0.25, 0.25);
  m.render(gl, UNIFORMS, ATTRS);
}

function drawGround() {
  const g = new Cube();
  g.texWeight = 1.0;
  g.whichTexture = 1; // grass
  g.baseColor = [1, 1, 1, 1];

  g.matrix.setIdentity();
  g.matrix.translate(0, 0, 30);
  g.matrix.scale(WORLD_SIZE, 0.1, WORLD_SIZE);

  g.render(gl, UNIFORMS, ATTRS);
}

function drawSkybox() {
  const s = new Cube();
  s.texWeight = 0.0;
  s.baseColor = [0.5, 0.7, 1.0, 1.0];

  const big = 200;
  s.matrix.setIdentity();
  s.matrix.translate(-big / 2 + WORLD_SIZE / 2, -big / 2 + 20, -big / 2 + WORLD_SIZE / 2);
  s.matrix.scale(big, big, big);
  s.render(gl, UNIFORMS, ATTRS);
}

function drawWalls() {
  for (let z = 0; z < WORLD_SIZE; z++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const h = mapH[z][x];
      if (h <= 0) continue;

      for (let y = 0; y < h; y++) {
        const w = new Cube();
        w.texWeight = 1.0;
        w.whichTexture = mapT[z][x];
        w.baseColor = [1, 1, 1, 1];

        w.matrix.setIdentity();
        w.matrix.translate(x, y, z);
        w.render(gl, UNIFORMS, ATTRS);
      }
    }
  }
}

// ----------- SPHERES (REQUIRES Sphere.js) -----------

function drawSpheres() {
  if (typeof Sphere === "undefined") return; // don't crash if Sphere.js missing

  const s1 = new Sphere(24, 24);
  s1.texWeight = 0.0;
  s1.baseColor = [0.8, 0.2, 0.2, 1];
  s1.matrix.setIdentity();
  s1.matrix.translate(22, 1.2, 12);
  s1.matrix.scale(1.1, 1.1, 1.1);
  s1.render(gl, UNIFORMS, ATTRS);

  const s2 = new Sphere(24, 24);
  s2.texWeight = 0.0;
  s2.baseColor = [0.2, 0.4, 0.9, 1];
  s2.matrix.setIdentity();
  s2.matrix.translate(26, 1.0, 12);
  s2.matrix.scale(0.9, 0.9, 0.9);
  s2.render(gl, UNIFORMS, ATTRS);
}

// ----------------- ANIMAL (YOUR PENGUIN) -----------------

function drawAnimal() {
  const baseX = 12;
  const baseZ = 12 + 1;

  const body = new Cube();
  body.texWeight = 0.0;
  body.baseColor = [0.08, 0.08, 0.10, 1.0];
  body.matrix.setIdentity();
  body.matrix.translate(baseX + 0.25, 0.0, baseZ + 0.25);
  body.matrix.scale(0.9, 1.1, 0.7);
  body.render(gl, UNIFORMS, ATTRS);

  const belly = new Cube();
  belly.texWeight = 0.0;
  belly.baseColor = [0.92, 0.92, 0.95, 1.0];
  belly.matrix.setIdentity();
  belly.matrix.translate(baseX + 0.42, 0.25, baseZ + 0.30);
  belly.matrix.scale(0.56, 0.70, 0.52);
  belly.render(gl, UNIFORMS, ATTRS);

  const head = new Cube();
  head.texWeight = 0.0;
  head.baseColor = [0.08, 0.08, 0.10, 1.0];
  head.matrix.setIdentity();
  head.matrix.translate(baseX + 0.38, 1.05, baseZ + 0.30);
  head.matrix.scale(0.55, 0.50, 0.50);
  head.render(gl, UNIFORMS, ATTRS);

  const beak = new Cube();
  beak.texWeight = 0.0;
  beak.baseColor = [0.95, 0.60, 0.10, 1.0];
  beak.matrix.setIdentity();
  beak.matrix.translate(baseX + 0.58, 1.18, baseZ + 0.18);
  beak.matrix.scale(0.18, 0.12, 0.18);
  beak.render(gl, UNIFORMS, ATTRS);

  const eye1 = new Cube();
  eye1.texWeight = 0.0;
  eye1.baseColor = [0.98, 0.98, 0.98, 1.0];
  eye1.matrix.setIdentity();
  eye1.matrix.translate(baseX + 0.48, 1.32, baseZ + 0.25);
  eye1.matrix.scale(0.07, 0.07, 0.07);
  eye1.render(gl, UNIFORMS, ATTRS);

  const eye2 = new Cube();
  eye2.texWeight = 0.0;
  eye2.baseColor = [0.98, 0.98, 0.98, 1.0];
  eye2.matrix.setIdentity();
  eye2.matrix.translate(baseX + 0.68, 1.32, baseZ + 0.25);
  eye2.matrix.scale(0.07, 0.07, 0.07);
  eye2.render(gl, UNIFORMS, ATTRS);

  const foot1 = new Cube();
  foot1.texWeight = 0.0;
  foot1.baseColor = [0.95, 0.60, 0.10, 1.0];
  foot1.matrix.setIdentity();
  foot1.matrix.translate(baseX + 0.32, 0.0, baseZ + 0.18);
  foot1.matrix.scale(0.30, 0.08, 0.25);
  foot1.render(gl, UNIFORMS, ATTRS);

  const foot2 = new Cube();
  foot2.texWeight = 0.0;
  foot2.baseColor = [0.95, 0.60, 0.10, 1.0];
  foot2.matrix.setIdentity();
  foot2.matrix.translate(baseX + 0.60, 0.0, baseZ + 0.18);
  foot2.matrix.scale(0.30, 0.08, 0.25);
  foot2.render(gl, UNIFORMS, ATTRS);

  const wing1 = new Cube();
  wing1.texWeight = 0.0;
  wing1.baseColor = [0.15, 0.15, 0.18, 1.0];
  wing1.matrix.setIdentity();
  wing1.matrix.translate(baseX + 0.10, 0.45, baseZ + 0.33);
  wing1.matrix.scale(0.18, 0.45, 0.50);
  wing1.render(gl, UNIFORMS, ATTRS);

  const wing2 = new Cube();
  wing2.texWeight = 0.0;
  wing2.baseColor = [0.15, 0.15, 0.18, 1.0];
  wing2.matrix.setIdentity();
  wing2.matrix.translate(baseX + 1.00, 0.45, baseZ + 0.33);
  wing2.matrix.scale(0.18, 0.45, 0.50);
  wing2.render(gl, UNIFORMS, ATTRS);
}