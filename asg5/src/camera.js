// camera.js
// First-person camera with WASD/QE support + mouse look (yaw + pitch)

class Camera {
  constructor(canvas) {
    this.fov = 60;

    // Start roughly near center of 32x32 world, at "eye height"
    this.eye = new Vector3([16, 1.8, 16]);
    this.at  = new Vector3([16, 1.8, 15]); // looking toward -z
    this.up  = new Vector3([0, 1, 0]);

    this.viewMatrix = new Matrix4();
    this.projectionMatrix = new Matrix4();
    this.projectionMatrix.setPerspective(
      this.fov,
      canvas.width / canvas.height,
      0.1,
      1000
    );

    this.updateView();
  }

  updateView() {
    this.viewMatrix.setLookAt(
      this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
      this.at.elements[0],  this.at.elements[1],  this.at.elements[2],
      this.up.elements[0],  this.up.elements[1],  this.up.elements[2]
    );
  }

  forwardDir() {
    const f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.normalize();
    return f;
  }

  moveForward(speed = 0.25) {
    const f = this.forwardDir();
    f.mul(speed);
    this.eye.add(f);
    this.at.add(f);
    this.updateView();
  }

  moveBackwards(speed = 0.25) {
    const f = this.forwardDir();
    f.mul(speed);
    this.eye.sub(f);
    this.at.sub(f);
    this.updateView();
  }

  moveLeft(speed = 0.25) {
    const f = this.forwardDir();
    let s = Vector3.cross(this.up, f); // up x forward
    s.normalize();
    s.mul(speed);
    this.eye.add(s);
    this.at.add(s);
    this.updateView();
  }

  moveRight(speed = 0.25) {
    const f = this.forwardDir();
    let s = Vector3.cross(f, this.up); // forward x up
    s.normalize();
    s.mul(speed);
    this.eye.add(s);
    this.at.add(s);
    this.updateView();
  }

  panLeft(alpha = 3) {
    this.pan(alpha);
  }

  panRight(alpha = 3) {
    this.pan(-alpha);
  }

  pan(alphaDeg) {
    const f = this.forwardDir();
    const rot = new Matrix4();
    rot.setRotate(alphaDeg, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
    const f2 = rot.multiplyVector3(f);

    this.at.set(this.eye);
    this.at.add(f2);
    this.updateView();
  }

  // Mouse look: yaw around world-up + pitch around camera-right
  look(dx, dy, yawSens = 0.15, pitchSens = 0.15) {
    // yaw
    const yaw = new Matrix4().setRotate(-dx * yawSens, 0, 1, 0);

    // right axis = forward x up
    const f = this.forwardDir();
    let right = Vector3.cross(f, this.up);
    right.normalize();

    // pitch
    const pitch = new Matrix4().setRotate(-dy * pitchSens, right.elements[0], right.elements[1], right.elements[2]);

    // rotate forward
    let f2 = yaw.multiplyVector3(f);
    f2 = pitch.multiplyVector3(f2);

    // clamp pitch to avoid flipping
    if (f2.elements[1] > 0.95) f2.elements[1] = 0.95;
    if (f2.elements[1] < -0.95) f2.elements[1] = -0.95;
    f2.normalize();

    this.at.set(this.eye);
    this.at.add(f2);
    this.updateView();
  }
}
