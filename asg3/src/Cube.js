// Cube.js
// Buffered cube with UVs (36 verts). Much faster than drawing triangles per face.

let g_cubePosBuf = null;
let g_cubeUVBuf = null;
let g_cubeVertexCount = 36;

function initCubeBuffers(gl, a_Position, a_UV) {
  // 36 vertices (12 triangles). Cube spans x:[0,1], y:[0,1], z:[0,-1]
  const V = new Float32Array([
    // Front (z=0)
    0,0,0,  1,1,0,  1,0,0,
    0,0,0,  0,1,0,  1,1,0,

    // Back (z=-1)
    0,0,-1, 1,0,-1, 1,1,-1,
    0,0,-1, 1,1,-1, 0,1,-1,

    // Top (y=1)
    0,1,0,  1,1,0,  1,1,-1,
    0,1,0,  1,1,-1, 0,1,-1,

    // Bottom (y=0)
    0,0,0,  1,0,-1, 1,0,0,
    0,0,0,  0,0,-1, 1,0,-1,

    // Right (x=1)
    1,0,0,  1,1,0,  1,1,-1,
    1,0,0,  1,1,-1, 1,0,-1,

    // Left (x=0)
    0,0,0,  0,0,-1, 0,1,-1,
    0,0,0,  0,1,-1, 0,1,0,
  ]);

  // UVs: simple 0..1 each face
  const U = new Float32Array([
    // Front
    0,0, 1,1, 1,0,
    0,0, 0,1, 1,1,

    // Back
    0,0, 1,0, 1,1,
    0,0, 1,1, 0,1,

    // Top
    0,0, 1,0, 1,1,
    0,0, 1,1, 0,1,

    // Bottom
    0,0, 1,1, 1,0,
    0,0, 0,1, 1,1,

    // Right
    0,0, 1,0, 1,1,
    0,0, 1,1, 0,1,

    // Left
    0,0, 1,1, 1,0,
    0,0, 0,1, 1,1,
  ]);

  g_cubePosBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubePosBuf);
  gl.bufferData(gl.ARRAY_BUFFER, V, gl.STATIC_DRAW);

  g_cubeUVBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeUVBuf);
  gl.bufferData(gl.ARRAY_BUFFER, U, gl.STATIC_DRAW);
}

class Cube {
  constructor() {
    this.matrix = new Matrix4();

    // default: textured white
    this.baseColor = [1, 1, 1, 1];
    this.texWeight = 1.0;     // 0 => base only, 1 => texture only
    this.whichTexture = 0;    // 0..3
  }

  render(gl, uniforms, attrs) {
    const {
      u_ModelMatrix,
      u_BaseColor,
      u_texColorWeight,
      u_whichTexture
    } = uniforms;

    const { a_Position, a_UV } = attrs;

    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
    gl.uniform4f(u_BaseColor, this.baseColor[0], this.baseColor[1], this.baseColor[2], this.baseColor[3]);
    gl.uniform1f(u_texColorWeight, this.texWeight);
    gl.uniform1i(u_whichTexture, this.whichTexture);

    // Positions
    gl.bindBuffer(gl.ARRAY_BUFFER, g_cubePosBuf);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    // UVs
    gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeUVBuf);
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_UV);

    gl.drawArrays(gl.TRIANGLES, 0, g_cubeVertexCount);
  }
}
