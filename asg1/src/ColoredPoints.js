// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE =`
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
  gl_Position = a_Position;
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

}
function addActionsforHtmlUI() {
  document.getElementById('green').onclick = function() {g_selectedColor = [0.0, 1.0, 0.0, 1.0];};
  document.getElementById('red').onclick = function() {g_selectedColor = [1.0, 0.0, 0.0, 1.0];};
  document.getElementById('clearButton').onclick = function() {g_shapesList = []; renderAllShapes();};

  document.getElementById('pointButton').onclick = function() {g_SelectedType = POINT;};
  document.getElementById('triangleButton').onclick = function() {g_SelectedType = TRIANGLE;};
  document.getElementById('circleButton').onclick = function() {g_SelectedType = CIRCLE;};
  document.getElementById('drawPictureButton').onclick = function() {drawMyPicture();};

  document.getElementById('redSlider').addEventListener('mouseup', function() {g_selectedColor[0] = this.value/100;});
  document.getElementById('greenSlider').addEventListener('mouseup', function() {g_selectedColor[1] = this.value/100;});
  document.getElementById('blueSlider').addEventListener('mouseup', function() {g_selectedColor[2] = this.value/100;});
  document.getElementById('alphaSlider').addEventListener('mouseup', function() {g_selectedColor[3] = this.value/100;});

  document.getElementById('sizeSlider').addEventListener('mouseup', function() {g_SelectedSize = this.value;});
  document.getElementById('segmentsSlider').addEventListener('mouseup', function() {g_SelectedSegments = this.value;});
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
  gl.clear(gl.COLOR_BUFFER_BIT);
}


//var g_points = [];  // The array for the position of a mouse press
//var g_colors = [];  // The array to store the color of a point
//var g_sizes = [];   // The array to store the size of a point

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

function renderAllShapes() {
  var startTime = performance.now();
    gl.clear(gl.COLOR_BUFFER_BIT);

  //var len = g_points.length;
  var len = g_shapesList.length;
  for(var i = 0; i < len; i++) {
    g_shapesList[i].render();
}
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

function drawMyPicture() {
  // Clear canvas first
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  // Define colors
  const red = [1.0, 0.0, 0.0, 1.0];
  const blue = [0.0, 0.5, 1.0, 1.0];
  const brown = [0.6, 0.3, 0.0, 1.0];
  const green = [0.0, 0.8, 0.0, 1.0];
  const darkGreen = [0.0, 0.5, 0.0, 1.0];
  const yellow = [1.0, 1.0, 0.0, 1.0];
  const white = [1.0, 1.0, 1.0, 1.0];
  
  // Helper function
  function drawTriangleWithColor(x1, y1, x2, y2, x3, y3, color) {
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    drawTriangle([x1, y1, x2, y2, x3, y3]);
  }
  
  // === HOUSE ===
  
  // House body (2 triangles to make a rectangle)
  drawTriangleWithColor(-0.4, -0.2, 0.4, -0.2, 0.4, -0.7, blue);
  drawTriangleWithColor(-0.4, -0.2, 0.4, -0.7, -0.4, -0.7, blue);
  
  // Roof (2 triangles)
  drawTriangleWithColor(-0.5, -0.2, 0.0, 0.3, 0.5, -0.2, red);
  drawTriangleWithColor(-0.5, -0.2, 0.5, -0.2, 0.0, 0.3, red);
  
  // Door (2 triangles)
  drawTriangleWithColor(-0.1, -0.7, 0.1, -0.7, 0.1, -0.4, brown);
  drawTriangleWithColor(-0.1, -0.7, 0.1, -0.4, -0.1, -0.4, brown);
  
  // Left window (2 triangles)
  drawTriangleWithColor(-0.3, -0.3, -0.15, -0.3, -0.15, -0.45, yellow);
  drawTriangleWithColor(-0.3, -0.3, -0.15, -0.45, -0.3, -0.45, yellow);
  
  // Right window (2 triangles)
  drawTriangleWithColor(0.15, -0.3, 0.3, -0.3, 0.3, -0.45, yellow);
  drawTriangleWithColor(0.15, -0.3, 0.3, -0.45, 0.15, -0.45, yellow);
  
  // === TREE ===
  
  // Tree trunk (2 triangles)
  drawTriangleWithColor(0.5, -0.7, 0.65, -0.7, 0.65, -0.3, brown);
  drawTriangleWithColor(0.5, -0.7, 0.65, -0.3, 0.5, -0.3, brown);
  
  // Tree foliage - bottom layer (3 triangles)
  drawTriangleWithColor(0.4, -0.3, 0.575, 0.0, 0.75, -0.3, green);
  drawTriangleWithColor(0.35, -0.15, 0.575, 0.0, 0.4, -0.3, darkGreen);
  drawTriangleWithColor(0.75, -0.3, 0.575, 0.0, 0.8, -0.15, darkGreen);
  
  // Tree foliage - middle layer (2 triangles)
  drawTriangleWithColor(0.45, 0.0, 0.575, 0.25, 0.7, 0.0, green);
  drawTriangleWithColor(0.4, 0.1, 0.575, 0.25, 0.45, 0.0, darkGreen);
  
  // Tree foliage - top layer (1 triangle)
  drawTriangleWithColor(0.5, 0.25, 0.575, 0.45, 0.65, 0.25, green);
  
  // === SUN ===
  
  // Sun (4 triangles to make a diamond/star shape)
  drawTriangleWithColor(-0.7, 0.5, -0.6, 0.6, -0.5, 0.5, yellow);
  drawTriangleWithColor(-0.7, 0.5, -0.6, 0.4, -0.5, 0.5, yellow);
  drawTriangleWithColor(-0.6, 0.6, -0.6, 0.4, -0.5, 0.5, yellow);
  drawTriangleWithColor(-0.7, 0.5, -0.6, 0.6, -0.6, 0.4, yellow);
  
  // === GROUND ===
  
  // Grass (2 triangles)
  drawTriangleWithColor(-1.0, -0.7, 1.0, -0.7, 1.0, -1.0, green);
  drawTriangleWithColor(-1.0, -0.7, 1.0, -1.0, -1.0, -1.0, green);
  
  console.log("Picture drawn with 26 triangles!");
}