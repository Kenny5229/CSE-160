class Cube {
  constructor() {
    this.type = 'cube';
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
  }

  render() {
    var rgba = this.color;

    gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    gl.uniform4f(u_FragColor, rgba[0]*0.9,rgba[1]*0.9, rgba[2]*0.9, rgba[3]);

    // Front face (z = 0)
    drawTriangle3DUV(
  [0,0,0,   1,1,0,   1,0,0],
  [0,0,     1,1,     1,0]
  );

  drawTriangle3DUV(
  [0,0,0,   0,1,0,   1,1,0],
  [0,0,     0,1,     1,1]
  );

  // Back face (z = -1)
  drawTriangle3DUV([0,0,-1,  1,0,-1,  1,1,-1], 
  [0,0,     1,0,     1,1]
  );

  drawTriangle3DUV(
  [0,0,-1,  0,1,-1,  1,1,-1],
  [0,0,     0,1,     1,1]
  );

  // Top face (y = 1)
  drawTriangle3DUV(
  [0,1,0,   1,1,0,   1,1,-1],
  [0,0,     1,0,     1,1]
  );

  drawTriangle3DUV(
  [0,1,0,   0,1,-1,  1,1,-1],
  [0,0,     0,1,     1,1]
  );

  // Bottom face (y = 0)
  drawTriangle3DUV(
  [0,0,0,   1,0,-1,  1,0,0],
  [0,0,     1,1,     1,0]
  );

  drawTriangle3DUV(
  [0,0,0,   0,0,-1,  1,0,-1],
  [0,0,     0,1,     1,1]
  );

  // Right face (x = 1)
  drawTriangle3DUV(
  [1,0,0,   1,1,0,   1,1,-1],
  [0,0,     1,0,     1,1]
  );

  drawTriangle3DUV(
  [1,0,0,   1,1,-1,  1,0,-1],
  [0,0,     1,1,     0,1]
  );

  // Left face (x = 0)
  drawTriangle3DUV(
  [0,0,0,   0,0,-1,  0,1,-1],
  [0,0,     1,0,     1,1]
  );
  drawTriangle3DUV(
  [0,0,0,   0,1,-1,  0,1,0],
  [0,0,     1,1,     0,1]
  );

  }
} 