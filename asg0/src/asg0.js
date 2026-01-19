var canvas;
var ctx;

function main() {
  // Get the canvas element
  canvas = document.getElementById('example');
  if (!canvas) {
    console.log('Failed to retrieve the <canvas> element');
    return;
  }

  // Get 2D drawing context
  ctx = canvas.getContext('2d');

  // Clear (black background) and draw initial vectors from defaults
  clearCanvas();
  handleDrawEvent();
}

// Helper: fill canvas black
function clearCanvas() {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Draw a vector v from the center of the canvas
function drawVector(v, color) {
  var x = v.elements[0];
  var y = v.elements[1];

  // Scale coordinates by 20 (per instructions)
  var scale = 20;

  // Origin is the center of the canvas
  var originX = canvas.width / 2;
  var originY = canvas.height / 2;

  ctx.beginPath();
  ctx.moveTo(originX, originY);
  // Canvas y increases downward, so subtract y
  ctx.lineTo(originX + x * scale, originY - y * scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// First button: draw v1 (red) and v2 (blue) from the inputs
function handleDrawEvent() {
  // Clear the canvas
  clearCanvas();

  // --- v1 inputs ---
  var xVal1 = parseFloat(document.getElementById("xInput").value);
  var yVal1 = parseFloat(document.getElementById("yInput").value);

  // --- v2 inputs ---
  var xVal2 = parseFloat(document.getElementById("x2Input").value);
  var yVal2 = parseFloat(document.getElementById("y2Input").value);

  if (isNaN(xVal1) || isNaN(yVal1) || isNaN(xVal2) || isNaN(yVal2)) {
    console.log("Invalid input for v1 or v2");
    return;
  }

  var v1 = new Vector3([xVal1, yVal1, 0.0]);
  var v2 = new Vector3([xVal2, yVal2, 0.0]);

  // Draw original vectors
  drawVector(v1, "red");
  drawVector(v2, "blue");
}

// Compute angle between v1 and v2 in degrees (using dot product)
function angleBetween(v1, v2) {
  var dot = Vector3.dot(v1, v2);
  var m1 = v1.magnitude();
  var m2 = v2.magnitude();

  if (m1 === 0 || m2 === 0) {
    return null; // angle not defined if a vector has zero length
  }

  var cosAlpha = dot / (m1 * m2);

  // Clamp due to floating point rounding
  if (cosAlpha > 1) cosAlpha = 1;
  if (cosAlpha < -1) cosAlpha = -1;

  var radians = Math.acos(cosAlpha);
  var degrees = radians * 180 / Math.PI;
  return degrees;
}

// Compute area of triangle formed by v1 and v2 using cross product
function areaTriangle(v1, v2) {
  // |v1 x v2| = area of parallelogram
  // triangle area = 1/2 * |v1 x v2|
  var cross = Vector3.cross(v1, v2);
  var areaParallelogram = cross.magnitude();
  var area = areaParallelogram / 2.0;
  return area;
}

// Second button: draw v1, v2, and operation result(s)
function handleDrawOperationEvent() {
  // Clear the canvas
  clearCanvas();

  // --- v1 inputs ---
  var xVal1 = parseFloat(document.getElementById("xInput").value);
  var yVal1 = parseFloat(document.getElementById("yInput").value);

  // --- v2 inputs ---
  var xVal2 = parseFloat(document.getElementById("x2Input").value);
  var yVal2 = parseFloat(document.getElementById("y2Input").value);

  if (isNaN(xVal1) || isNaN(yVal1) || isNaN(xVal2) || isNaN(yVal2)) {
    console.log("Invalid input for v1 or v2");
    return;
  }

  var v1 = new Vector3([xVal1, yVal1, 0.0]);
  var v2 = new Vector3([xVal2, yVal2, 0.0]);

  // Always draw the original v1 (red) and v2 (blue) first
  drawVector(v1, "red");
  drawVector(v2, "blue");

  // Read operation and scalar
  var op = document.getElementById("opSelect").value;
  var s  = parseFloat(document.getElementById("scalarInput").value);

  // For mul/div we need a valid scalar
  if ((op === "mul" || op === "div") && isNaN(s)) {
    console.log("Invalid scalar s");
    return;
  }

  if (op === "add") {
    var v3 = new Vector3(v1.elements);
    v3.add(v2);
    drawVector(v3, "green");

  } else if (op === "sub") {
    var v3 = new Vector3(v1.elements);
    v3.sub(v2);
    drawVector(v3, "green");

  } else if (op === "mul") {
    var v3 = new Vector3(v1.elements);
    var v4 = new Vector3(v2.elements);
    v3.mul(s);
    v4.mul(s);
    drawVector(v3, "green");
    drawVector(v4, "green");

  } else if (op === "div") {
    var v3 = new Vector3(v1.elements);
    var v4 = new Vector3(v2.elements);
    v3.div(s);
    v4.div(s);
    drawVector(v3, "green");
    drawVector(v4, "green");

  } else if (op === "magnitude") {
    var m1 = v1.magnitude();
    var m2 = v2.magnitude();
    console.log("magnitude(v1) =", m1);
    console.log("magnitude(v2) =", m2);

  } else if (op === "normalize") {
    var m1_before = v1.magnitude();
    var m2_before = v2.magnitude();
    console.log("before normalize: |v1| =", m1_before, ", |v2| =", m2_before);

    var v1n = new Vector3(v1.elements);
    var v2n = new Vector3(v2.elements);
    v1n.normalize();
    v2n.normalize();
    console.log("after normalize: |v1n| =", v1n.magnitude(), ", |v2n| =", v2n.magnitude());

    drawVector(v1n, "green");
    drawVector(v2n, "green");

  } else if (op === "angle") {
    var angleDeg = angleBetween(v1, v2);
    if (angleDeg === null) {
      console.log("Angle is undefined: one of the vectors has zero length.");
    } else {
      console.log("Angle between v1 and v2 (degrees):", angleDeg);
    }

  } else if (op === "area") {
    var area = areaTriangle(v1, v2);
    console.log("Area of triangle formed by v1 and v2:", area);
    // Visualization is still the red and blue vectors forming the triangle with the origin
  }
}
