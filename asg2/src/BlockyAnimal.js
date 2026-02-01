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
  document.getElementById('animationYellowOffButton').onclick = function() {g_yellowAnimation = false;}
  document.getElementById('animationYellowOnButton').onclick = function() {g_yellowAnimation = true;}

  document.getElementById('yellowSlide').addEventListener('mousemove', function() {g_yellowAngle = this.value; renderAllShapes();});
  document.getElementById('magentaSlide').addEventListener('mousemove', function() {g_magentaAngle = this.value; renderAllShapes();});
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


  // Draw a body cube
  var body = new Cube();
  body.color = [1.0, 0.0, 0.0, 1.0];
  body.matrix.translate(-0.25, -0.75, 0.0);
  body.matrix.rotate(-5, 1, 0, 0);
  body.matrix.scale(0.5, 0.3, 0.5);
  body.render();

  // Draw left arm
  var leftArm = new Cube();
  leftArm.color = [1.0, 1.0, 0.0, 1.0];
  leftArm.matrix.translate(0, -0.5, 0);
  leftArm.matrix.rotate(-5, 1, 0, 0);
leftArm.matrix.rotate(-g_yellowAngle, 0, 0, 1);
  //if (g_yellowAnimation) {
    //leftArm.matrix.rotate(45*Math.sin(g_seconds), -0, 0, 1);
  //} else {
    //leftArm.matrix.rotate(-g_yellowAngle, 0, 0, 1);
  //}
  var yellowCoordinatesMat = new Matrix4(leftArm.matrix);
  leftArm.matrix.scale(0.25, 0.7, 0.5);
  leftArm.matrix.translate(-0.5, 0, 0);
  leftArm.render();

  // Test box
  var box = new Cube();
  box.color = [1, 0, 1, 1];
  box.matrix = yellowCoordinatesMat;
  box.matrix.translate(0, 0.7, 0);
  box.matrix.rotate(g_magentaAngle, 0, 0, 1);
  box.matrix.scale(0.3,0.3,0.3);
  box.matrix.translate(-0.5, 0, -0.001);
  //box.matrix.rotate(-30, 1, 0, 0);
  //box.matrix.scale(0.2, 0.4, 0.2);
  box.render();

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
