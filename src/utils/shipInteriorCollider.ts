import * as THREE from 'three';

/**
 * Ship Interior Physics Collider
 *
 * Bakes the real Spaceship.glb cabin triangles (walls, glass canopy, seats, consoles, floor)
 * into a uniform spatial grid in hull-local coordinates, and resolves a walking character
 * capsule against them with sphere-vs-triangle contact push-out. The character can never
 * pass through walls, seats, the canopy or the floor.
 */
export interface CapsuleResolveResult {
  grounded: boolean;
  hitCeiling: boolean;
}

export interface ShipInteriorCollider {
  triangleCount: number;
  /** Pushes the capsule (feet position, mutated in place) out of all cabin geometry. */
  resolveCapsule: (feet: THREE.Vector3, radius: number, height: number) => CapsuleResolveResult;
  /** Returns distance from `origin` straight down to the nearest floor triangle (or Infinity). */
  probeFloor: (origin: THREE.Vector3, maxDist: number) => number;
  /** Clamps desired camera position along segment from `pivot` so the camera never leaves cabin walls/roof. */
  clampCamera: (pivot: THREE.Vector3, desiredCam: THREE.Vector3, camRadius?: number) => THREE.Vector3;
}

export function buildShipInteriorCollider(
  meshes: Array<{ mesh: THREE.Mesh; matrix: THREE.Matrix4 }>,
  bounds: THREE.Box3,
  cellSize = 0.04
): ShipInteriorCollider {
  const tris: number[] = [];
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const triBox = new THREE.Box3();

  for (const { mesh, matrix } of meshes) {
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.attributes.position as THREE.BufferAttribute | undefined;
    if (!pos) continue;
    const idx = geo.index;
    const count = idx ? idx.count : pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const i0 = idx ? idx.getX(i) : i;
      const i1 = idx ? idx.getX(i + 1) : i + 1;
      const i2 = idx ? idx.getX(i + 2) : i + 2;
      vA.fromBufferAttribute(pos, i0).applyMatrix4(matrix);
      vB.fromBufferAttribute(pos, i1).applyMatrix4(matrix);
      vC.fromBufferAttribute(pos, i2).applyMatrix4(matrix);
      triBox.makeEmpty().expandByPoint(vA).expandByPoint(vB).expandByPoint(vC);
      if (!triBox.intersectsBox(bounds)) continue;
      tris.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
    }
  }

  const triData = new Float64Array(tris);
  const triCount = triData.length / 9;

  const minX = bounds.min.x;
  const minY = bounds.min.y;
  const minZ = bounds.min.z;
  const nx = Math.max(1, Math.ceil((bounds.max.x - minX) / cellSize));
  const ny = Math.max(1, Math.ceil((bounds.max.y - minY) / cellSize));
  const nz = Math.max(1, Math.ceil((bounds.max.z - minZ) / cellSize));
  const cells: Array<number[] | undefined> = new Array(nx * ny * nz);

  const cellIndex = (ix: number, iy: number, iz: number) => ix + nx * (iy + ny * iz);
  const clampI = (v: number, n: number) => (v < 0 ? 0 : v >= n ? n - 1 : v);

  for (let t = 0; t < triCount; t++) {
    const o = t * 9;
    const tminX = Math.min(triData[o], triData[o + 3], triData[o + 6]);
    const tminY = Math.min(triData[o + 1], triData[o + 4], triData[o + 7]);
    const tminZ = Math.min(triData[o + 2], triData[o + 5], triData[o + 8]);
    const tmaxX = Math.max(triData[o], triData[o + 3], triData[o + 6]);
    const tmaxY = Math.max(triData[o + 1], triData[o + 4], triData[o + 7]);
    const tmaxZ = Math.max(triData[o + 2], triData[o + 5], triData[o + 8]);
    const x0 = clampI(Math.floor((tminX - minX) / cellSize), nx);
    const y0 = clampI(Math.floor((tminY - minY) / cellSize), ny);
    const z0 = clampI(Math.floor((tminZ - minZ) / cellSize), nz);
    const x1 = clampI(Math.floor((tmaxX - minX) / cellSize), nx);
    const y1 = clampI(Math.floor((tmaxY - minY) / cellSize), ny);
    const z1 = clampI(Math.floor((tmaxZ - minZ) / cellSize), nz);
    for (let iz = z0; iz <= z1; iz++) {
      for (let iy = y0; iy <= y1; iy++) {
        for (let ix = x0; ix <= x1; ix++) {
          const ci = cellIndex(ix, iy, iz);
          const list = cells[ci];
          if (list) list.push(t);
          else cells[ci] = [t];
        }
      }
    }
  }

  // Query stamping (dedupe triangles shared across cells)
  const stamps = new Uint32Array(triCount);
  let stampId = 1;
  const candidates: number[] = [];

  const gatherCandidates = (
    qminX: number, qminY: number, qminZ: number,
    qmaxX: number, qmaxY: number, qmaxZ: number
  ) => {
    candidates.length = 0;
    stampId++;
    if (stampId > 0xfffffff0) {
      stamps.fill(0);
      stampId = 1;
    }
    if (
      qmaxX < minX || qmaxY < minY || qmaxZ < minZ ||
      qminX > bounds.max.x || qminY > bounds.max.y || qminZ > bounds.max.z
    ) {
      return;
    }
    const x0 = clampI(Math.floor((qminX - minX) / cellSize), nx);
    const y0 = clampI(Math.floor((qminY - minY) / cellSize), ny);
    const z0 = clampI(Math.floor((qminZ - minZ) / cellSize), nz);
    const x1 = clampI(Math.floor((qmaxX - minX) / cellSize), nx);
    const y1 = clampI(Math.floor((qmaxY - minY) / cellSize), ny);
    const z1 = clampI(Math.floor((qmaxZ - minZ) / cellSize), nz);
    for (let iz = z0; iz <= z1; iz++) {
      for (let iy = y0; iy <= y1; iy++) {
        for (let ix = x0; ix <= x1; ix++) {
          const list = cells[cellIndex(ix, iy, iz)];
          if (!list) continue;
          for (let k = 0; k < list.length; k++) {
            const t = list[k];
            if (stamps[t] !== stampId) {
              stamps[t] = stampId;
              candidates.push(t);
            }
          }
        }
      }
    }
  };

  // Closest point on triangle (Ericson, Real-Time Collision Detection 5.1.5)
  const cp = [0, 0, 0];
  const closestPointOnTri = (px: number, py: number, pz: number, o: number) => {
    const ax = triData[o], ay = triData[o + 1], az = triData[o + 2];
    const bx = triData[o + 3], by = triData[o + 4], bz = triData[o + 5];
    const cx = triData[o + 6], cy = triData[o + 7], cz = triData[o + 8];
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) { cp[0] = ax; cp[1] = ay; cp[2] = az; return; }
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { cp[0] = bx; cp[1] = by; cp[2] = bz; return; }
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      cp[0] = ax + abx * v; cp[1] = ay + aby * v; cp[2] = az + abz * v; return;
    }
    const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
    const d5 = abx * cpx + aby * cpy + abz * cpz;
    const d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) { cp[0] = cx; cp[1] = cy; cp[2] = cz; return; }
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6);
      cp[0] = ax + acx * w; cp[1] = ay + acy * w; cp[2] = az + acz * w; return;
    }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
      cp[0] = bx + (cx - bx) * w; cp[1] = by + (cy - by) * w; cp[2] = bz + (cz - bz) * w; return;
    }
    const denom = 1 / (va + vb + vc);
    const v = vb * denom;
    const w = vc * denom;
    cp[0] = ax + abx * v + acx * w;
    cp[1] = ay + aby * v + acy * w;
    cp[2] = az + abz * v + acz * w;
  };

  const resolveCapsule: ShipInteriorCollider['resolveCapsule'] = (feet, radius, height) => {
    let grounded = false;
    let hitCeiling = false;
    const sphereOffsets = [radius, height * 0.5, Math.max(radius, height - radius)];

    for (let iter = 0; iter < 3; iter++) {
      let anyPush = false;
      for (let s = 0; s < sphereOffsets.length; s++) {
        const sx = feet.x;
        const sy = feet.y + sphereOffsets[s];
        const sz = feet.z;
        gatherCandidates(sx - radius, sy - radius, sz - radius, sx + radius, sy + radius, sz + radius);
        let cx = sx, cy = sy, cz = sz;
        for (let k = 0; k < candidates.length; k++) {
          closestPointOnTri(cx, cy, cz, candidates[k] * 9);
          const dx = cx - cp[0];
          const dy = cy - cp[1];
          const dz = cz - cp[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= radius * radius) continue;
          const d = Math.sqrt(d2);
          let nxv: number, nyv: number, nzv: number;
          if (d > 1e-7) {
            nxv = dx / d; nyv = dy / d; nzv = dz / d;
          } else {
            nxv = 0; nyv = 1; nzv = 0;
          }
          // Lower body never gets pushed downward through the floor; upper body never pushed up through ceiling
          const pen = radius - d;
          cx += nxv * pen;
          cy += nyv * pen;
          cz += nzv * pen;
          anyPush = true;
          if (s === 0 && nyv > 0.55) grounded = true;
          if (s === sphereOffsets.length - 1 && nyv < -0.55) hitCeiling = true;
        }
        feet.x += cx - sx;
        feet.y += cy - sy;
        feet.z += cz - sz;
      }
      if (!anyPush) break;
    }
    return { grounded, hitCeiling };
  };

  const probeFloor: ShipInteriorCollider['probeFloor'] = (origin, maxDist) => {
    gatherCandidates(
      origin.x - 0.002, origin.y - maxDist, origin.z - 0.002,
      origin.x + 0.002, origin.y, origin.z + 0.002
    );
    let best = Infinity;
    for (let k = 0; k < candidates.length; k++) {
      const o = candidates[k] * 9;
      // Vertical ray vs triangle (2D barycentric in XZ)
      const ax = triData[o], ay = triData[o + 1], az = triData[o + 2];
      const bx = triData[o + 3], by = triData[o + 4], bz = triData[o + 5];
      const cx = triData[o + 6], cy = triData[o + 7], cz = triData[o + 8];
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-12) continue;
      const l1 = ((bz - cz) * (origin.x - cx) + (cx - bx) * (origin.z - cz)) / det;
      const l2 = ((cz - az) * (origin.x - cx) + (ax - cx) * (origin.z - cz)) / det;
      const l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      const hy = l1 * ay + l2 * by + l3 * cy;
      const dist = origin.y - hy;
      if (dist >= -1e-5 && dist < best && dist <= maxDist) best = dist;
    }
    return best;
  };

  const sphereCollides = (px: number, py: number, pz: number, rSq: number): boolean => {
    for (let k = 0; k < candidates.length; k++) {
      closestPointOnTri(px, py, pz, candidates[k] * 9);
      const dx = px - cp[0];
      const dy = py - cp[1];
      const dz = pz - cp[2];
      if (dx * dx + dy * dy + dz * dz < rSq) return true;
    }
    return false;
  };

  const clampCamera: ShipInteriorCollider['clampCamera'] = (
    pivot,
    desiredCam,
    camRadius = 0.016
  ) => {
    const out = desiredCam.clone();
    const minXSeg = Math.min(pivot.x, desiredCam.x) - camRadius;
    const minYSeg = Math.min(pivot.y, desiredCam.y) - camRadius;
    const minZSeg = Math.min(pivot.z, desiredCam.z) - camRadius;
    const maxXSeg = Math.max(pivot.x, desiredCam.x) + camRadius;
    const maxYSeg = Math.max(pivot.y, desiredCam.y) + camRadius;
    const maxZSeg = Math.max(pivot.z, desiredCam.z) + camRadius;
    gatherCandidates(minXSeg, minYSeg, minZSeg, maxXSeg, maxYSeg, maxZSeg);
    if (candidates.length === 0) return out;

    const dx = desiredCam.x - pivot.x;
    const dy = desiredCam.y - pivot.y;
    const dz = desiredCam.z - pivot.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-6) return out;

    const rSq = camRadius * camRadius;
    const steps = Math.min(28, Math.max(4, Math.ceil(dist / (camRadius * 0.55))));
    let safeT = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sx = pivot.x + dx * t;
      const sy = pivot.y + dy * t;
      const sz = pivot.z + dz * t;
      if (sphereCollides(sx, sy, sz, rSq)) {
        // Binary refine between previous safeT and colliding t
        let lo = safeT;
        let hi = t;
        for (let b = 0; b < 5; b++) {
          const mid = (lo + hi) * 0.5;
          if (sphereCollides(pivot.x + dx * mid, pivot.y + dy * mid, pivot.z + dz * mid, rSq)) {
            hi = mid;
          } else {
            lo = mid;
          }
        }
        out.set(pivot.x + dx * lo, pivot.y + dy * lo, pivot.z + dz * lo);
        break;
      }
      safeT = t;
    }

    // Final light push-out in case desired/clamped point grazes a surface
    for (let k = 0; k < candidates.length; k++) {
      closestPointOnTri(out.x, out.y, out.z, candidates[k] * 9);
      const pdx = out.x - cp[0];
      const pdy = out.y - cp[1];
      const pdz = out.z - cp[2];
      const d2 = pdx * pdx + pdy * pdy + pdz * pdz;
      if (d2 < rSq && d2 > 1e-12) {
        const d = Math.sqrt(d2);
        const pen = camRadius - d;
        out.x += (pdx / d) * pen;
        out.y += (pdy / d) * pen;
        out.z += (pdz / d) * pen;
      }
    }
    return out;
  };

  return { triangleCount: triCount, resolveCapsule, probeFloor, clampCamera };
}
