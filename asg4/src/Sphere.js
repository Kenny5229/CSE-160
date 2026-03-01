// Sphere.js
// Buffered sphere with positions + normals + UVs (triangles). Normals = normalized position (unit sphere).

let g_sphereCache = {}; // key -> {posBuf, uvBuf, norBuf, count}

function initSphereBuffers(gl, a_Position, a_UV, a_Normal) {
  // optional: prebuild a default sphere so first draw is smooth
  getSphereBuffers(gl, 24, 24);
}

function getSphereBuffers(gl, latBands, longBands) {
  const key = `${latBands}_${longBands}`;
  if (g_sphereCache[key]) return g_sphereCache[key];

  const positions = [];
  const normals = [];
  const uvs = [];

  // build as triangle list (no indices) for simplicity
  for (let lat = 0; lat < latBands; lat++) {
    const theta0 = (lat / latBands) * Math.PI;
    const theta1 = ((lat + 1) / latBands) * Math.PI;

    for (let lon = 0; lon < longBands; lon++) {
      const phi0 = (lon / longBands) * 2 * Math.PI;
      const phi1 = ((lon + 1) / longBands) * 2 * Math.PI;

      // 4 points on the quad
      const p00 = sph(theta0, phi0);
      const p10 = sph(theta1, phi0);
      const p11 = sph(theta1, phi1);
      const p01 = sph(theta0, phi1);

      const uv00 = [lon / longBands, 1 - lat / latBands];
      const uv10 = [lon / longBands, 1 - (lat + 1) / latBands];
      const uv11 = [(lon + 1) / longBands, 1 - (lat + 1) / latBands];
      const uv01 = [(lon + 1) / longBands, 1 - lat / latBands];

      // two triangles: (p00,p10,p11) and (p00,p11,p01)
      pushVert(p00, uv00);
      pushVert(p10, uv10);
      pushVert(p11, uv11);

      pushVert(p00, uv00);
      pushVert(p11, uv11);
      pushVert(p01, uv01);
    }
  }

  function sph(theta, phi) {
    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.cos(theta);
    const z = Math.sin(theta) * Math.sin(phi);
    return [x, y, z];
  }

  function pushVert(p, uv) {
    positions.push(p[0], p[1], p[2]);
    // unit sphere => normal = position
    normals.push(p[0], p[1], p[2]);
    uvs.push(uv[0], uv[1]);
  }

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const uvBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

  const norBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, norBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  const entry = { posBuf, uvBuf, norBuf, count: positions.length / 3 };
  g_sphereCache[key] = entry;
  return entry;
}

class Sphere {
  constructor(latBands = 24, longBands = 24) {
    this.latBands = latBands;
    this.longBands = longBands;

    this.matrix = new Matrix4();
    this.baseColor = [1, 1, 1, 1];
    this.texWeight = 0.0;
    this.whichTexture = 0;
  }

  render(gl, uniforms, attrs) {
    const {
      u_ModelMatrix,
      u_NormalMatrix,
      u_BaseColor,
      u_texColorWeight,
      u_whichTexture
    } = uniforms;
    const { a_Position, a_UV, a_Normal } = attrs;

    const buf = getSphereBuffers(gl, this.latBands, this.longBands);

    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    const normalMat = new Matrix4();
    normalMat.set(this.matrix);
    normalMat.invert();
    normalMat.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMat.elements);

    gl.uniform4f(u_BaseColor, this.baseColor[0], this.baseColor[1], this.baseColor[2], this.baseColor[3]);
    gl.uniform1f(u_texColorWeight, this.texWeight);
    gl.uniform1i(u_whichTexture, this.whichTexture);

    // positions
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.posBuf);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    // uvs
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.uvBuf);
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_UV);

    // normals
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.norBuf);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    gl.drawArrays(gl.TRIANGLES, 0, buf.count);
  }
}
