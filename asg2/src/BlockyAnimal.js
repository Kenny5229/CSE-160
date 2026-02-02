// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE =`
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform float u_Size;
  uniform mat4 u_GlobalRotateMatrix;
  void main() {
    gl_Position = u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    gl_PointSize = u_Size;  
  }`

// Fragment shader program
var FSHADER_SOURCE =`
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`

let canvas;
let gl;
let a_Position;
let u_FragColor;
let g_selectedColor = [1.0, 0.0, 0.0, 1.0]; 
let g_SelectedSize = 5.0;
let u_Size;
const POINT =0;
const TRIANGLE =1;
const CIRCLE =2;
let g_SelectedType = POINT;
let g_SelectedSegments = 10;
let u_ModelMatrix;
let u_GlobalRotateMatrix;

// Scene controls
let g_globalAngle = 0;

// Joint controls (sliders)
let g_headAngle = 0;  // moves whole head assembly
let g_earAngle  = 0;  // flaps ears
let g_tailAngle = 0;  // wags tail
let g_animOn = false;

let g_headAnimOffset = 0;
let g_earAnimOffset  = 0;
let g_tailAnimOffset = 0;

let g_mouseRotX = 0;   // up/down drag
let g_mouseRotY = 0;   // left/right drag
let g_mouseDown = false;
let g_lastMouseX = 0;
let g_lastMouseY = 0;

// (Older placeholders kept, but not used for goat)
let g_yellowAngle = 0;
let g_magentaAngle = 0;
let g_yellowAnimation = false;

function setUpWebGL() {
  canvas = document.getElementById('webgl');

  gl = canvas.getContext("webgl", {preserveDrawingBuffer: true});
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Enables blending for transparency
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Depth for 3D
  gl.enable(gl.DEPTH_TEST);
}

function connectFunctionsToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  if (!u_Size) {
    console.log('Failed to get the storage location of u_Size');
    return;
  }

  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }

  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  if(!u_GlobalRotateMatrix) {
    console.log('Failed to get the storage location of u_GlobalRotateMatrix');
    return;
  }

  var identityM = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityM.elements);
}

function addActionsforHtmlUI() {
  document.getElementById('green').onclick = function() {g_selectedColor = [0.0, 1.0, 0.0, 1.0];};
  document.getElementById('red').onclick = function() {g_selectedColor = [1.0, 0.0, 0.0, 1.0];};
  document.getElementById('clearButton').onclick = function() {g_shapesList = []; renderAllShapes();};

  // Global camera angle
  document.getElementById('angleSlide').addEventListener('mousemove', function() {
    g_globalAngle = Number(this.value);
    renderAllShapes();
  });

  // Joint sliders (make sure these IDs exist in your HTML)
  const headSlide = document.getElementById('headSlide');
  if (headSlide) {
    headSlide.addEventListener('mousemove', function() {
      g_headAngle = Number(this.value);
      renderAllShapes();
    });
  }

  const earSlide = document.getElementById('earSlide');
  if (earSlide) {
    earSlide.addEventListener('mousemove', function() {
      g_earAngle = Number(this.value);
      renderAllShapes();
    });
  }

  const tailSlide = document.getElementById('tailSlide');
  if (tailSlide) {
    tailSlide.addEventListener('mousemove', function() {
      g_tailAngle = Number(this.value);
      renderAllShapes();
    });
  }

  const animOnBtn = document.getElementById('animOn');
if (animOnBtn) animOnBtn.onclick = function() { g_animOn = true; };

const animOffBtn = document.getElementById('animOff');
if (animOffBtn) animOffBtn.onclick = function() {
  g_animOn = false;
  g_headAnimOffset = 0;
  g_earAnimOffset  = 0;
  g_tailAnimOffset = 0;
  renderAllShapes();
};
}

function onMouseDown(ev) {
  g_mouseDown = true;
  g_lastMouseX = ev.clientX;
  g_lastMouseY = ev.clientY;
}

function onMouseUp(ev) {
  g_mouseDown = false;
}

function onMouseMove(ev) {
  if (!g_mouseDown) return;

  const dx = ev.clientX - g_lastMouseX;
  const dy = ev.clientY - g_lastMouseY;

  // sensitivity (degrees per pixel)
  const s = 0.3;

  g_mouseRotY += dx * s;   // horizontal drag -> y-rotation
  g_mouseRotX += dy * s;   // vertical drag   -> x-rotation

  // optional clamp so it doesn't flip upside-down
  g_mouseRotX = Math.max(-89, Math.min(89, g_mouseRotX));

  g_lastMouseX = ev.clientX;
  g_lastMouseY = ev.clientY;

  renderAllShapes();
}


function main() {
  setUpWebGL();
  connectFunctionsToGLSL();
  addActionsforHtmlUI();

  canvas.onmousedown = onMouseDown;
  canvas.onmouseup   = onMouseUp;
  canvas.onmouseleave= onMouseUp;
  canvas.onmousemove = onMouseMove;

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  requestAnimationFrame(tick);
}

var g_startTime = performance.now()/1000.0;
var g_seconds = performance.now()/1000.0 - g_startTime;

function tick() {
  g_seconds = performance.now()/1000.0;
  updateAnimationAngles();
  renderAllShapes();
  requestAnimationFrame(tick);
}

var g_shapesList =[];

function click(ev) {
  let [x,y] = convertCoordinatesEventToGL(ev);

  let shape;
  if(g_SelectedType == POINT){
    shape = new Point();
  } else if(g_SelectedType == TRIANGLE){
    shape = new Triangle();
  } else if(g_SelectedType == CIRCLE){
    shape = new Circle();
    shape.segments = g_SelectedSegments;
  }
  shape.position = [x, y];
  shape.color = g_selectedColor.slice();
  shape.size = g_SelectedSize;
  g_shapesList.push(shape);

  renderAllShapes();
}

function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX;
  var y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);
  return [x, y];
}

// Update animation angles of everything if currently animated
function updateAnimationAngles() {
  if (!g_animOn) {
    g_headAnimOffset = 0;
    g_earAnimOffset  = 0;
    g_tailAnimOffset = 0;
    return;
  }

  // amplitudes (degrees). These do NOT change your slider values; they add on top.
  const headAmp = 12;
  const earAmp  = 25;
  const tailAmp = 30;

  // speeds
  const headSpeed = 2.0;
  const earSpeed  = 4.0;
  const tailSpeed = 5.0;

  g_headAnimOffset = headAmp * Math.sin(headSpeed * g_seconds);
  g_earAnimOffset  = earAmp  * Math.sin(earSpeed  * g_seconds);
  g_tailAnimOffset = tailAmp * Math.sin(tailSpeed * g_seconds);
}

// Helper function to draw a cube
function drawCubePart(color, mat) {
  let c = new Cube();
  c.color = color;
  c.matrix = mat;
  c.render();
}

// Draw a sphere using triangles (lat/long). Uses current shader with u_ModelMatrix + u_FragColor.
function drawSpherePart(color, mat, latBands = 10, longBands = 10) {
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniformMatrix4fv(u_ModelMatrix, false, mat.elements);

  const r = 0.5; // unit sphere radius (scaled by mat)

  for (let lat = 0; lat < latBands; lat++) {
    const theta1 = (lat / latBands) * Math.PI;
    const theta2 = ((lat + 1) / latBands) * Math.PI;

    for (let lon = 0; lon < longBands; lon++) {
      const phi1 = (lon / longBands) * 2 * Math.PI;
      const phi2 = ((lon + 1) / longBands) * 2 * Math.PI;

      const p1 = [ r * Math.sin(theta1) * Math.cos(phi1), r * Math.cos(theta1), r * Math.sin(theta1) * Math.sin(phi1) ];
      const p2 = [ r * Math.sin(theta2) * Math.cos(phi1), r * Math.cos(theta2), r * Math.sin(theta2) * Math.sin(phi1) ];
      const p3 = [ r * Math.sin(theta2) * Math.cos(phi2), r * Math.cos(theta2), r * Math.sin(theta2) * Math.sin(phi2) ];
      const p4 = [ r * Math.sin(theta1) * Math.cos(phi2), r * Math.cos(theta1), r * Math.sin(theta1) * Math.sin(phi2) ];

      drawTriangle3D([ p1[0], p1[1], p1[2],  p2[0], p2[1], p2[2],  p3[0], p3[1], p3[2] ]);
      drawTriangle3D([ p1[0], p1[1], p1[2],  p3[0], p3[1], p3[2],  p4[0], p4[1], p4[2] ]);
    }
  }
}

function renderAllShapes() {
  var startTime = performance.now();

  // Global rotate (camera/scene)
  var globalRotMat = new Matrix4()
  .rotate(g_globalAngle, 0, 1, 0)
  .rotate(g_mouseRotX, 1, 0, 0)
  .rotate(g_mouseRotY, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.clearDepth(1.0);

  var len = g_shapesList.length;

  // === GOAT COLORS ===
  const fur     = [0.90, 0.88, 0.82, 1.0];
  const furDark = [0.80, 0.78, 0.72, 1.0];
  const hornCol = [0.55, 0.50, 0.40, 1.0];
  const hoofCol = [0.10, 0.10, 0.10, 1.0];
  const beardCol= [0.20, 0.20, 0.20, 1.0];

  // === GOAT DIMENSIONS ===
  const bodyL = 0.70, bodyH = 0.30, bodyW = 0.35;
  const legW  = 0.10, legH  = 0.35;
  const hoofH = 0.06;

  // Center helper along torso width (z axis)
  function z0_centered(partW) {
    return (-bodyW/2 + partW/2);
  }

  // Base for goat (DO NOT include globalRotMat here; shader already applies it)
  let goatBase = new Matrix4();
  goatBase.translate(-0.35, -0.55, 0.15);

  // --- Torso ---
  let torsoMat = new Matrix4(goatBase);
  torsoMat.scale(bodyL, bodyH, bodyW);
  drawCubePart(fur, torsoMat);

  // --- Neck ---
  const neckL = 0.18, neckH = 0.20, neckW = 0.16;
  let neckMat = new Matrix4(goatBase);
  neckMat.translate(bodyL*0.78, bodyH*0.60, z0_centered(neckW));
  neckMat.scale(neckL, neckH, neckW);
  drawCubePart(furDark, neckMat);

  // ============================================================
  // HEAD JOINT: everything attached to headFrame follows g_headAngle
  // ============================================================

  const headL = 0.26, headH = 0.22, headW = 0.22;

  // Head joint pivot (where head connects to neck)
  let headFrame = new Matrix4(goatBase);
  headFrame.translate(bodyL*0.90, bodyH*0.72, z0_centered(headW));
  headFrame.rotate(g_headAngle + g_headAnimOffset, 0, 0, 1);  // slider: nod head
  // move from pivot to head cube origin
  headFrame.translate(0.02, -0.08, 0.0);

  // --- Head cube ---
  let headMat = new Matrix4(headFrame);
  headMat.scale(headL, headH, headW);
  drawCubePart(fur, headMat);

  // --- Snout: trapezoid look (wide base -> narrow tip), attached to headFrame ---
  const snoutBaseL = 0.10, snoutBaseH = 0.12, snoutBaseW = 0.16;
  const snoutTipL  = 0.08, snoutTipH  = 0.10, snoutTipW  = 0.10;

  const snoutX_local = headL - 0.01;
  const snoutY_local = headH * 0.15;

  let snoutBase = new Matrix4(headFrame);
  snoutBase.translate(snoutX_local, snoutY_local, -headW/2 + snoutBaseW/2);
  snoutBase.scale(snoutBaseL, snoutBaseH, snoutBaseW);
  drawCubePart(furDark, snoutBase);

  let snoutTip = new Matrix4(headFrame);
  snoutTip.translate(snoutX_local + snoutBaseL*0.6, snoutY_local - 0.01, -headW/2 + snoutTipW/2);
  snoutTip.scale(snoutTipL, snoutTipH, snoutTipW);
  drawCubePart(furDark, snoutTip);

  let nose = new Matrix4(headFrame);
  nose.translate(snoutX_local + snoutBaseL*0.85 + snoutTipL*0.75, snoutY_local + 0.03, -headW/2 + 0.06/2);
  nose.scale(0.04, 0.04, 0.06);
  drawCubePart([0.08, 0.08, 0.08, 1.0], nose);

  // --- Eyes: two small spheres (non-cube primitive), attached to headFrame ---
  const eyeCol = [0.0, 0.0, 0.0, 1.0];
  const eyeRadius = 0.05;

  const eyeX_local = headL + 0.03;
  const eyeY_local = headH * 0.75;

  // Z positions in head local space: 0..-headW
  const eyeZLeft_local  = -headW * 0.10;
  const eyeZRight_local = -headW * 0.95;

  let eyeSphereL = new Matrix4(headFrame);
  eyeSphereL.translate(eyeX_local, eyeY_local, eyeZLeft_local);
  eyeSphereL.scale(eyeRadius, eyeRadius, eyeRadius);
  drawSpherePart(eyeCol, eyeSphereL, 10, 10);

  let eyeSphereR = new Matrix4(headFrame);
  eyeSphereR.translate(eyeX_local, eyeY_local, eyeZRight_local);
  eyeSphereR.scale(eyeRadius, eyeRadius, eyeRadius);
  drawSpherePart(eyeCol, eyeSphereR, 10, 10);

  // --- Horns (2 segments), attached to headFrame ---
  const hornSegL = 0.05, hornSegW = 0.05;
  const hornSegH1 = 0.09;
  const hornSegH2 = 0.07;

  const hornBaseX_local = headL * 0.35;
  const hornBaseY_local = headH - 0.01;
  const hornZLeft_local  = -headW * 0.35;
  const hornZRight_local = -headW * 0.75;

  const hornTilt1 = 18;
  const hornTilt2 = 30;

  function drawCurvedHornLocal(zPosLocal) {
    let h1 = new Matrix4(headFrame);
    h1.translate(hornBaseX_local, hornBaseY_local, zPosLocal);
    h1.rotate(hornTilt1, 0, 0, 1);
    h1.scale(hornSegL, hornSegH1, hornSegW);
    drawCubePart(hornCol, h1);

    let h2 = new Matrix4(headFrame);
    h2.translate(hornBaseX_local + 0.01, hornBaseY_local + hornSegH1*0.85, zPosLocal);
    h2.rotate(hornTilt2, 0, 0, 1);
    h2.scale(hornSegL, hornSegH2, hornSegW);
    drawCubePart(hornCol, h2);
  }
  drawCurvedHornLocal(hornZLeft_local);
  drawCurvedHornLocal(hornZRight_local);

  // --- Beard (V-shape), attached to headFrame ---
  const beardStemL = 0.04, beardStemH = 0.12, beardStemW = 0.04;
  const beardAngle = 25;

  const beardX_local = snoutX_local + snoutBaseL * 0.55;
  const beardY_local = snoutY_local - 0.10;
  const beardZ_local = -headW/2 + 0.05/2;

  let beardLmat = new Matrix4(headFrame);
  beardLmat.translate(beardX_local, beardY_local, beardZ_local);
  beardLmat.rotate(beardAngle, 0, 0, 1);
  beardLmat.scale(beardStemL, beardStemH, beardStemW);
  drawCubePart(beardCol, beardLmat);

  let beardRmat = new Matrix4(headFrame);
  beardRmat.translate(beardX_local, beardY_local, beardZ_local);
  beardRmat.rotate(-beardAngle, 0, 0, 1);
  beardRmat.scale(beardStemL, beardStemH, beardStemW);
  drawCubePart(beardCol, beardRmat);

  // ============================================================
  // EAR JOINT (ears flap, but still attached to headFrame)
  const earCol = furDark;
const earL = 0.08, earH = 0.10, earW = 0.04;
const earBaseX_local = headL * 0.15;
const earBaseY_local = headH * 0.65;

// how much the ear naturally droops
const earDroop = -20;     // Z-axis tilt (constant)

// Left ear
let earLeft = new Matrix4(headFrame);
earLeft.translate(earBaseX_local, earBaseY_local, -headW * -0.125);

// droop (constant, so it doesn't "slide")
earLeft.rotate(earDroop, 0, 0, 1);

// flap OUT/IN around Y axis (slider)
earLeft.rotate(g_earAngle + g_earAnimOffset, 0, 1, 0);

earLeft.scale(earL, earH, earW);
drawCubePart(earCol, earLeft);

// Right ear (mirror)
let earRight = new Matrix4(headFrame);
earRight.translate(earBaseX_local, earBaseY_local - 0.01, -headW * 1.0);

// same droop
earRight.rotate(earDroop, 0, 0, 1);

// mirror flap direction (negative)
earRight.rotate(-g_earAngle + g_earAnimOffset, 0, 1, 0);

earRight.scale(earL, earH, earW);
drawCubePart(earCol, earRight);

  // --- Legs (4) ---
  function drawLeg(x, z) {
    let legMat = new Matrix4(goatBase);
    legMat.translate(x, -legH, z);
    legMat.scale(legW, legH, legW);
    drawCubePart(furDark, legMat);

    let hoofMat = new Matrix4(goatBase);
    hoofMat.translate(x, -legH - hoofH, z);
    hoofMat.scale(legW, hoofH, legW);
    drawCubePart(hoofCol, hoofMat);
  }

  const xFront = bodyL*0.12;
  const xBack  = bodyL*0.72;
  const zNear  = -0.025;
  const zFar   = -0.225;

  drawLeg(xFront, zNear);
  drawLeg(xFront, zFar);
  drawLeg(xBack,  zNear);
  drawLeg(xBack,  zFar);

  // ============================================================
  // TAIL JOINT (wag up/down), attached to torso/goatBase
  // ============================================================
const tailFlapL = 0.10;
const tailFlapH = 0.06;
const tailFlapW = 0.07;
const tailZOffset = -.05; 

let tailFrame = new Matrix4(goatBase);
tailFrame.translate(bodyL - 0.70, bodyH * 0.79, z0_centered(tailFlapW) + tailZOffset);
tailFrame.rotate(g_tailAngle + g_tailAnimOffset, 0, 0, 1);  // wag

let tailFlap = new Matrix4(tailFrame);

tailFlap.rotate(180, 0, 1, 0);

// your resting tilt
tailFlap.rotate(-25, 0, 0, 1);

tailFlap.scale(tailFlapL, tailFlapH, tailFlapW);
drawCubePart(furDark, tailFlap);


  var duration = performance.now() - startTime;
  sendTextToHTML("numdot: " + len + " ms: " + Math.floor(duration) + " fps: " + Math.floor(10000/duration)/10, "numdot");
}

function sendTextToHTML(text, htmlID) {
  var htmlElm = document.getElementById(htmlID);
  if(!htmlElm) {
    console.log("Failed to get " + htmlID + " from HTML");
    return;
  }
  htmlElm.innerHTML = text;
}

