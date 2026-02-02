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
let g_globalAngle = 0;
let g_yellowAngle = 0;
let g_magentaAngle = 0;
let g_yellowAnimation = false;

function setUpWebGL() {
  // Retrieve <canvas> element
canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
//gl = getWebGLContext(canvas);
gl = canvas.getContext("webgl", {preserveDrawingBuffer: true});
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

// Enables blending for transparency
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

gl.enable(gl.DEPTH_TEST);

}

function connectFunctionsToGLSL() {
    // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  // Get the storage location of u_FragColor
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

  // Get the storage location of u_ModelMatrix
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

  //document.getElementById('pointButton').onclick = function() {g_SelectedType = POINT;};
  //document.getElementById('triangleButton').onclick = function() {g_SelectedType = TRIANGLE;};
  //document.getElementById('circleButton').onclick = function() {g_SelectedType = CIRCLE;};
  // document.getElementById('drawPictureButton').onclick = function() {drawMyPicture();};

  //document.getElementById('redSlider').addEventListener('mouseup', function() {g_selectedColor[0] = this.value/100;});
  //document.getElementById('greenSlider').addEventListener('mouseup', function() {g_selectedColor[1] = this.value/100;});
  //document.getElementById('blueSlider').addEventListener('mouseup', function() {g_selectedColor[2] = this.value/100;});
  //document.getElementById('animationYellowOffButton').onclick = function() {g_yellowAnimation = false;}
  //document.getElementById('animationYellowOnButton').onclick = function() {g_yellowAnimation = true;}

  //document.getElementById('yellowSlide').addEventListener('mousemove', function() {g_yellowAngle = this.value; renderAllShapes();});
  //document.getElementById('magentaSlide').addEventListener('mousemove', function() {g_magentaAngle = this.value; renderAllShapes();});
  // document.getElementById('alphaSlider').addEventListener('mouseup', function() {g_selectedColor[3] = this.value/100;});
  document.getElementById('angleSlide').addEventListener('mousemove', function() {g_globalAngle = this.value; renderAllShapes();});
  // document.getElementById('sizeSlider').addEventListener('mouseup', function() {g_SelectedSize = this.value;});
  // document.getElementById('segmentsSlider').addEventListener('mouseup', function() {g_SelectedSegments = this.value;});
}

function main() {

    setUpWebGL();
    connectFunctionsToGLSL();
    addActionsforHtmlUI();

  // Register function (event handler) to be called on a mouse press
  canvas.onmousedown = click;
  canvas.onmousemove = function(ev) { if(ev.buttons==1) click(ev); };

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  // gl.clear(gl.COLOR_BUFFER_BIT);
  // renderAllShapes();
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
  // Store the coordinates to g_points array
  //g_points.push([x, y]);

  //g_colors.push(g_selectedColor.slice());

  //g_sizes.push(g_SelectedSize);
  // Store the coordinates to g_points array
  //if (x >= 0.0 && y >= 0.0) {      // First quadrant
  //  g_colors.push([1.0, 0.0, 0.0, 1.0]);  // Red
  //} else if (x < 0.0 && y < 0.0) { // Third quadrant
  //  g_colors.push([0.0, 1.0, 0.0, 1.0]);  // Green
  //} else {                         // Others
  //  g_colors.push([1.0, 1.0, 1.0, 1.0]);  // White
  // }
  
  renderAllShapes();
  // Clear <canvas>
}

function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);
  return [x, y];
}

// Update animation angles of everything if currently animated
function updateAnimationAngles() {
    if (g_yellowAnimation) {
        g_yellowAngle = (45 * Math.sin(g_seconds));
    }
}

// Helper function to draw a cube
function drawCubePart(color, mat) {
    let c = new Cube();
    c.color = color;
    c.matrix = mat;
    c.render();
  }

  function drawSpherePart(color, mat, latBands = 10, longBands = 10) {
  // set color + matrix once for the whole sphere
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniformMatrix4fv(u_ModelMatrix, false, mat.elements);

  // Unit sphere centered at origin (radius 0.5). You scale it with 'mat'.
  const r = 0.5;

  for (let lat = 0; lat < latBands; lat++) {
    const theta1 = (lat / latBands) * Math.PI;
    const theta2 = ((lat + 1) / latBands) * Math.PI;

    for (let lon = 0; lon < longBands; lon++) {
      const phi1 = (lon / longBands) * 2 * Math.PI;
      const phi2 = ((lon + 1) / longBands) * 2 * Math.PI;

      // 4 points of a quad on the sphere surface
      const p1 = [
        r * Math.sin(theta1) * Math.cos(phi1),
        r * Math.cos(theta1),
        r * Math.sin(theta1) * Math.sin(phi1)
      ];
      const p2 = [
        r * Math.sin(theta2) * Math.cos(phi1),
        r * Math.cos(theta2),
        r * Math.sin(theta2) * Math.sin(phi1)
      ];
      const p3 = [
        r * Math.sin(theta2) * Math.cos(phi2),
        r * Math.cos(theta2),
        r * Math.sin(theta2) * Math.sin(phi2)
      ];
      const p4 = [
        r * Math.sin(theta1) * Math.cos(phi2),
        r * Math.cos(theta1),
        r * Math.sin(theta1) * Math.sin(phi2)
      ];

      // two triangles (p1,p2,p3) and (p1,p3,p4)
      drawTriangle3D([
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2],
        p3[0], p3[1], p3[2]
      ]);
      drawTriangle3D([
        p1[0], p1[1], p1[2],
        p3[0], p3[1], p3[2],
        p4[0], p4[1], p4[2]
      ]);
    }
  }
}

function renderAllShapes() {
  var startTime = performance.now();

  var globalRotMat = new Matrix4().rotate(g_globalAngle, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.clearDepth(gl.COLOR_BUFFER_BIT); 

  
  var len = g_shapesList.length;
  //for(var i = 0; i < len; i++) {
    // g_shapesList[i].render();
  //}

  const fur     = [0.90, 0.88, 0.82, 1.0];   // light tan/cream
  const furDark = [0.80, 0.78, 0.72, 1.0];   // slightly darker
  const hornCol = [0.55, 0.50, 0.40, 1.0];   // brown/khaki
  const hoofCol = [0.10, 0.10, 0.10, 1.0];   // black
  const eyeWhite= [1.00, 1.00, 1.00, 1.0];
  const eyePupil= [0.00, 0.00, 0.00, 1.0];

 const bodyL = 0.70, bodyH = 0.30, bodyW = 0.35; // torso
 const legW  = 0.10, legH  = 0.35;
 const hoofH = 0.06;

// Helper: for centered parts along the torso width (z axis)
function z0_centered(partW) {
  // cube spans z: [z0, z0 - partW], center is z0 - partW/2
  // want center at -bodyW/2  => z0 = -bodyW/2 + partW/2
  return (-bodyW/2 + partW/2);
}

// A NON-SCALED anchor for the whole goat (build everything off this)
let goatBase = new Matrix4();
goatBase.translate(-0.35, -0.55, 0.15);  // same overall placement you had

// --- Torso ---
let torsoMat = new Matrix4(goatBase);
torsoMat.scale(bodyL, bodyH, bodyW);
drawCubePart(fur, torsoMat);

// --- Neck (center it in Z) ---
const neckL = 0.18, neckH = 0.20, neckW = 0.16;
let neckMat = new Matrix4(goatBase);
neckMat.translate(bodyL*0.78, bodyH*0.60, z0_centered(neckW));
neckMat.scale(neckL, neckH, neckW);
drawCubePart(furDark, neckMat);

// --- Head (center it in Z) ---
const headL = 0.26, headH = 0.22, headW = 0.22;
let headMat = new Matrix4(goatBase);
headMat.translate(bodyL*0.92, bodyH*0.62, z0_centered(headW));
headMat.scale(headL, headH, headW);
drawCubePart(fur, headMat);

const headAnchorX = bodyL * 0.92;
const headAnchorY = bodyH * 0.62;

// --- Snout (centered, pushed forward) ----

const snoutBaseL = 0.10, snoutBaseH = 0.12, snoutBaseW = 0.16;  // near head (wider)
const snoutTipL  = 0.08, snoutTipH  = 0.10, snoutTipW  = 0.10;  // front (narrower)

// Position anchors (use your existing head anchors so it stays centered)
const snoutX = headAnchorX + headL - 0.01;     // start at head front
const snoutY = headAnchorY + headH * 0.15;     // a bit lower than centerline

// BASE segment (attached to head)
let snoutBase = new Matrix4(goatBase);
snoutBase.translate(snoutX, snoutY, z0_centered(snoutBaseW));
snoutBase.scale(snoutBaseL, snoutBaseH, snoutBaseW);
drawCubePart(furDark, snoutBase);

// TIP segment (slightly forward, slightly up, narrower)
let snoutTip = new Matrix4(goatBase);
snoutTip.translate(snoutX + snoutBaseL * 0.6, snoutY - 0.01, z0_centered(snoutTipW));
snoutTip.scale(snoutTipL, snoutTipH, snoutTipW);
drawCubePart(furDark, snoutTip);

// Optional: nose block (tiny dark cube at very front)
let nose = new Matrix4(goatBase);
nose.translate(snoutX + snoutBaseL * 0.85 + snoutTipL * 0.75, snoutY + 0.03, z0_centered(0.06));
nose.scale(0.04, 0.04, 0.06);
drawCubePart([0.08, 0.08, 0.08, 1.0], nose);

// --- Eyes (tiny cubes on head front-sides) ---
// --- Eyes: two small spheres (non-cube primitive) ---
const eyeCol = [0.0, 0.0, 0.0, 1.0];
const eyeRadius = 0.05; // tweak size

const eyeX = headAnchorX + headL - 0.02;
const eyeY = headAnchorY + headH * 0.60;
const eyeZLeft  = (-headW * 0.35);
const eyeZRight = (-headW * 1.25);

let eyeSphereL = new Matrix4(goatBase);
eyeSphereL.translate(eyeX, eyeY, eyeZLeft);
eyeSphereL.scale(eyeRadius, eyeRadius, eyeRadius);
drawSpherePart(eyeCol, eyeSphereL, 10, 10);

let eyeSphereR = new Matrix4(goatBase);
eyeSphereR.translate(eyeX, eyeY, eyeZRight);
eyeSphereR.scale(eyeRadius, eyeRadius, eyeRadius);
drawSpherePart(eyeCol, eyeSphereR, 10, 10);


// --- Horns (on top of head, centered) ---
// --- Horns (attached on top of head, symmetric left/right) ---
// --- Horns (2 segments = curved look) ---
const hornSegL = 0.05, hornSegW = 0.05;
const hornSegH1 = 0.09;
const hornSegH2 = 0.07;

const hornBaseY = headAnchorY + headH - 0.01;
const hornBaseX = headAnchorX + headL * 0.35;
const hornZLeft  = (-headW * 0.5);
const hornZRight = (-headW * 0.9);

// tweak these two angles
const hornTilt1 = 18;  // base tilt
const hornTilt2 = 30;  // tip tilt (more bend)

function drawCurvedHorn(zPos) {
  // base segment
  let h1 = new Matrix4(goatBase);
  h1.translate(hornBaseX, hornBaseY, zPos);
  h1.rotate(hornTilt1, 0, 0, 1);
  h1.scale(hornSegL, hornSegH1, hornSegW);
  drawCubePart(hornCol, h1);

  // tip segment (starts near top of base segment)
  let h2 = new Matrix4(goatBase);
  h2.translate(hornBaseX + 0.01, hornBaseY + hornSegH1*0.85, zPos);
  h2.rotate(hornTilt2, 0, 0, 1);
  h2.scale(hornSegL, hornSegH2, hornSegW);
  drawCubePart(hornCol, h2);
}

drawCurvedHorn(hornZLeft);
drawCurvedHorn(hornZRight);

// Beard
const beardCol = [0.20, 0.20, 0.20, 1.0]; // dark beard
const beardStemL = 0.04;
const beardStemH = 0.12;
const beardStemW = 0.04;

// Position it under the snout tip
const beardX = snoutX + snoutBaseL * 0.55;      // near snout tip
const beardY = snoutY - 0.10;                   // below snout
const beardZ = z0_centered(0.05);               // centered-ish

const beardAngle = 25; // tweak this: 15 (narrow V) to 35 (wide V)

// Left stem (leans left)
let beardL = new Matrix4(goatBase);
beardL.translate(beardX, beardY, beardZ);
beardL.rotate(beardAngle, 0, 0, 1);             // rotate in X-Y plane
beardL.scale(beardStemL, beardStemH, beardStemW);
drawCubePart(beardCol, beardL);

// Right stem (leans right)
let beardR = new Matrix4(goatBase);
beardR.translate(beardX, beardY, beardZ);
beardR.rotate(-beardAngle, 0, 0, 1);
beardR.scale(beardStemL, beardStemH, beardStemW);
drawCubePart(beardCol, beardR);

// Ear flaps
const earCol = furDark;          // or fur if you want lighter ears
const earL = 0.08, earH = 0.10, earW = 0.04;

// Attach near upper-back area of head
const earBaseX = headAnchorX + headL * 0.15;
const earBaseY = headAnchorY + headH * 0.65;

// Left ear (one side of head)
let earLeft = new Matrix4(goatBase);
earLeft.translate(earBaseX, earBaseY, (-headW * 0.15)); // tweak this for left/right
earLeft.rotate(-20, 0, 0, 1);                            // tilt down/back in X-Y
earLeft.rotate(-15, 1, 0, 0);                            // angle outward from head
earLeft.scale(earL, earH, earW);
drawCubePart(earCol, earLeft);

// Right ear (other side)
let earRight = new Matrix4(goatBase);
earRight.translate(earBaseX, earBaseY - 0.01, (-headW * 1.4)); // tweak this for left/right
earRight.rotate(-20, 0, 0, 1);
earRight.rotate(15, 1, 0, 0);
earRight.scale(earL, earH, earW);
drawCubePart(earCol, earRight);

// --- Legs (4 corners under torso; z uses 0 and -bodyW) ---
function drawLeg(x, z) {
  let legMat = new Matrix4(goatBase);
  legMat.translate(x, -legH, z);   // under body
  legMat.scale(legW, legH, legW);
  drawCubePart(furDark, legMat);

  let hoofMat = new Matrix4(goatBase);
  hoofMat.translate(x, -legH - hoofH, z);
  hoofMat.scale(legW, hoofH, legW);
  drawCubePart(hoofCol, hoofMat);
}

// Choose leg placements relative to body size
const xFront = bodyL*0.12;
const xBack  = bodyL*0.72;
const zNear  = -.025;
const zFar   = -0.225;

drawLeg(xFront, zNear); // front near
drawLeg(xFront, zFar);  // front far
drawLeg(xBack,  zNear); // back near
drawLeg(xBack,  zFar);  // back far

// --- Tail (stick it OUT the back, centered in Z) ---
const tailFlapL = 0.10;   // how far it sticks out
const tailFlapH = 0.06;   // height
const tailFlapW = 0.07;   // THIN flap

let tailFlap = new Matrix4(goatBase);

// Push it clearly past the back of the torso so it can't blend into it
tailFlap.translate(bodyL - 0.79, bodyH * 0.85, z0_centered(tailFlapW));

// Angle it a bit (down/back). Tweak angle if you want more "flap"
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
