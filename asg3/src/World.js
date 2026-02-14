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
}

function tick() {
  handleMovement();
  render();
  requestAnimationFrame(tick);
}


function makeMaps() {
  for (let z = 0; z < WORLD_SIZE; z++) {
    mapH[z] = [];
    mapT[z] = [];
    for (let x = 0; x < WORLD_SIZE; x++) {
      const border = (x === 0 || z === 0 || x === WORLD_SIZE - 1 || z === WORLD_SIZE - 1);

      // base: empty interior, tall border walls
      let h = border ? 3 : 0;

      // internal maze-ish features
      if (x === 8 && z > 6 && z < 26) h = 2;
      if (z === 20 && x > 10 && x < 28) h = 1;
      if (x > 14 && x < 18 && z > 14 && z < 18) h = 4; // tower

      mapH[z][x] = clamp(h, 0, MAX_H);

      // choose texture per cell
      let t = 2; // default: brick
      if (h === 0) t = 2;
      if (border) t = 2;
      if (h === 1) t = 3; // wood
      if (h === 4) t = 2; // brick
      mapT[z][x] = clamp(t, 0, 3);
    }
  }
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
