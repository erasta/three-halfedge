import * as THREE from 'three';
import { Face } from './libs/ConvexHull.js'; // TODO after r145 import from three instead
import { Octree } from './Octree.js';

/**
 * Doubly Connected Edge List - DCEL
 * For each face in the geometry, contains its half-edges.
 * A half-edge has two vertices and its twin half-edge on the adjacent face.
 */

export class Dcel {
    constructor(geometry, options) {
        const num = geometry.attributes.position.count;
        this.vertices = Array.from({ length: num }, (_, i) => {
            return {
                point: new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i),
                index: i
            };
        });


        const threshold = !options ? 1e-4 : options.mergeVerticesThreshold;
        if (threshold) {
            const sphere = new THREE.Sphere(undefined, threshold);
            const octree = new Octree(this.vertices.map(v => {
                v.point.index = v.index;
                return v.point;
            }));
            this.vertices.forEach(v => {
                // v.origIndex = v.index;
                sphere.center  = v.point;
                const found = octree.search(sphere);
                if (found.length >= 2) {
                    v.index = Math.min(...found.map(p => p.index));
                }
            });
            // const hashToVertex = {}
            // this.vertices.forEach(v => {
            //     v.origIndex = v.index;
            //     const hash = `${~~(v.point.x / threshold)},${~~(v.point.y / threshold)},${~~(v.point.z / threshold)}`;
            //     if (hash in hashToVertex) {
            //         v.index = hashToVertex[hash];
            //     } else {
            //         hashToVertex[hash] = v.index;
            //     }
            // });
        }

        const faceIndices = new THREE.Vector3();
        this.faces = Array.from({ length: geometry.index.count / 3 }, (_, i) => {
            faceIndices.fromArray(geometry.index.array, i * 3);
            const face = Face.create(this.vertices[faceIndices.x], this.vertices[faceIndices.y], this.vertices[faceIndices.z]);
            face.index = i;
            return face;
        });

        const hashToEdge = new Map();
        this.faces.forEach(face => {
            this.forEdges(face, e => {
                if (!e.twin) {
                    const hashInv = e.tail().index * num + e.head().index;
                    const other = hashToEdge.get(hashInv);
                    if (other) {
                        e.setTwin(other);
                    } else {
                        const hash = e.head().index * num + e.tail().index;
                        hashToEdge.set(hash, e);
                    }
                }
            });
        });

    }

    forEdges(face, callback) {
        const start = face.edge;
        let e = start;
        while (true) {
            callback(e, face, this);
            e = e.next;
            if (e === start) {
                break;
            }
        }
    }

    forAdjacentFaces(faceIndex, callback) {
        this.forEdges(this.faces[faceIndex], e => {
            callback(e.twin.face.index);
        });
    }
}

