// World.js
// Assignment 4: First-person exploration in 32x32x4 voxel world with textures, mouse look, and add/delete blocks.

var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_UV;

  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;

  varying vec2 v_UV;

  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
  }
`;

var FSHADER_SOURCE = `
  precision mediump float;

  varying vec2 v_UV;

  uniform vec4 u_BaseColor;
  uniform float u_texColorWeight;   // 0 base only, 1 texture only

  uniform int u_whichTexture;        // 0..3
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  uniform sampler2D u_Sampler3;

  vec4 pickTexture() {
    if (u_whichTexture == 0) return texture2D(u_Sampler0, v_UV);
    if (u_whichTexture == 1) return texture2D(u_Sampler1, v_UV);
    if (u_whichTexture == 2) return texture2D(u_Sampler2, v_UV);
    return texture2D(u_Sampler3, v_UV);
  }

  void main() {
    vec4 texColor = pickTexture();
    gl_FragColor = (1.0 - u_texColorWeight) * u_BaseColor + u_texColorWeight * texColor;
  }
`;

let canvas, gl;

// attrib/uniform locations
let a_Position, a_UV;
let u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix;
let u_BaseColor, u_texColorWeight, u_whichTexture;
let u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3;

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
const TEX_FILES = ["sky.jpg", "grass.jpg", "brick.jpg", "wood.png"];

// ===== Story/Game state =====
let hasKey = false;
let gameWon = false;

const KEY_POS = { x: 6, z: 6 };          // where the key is (change if you want)
const GATE_POS = { x: 18, z: 23 };        // gate opening location (matches courtyard doorway area)
const GOAL_POS = { x: 23, z: 23 };        // tower center-ish

let hudEl = null;

// uniforms/attrs pack for cleaner calls
let UNIFORMS, ATTRS;


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

  u_ModelMatrix      = gl.getUniformLocation(gl.program, "u_ModelMatrix");
  u_ViewMatrix       = gl.getUniformLocation(gl.program, "u_ViewMatrix");
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, "u_ProjectionMatrix");

  u_BaseColor       = gl.getUniformLocation(gl.program, "u_BaseColor");
  u_texColorWeight  = gl.getUniformLocation(gl.program, "u_texColorWeight");
  u_whichTexture    = gl.getUniformLocation(gl.program, "u_whichTexture");

  u_Sampler0 = gl.getUniformLocation(gl.program, "u_Sampler0");
  u_Sampler1 = gl.getUniformLocation(gl.program, "u_Sampler1");
  u_Sampler2 = gl.getUniformLocation(gl.program, "u_Sampler2");
  u_Sampler3 = gl.getUniformLocation(gl.program, "u_Sampler3");

  UNIFORMS = {
    u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix,
    u_BaseColor, u_texColorWeight, u_whichTexture
  };
  ATTRS = { a_Position, a_UV };

  // cube buffers
  initCubeBuffers(gl, a_Position, a_UV);

  // camera
  camera = new Camera(canvas);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);

  // world maps
  makeMaps();

  // input
  initInput();

  // texture load then start loop
  initTextures(() => {
    gl.clearColor(0.6, 0.8, 1.0, 1.0);
    requestAnimationFrame(tick);
  });

hudEl = document.getElementById("hud");
updateHUD();
}

function tick() {
  handleMovement();
  checkStory();
  render();
  requestAnimationFrame(tick);
}


function makeMaps() {
  // Helpers
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
      mapH[z][x] = 0;     // empty space
      mapT[z][x] = 2;     // default brick if a block exists
    }
  }

  // ===== 1) Outer fortress =====
  hollowRect(0, 0, 31, 31, 3, 2);      // brick wall ring
  // Corner towers (taller)
  rect(0, 0, 2, 2, 4, 2);
  rect(29, 0, 31, 2, 4, 2);
  rect(0, 29, 2, 31, 4, 2);
  rect(29, 29, 31, 31, 4, 2);

  // Gates (openings) so you can enter/exit
  // North gate
  setCell(15, 0, 0, 2); setCell(16, 0, 0, 2);
  // South gate
  setCell(15, 31, 0, 2); setCell(16, 31, 0, 2);
  // West gate
  setCell(0, 15, 0, 2); setCell(0, 16, 0, 2);
  // East gate
  setCell(31, 15, 0, 2); setCell(31, 16, 0, 2);

  // ===== 2) Main roads (walkable) =====
  roadX(16, 1, 30);  // horizontal road
  roadZ(16, 1, 30);  // vertical road
  // Diagonal-ish little connector paths
  for (let i = 0; i < 8; i++) setCell(8 + i, 8 + i, 0, 1);

  // ===== 3) Village district (NW) =====
  // Small “houses” made of wood (height 2), with doors (holes)
  function house(cx, cz) {
    hollowRect(cx, cz, cx + 4, cz + 4, 2, 3); // wood walls
    rect(cx + 1, cz + 1, cx + 3, cz + 3, 0, 3); // empty interior
    // door
    setCell(cx + 2, cz + 4, 0, 3);
  }
  house(3, 3);
  house(9, 3);
  house(3, 9);
  // little alley
  roadX(8, 3, 13);
  roadZ(8, 3, 13);

  // ===== 4) Garden maze (NE) =====
  // low hedges (height 1) using wood texture (looks distinct)
  rect(18, 3, 29, 13, 1, 3);
  // carve maze corridors
  for (let z = 4; z <= 12; z += 2) roadX(z, 19, 28);
  for (let x = 20; x <= 28; x += 2) roadZ(x, 4, 12);
  // entrance to maze
  roadX(13, 22, 25);
  setCell(23, 13, 0, 3);

  // ===== 5) Courtyard + tower (SE) =====
  // courtyard walls
  hollowRect(18, 18, 29, 29, 2, 2);
  // courtyard interior is open
  rect(19, 19, 28, 28, 0, 2);
  // doorway into courtyard from main road
  setCell(18, 23, 0, 2);
  setCell(18, 24, 0, 2);

  // tower in center (height 4), plus a “stair-step” ramp (1→2→3)
  rect(23, 23, 24, 24, 4, 2);
  rect(22, 23, 22, 23, 1, 2);
  rect(21, 23, 21, 23, 2, 2);
  rect(20, 23, 20, 23, 3, 2);

  // ===== 6) Canyon ridge (SW) =====
  // create a ridge line of height 2-3 and carve a canyon path through it
  for (let x = 2; x <= 13; x++) {
    setCell(x, 22, 3, 2);
    setCell(x, 23, 2, 2);
    setCell(x, 24, 3, 2);
  }
  // canyon opening
  roadX(23, 6, 9);
  roadZ(7, 19, 26);

  // ===== 7) Spawn safety: clear a small area near start =====
  // If your camera starts near (16,16), ensure it’s open
  rect(15, 15, 17, 17, 0, 1);

  mapH[KEY_POS.z][KEY_POS.x] = 0;
  mapT[KEY_POS.z][KEY_POS.x] = 2;
}

function updateHUD() {
  if (!hudEl) return;

  // Keep your existing HUD controls, append story status
  const statusLines = [
    "<div><b>Controls</b></div>",
    "<div>W/A/S/D: move</div>",
    "<div>Q/E: turn</div>",
    "<div>Mouse drag: look</div>",
    "<div>F: add block</div>",
    "<div>Right click: remove block</div>",
    "<div class='small'>Quest: Find the <b>Golden Key</b>, unlock the gate, reach the tower.</div>",
    `<div class='small'>Key: ${hasKey ? "✅ Acquired" : "❌ Not found"}</div>`,
    `<div class='small'>Gate: ${hasKey ? "🔓 Unlocked" : "🔒 Locked"}</div>`,
    `<div class='small'>Goal: ${gameWon ? "🏁 You win!" : "Reach the tower"}</div>`
  ];

  hudEl.innerHTML = statusLines.join("");
}

function playerCell() {
  // Convert camera position to map cell
  const x = clamp(Math.floor(camera.eye.elements[0]), 0, WORLD_SIZE - 1);
  const z = clamp(Math.floor(camera.eye.elements[2]), 0, WORLD_SIZE - 1);
  return { x, z };
}

function openGate() {
  // Clear a 2-wide doorway in the courtyard wall
  // This matches the doorway you created in the “interesting world” map
  // If your gate location differs, adjust these cells.
  for (let dz = 0; dz <= 1; dz++) {
    mapH[GATE_POS.z + dz][GATE_POS.x] = 0;
  }
}

function checkStory() {
  if (gameWon) return;

  const { x, z } = playerCell();

  // Pick up key
  if (!hasKey && x === KEY_POS.x && z === KEY_POS.z) {
    hasKey = true;
    openGate();
    updateHUD();
  }

  // Win: reach tower area (requires key because gate blocks it)
  if (hasKey && Math.abs(x - GOAL_POS.x) <= 1 && Math.abs(z - GOAL_POS.z) <= 1) {
    gameWon = true;
    updateHUD();

    // Simple “celebration”: sky tint shifts
    gl.clearColor(0.8, 0.9, 0.8, 1.0);
  }
}

function drawKey() {
  if (hasKey) return;

  const k = new Cube();
  k.texWeight = 0.0;                 // base color only
  k.baseColor = [1.0, 0.85, 0.15, 1.0]; // gold
  k.matrix.setIdentity();
  k.matrix.translate(KEY_POS.x, 0.15, KEY_POS.z + 1); // +1 if you kept the z-offset fix
  k.matrix.scale(0.7, 0.7, 0.7);
  k.render(gl, UNIFORMS, ATTRS);
}


function initInput() {
  document.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;

    // Minecraft actions
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

  // Right click removes block
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
      //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      // sampler = texture unit index
      gl.uniform1i(samplerUniform, texUnit - gl.TEXTURE0);

      loaded++;
      if (loaded === TEX_FILES.length) onDone();
    };

    img.onerror = () => {
      console.log("Failed to load texture:", src);
    };

    img.src = src;
  }

  loadOne(gl.TEXTURE0, u_Sampler0, TEX_FILES[0]); // sky
  loadOne(gl.TEXTURE1, u_Sampler1, TEX_FILES[1]); // grass
  loadOne(gl.TEXTURE2, u_Sampler2, TEX_FILES[2]); // brick
  loadOne(gl.TEXTURE3, u_Sampler3, TEX_FILES[3]); // wood
}


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
  mapT[z][x] = 3; // placed blocks use wood 
}

function removeBlockInFront() {
  const { x, z } = cellInFront();
  mapH[z][x] = clamp(mapH[z][x] - 1, 0, MAX_H);
}


function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);

  drawSkybox();
  drawGround();
  drawWalls();
  drawKey();
  drawAnimal();
}

function drawGround() {
  const g = new Cube();
  g.texWeight = 1.0;
  g.whichTexture = 1; // grass
  g.baseColor = [1, 1, 1, 1];

  g.matrix.setIdentity();
  // Move cube so it covers (0..WORLD_SIZE) and sits at y=0
  g.matrix.translate(0, 0, 30);
  g.matrix.scale(WORLD_SIZE, 0.1, WORLD_SIZE);

  g.render(gl, UNIFORMS, ATTRS);
}

function drawSkybox() {
  const s = new Cube();
  s.texWeight = 0.0; // base only
  s.baseColor = [0.5, 0.7, 1.0, 1.0];


  const big = 200;
  s.matrix.setIdentity();
  // Center it around world
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
        w.whichTexture = mapT[z][x]; // 0..3
        w.baseColor = [1, 1, 1, 1];

        w.matrix.setIdentity();
        w.matrix.translate(x, y, z);

        w.render(gl, UNIFORMS, ATTRS);
      }
    }
  }
}

// Animal in the world (simple blocky creature) 

function drawAnimal() {
  // Blocky penguin (simple cubes)
  const baseX = 12;
  const baseZ = 12 + 1; 

  // Body (black)
  const body = new Cube();
  body.texWeight = 0.0;
  body.baseColor = [0.08, 0.08, 0.10, 1.0];
  body.matrix.setIdentity();
  body.matrix.translate(baseX + 0.25, 0.0, baseZ + 0.25);
  body.matrix.scale(0.9, 1.1, 0.7);
  body.render(gl, UNIFORMS, ATTRS);

  // Belly (white)
  const belly = new Cube();
  belly.texWeight = 0.0;
  belly.baseColor = [0.92, 0.92, 0.95, 1.0];
  belly.matrix.setIdentity();
  belly.matrix.translate(baseX + 0.42, 0.25, baseZ + 0.30);
  belly.matrix.scale(0.56, 0.70, 0.52);
  belly.render(gl, UNIFORMS, ATTRS);

  // Head (black)
  const head = new Cube();
  head.texWeight = 0.0;
  head.baseColor = [0.08, 0.08, 0.10, 1.0];
  head.matrix.setIdentity();
  head.matrix.translate(baseX + 0.38, 1.05, baseZ + 0.30);
  head.matrix.scale(0.55, 0.50, 0.50);
  head.render(gl, UNIFORMS, ATTRS);

  // Beak (orange)
  const beak = new Cube();
  beak.texWeight = 0.0;
  beak.baseColor = [0.95, 0.60, 0.10, 1.0];
  beak.matrix.setIdentity();
  beak.matrix.translate(baseX + 0.58, 1.18, baseZ + 0.18);
  beak.matrix.scale(0.18, 0.12, 0.18);
  beak.render(gl, UNIFORMS, ATTRS);

  // Eyes (two tiny white cubes)
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

  // Feet (orange)
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

  // Wings (dark gray) - optional little flair
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
