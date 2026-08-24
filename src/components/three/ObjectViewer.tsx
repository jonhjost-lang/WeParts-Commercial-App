import { useEffect, useRef, useState } from 'react';

interface ObjectViewerProps {
  data: Uint8Array;
  fileName: string;
}

type LoadedModel = import('three').Object3D;
type ViewerActions = { reset: () => void; zoomIn: () => void; zoomOut: () => void };

interface GlbBufferView {
  byteOffset?: number;
  byteLength: number;
}

interface GlbImage {
  bufferView?: number;
  mimeType?: string;
}

interface GlbTextureDefinition {
  source?: number;
  sampler?: number;
}

interface GlbTextureReference {
  index: number;
  texCoord?: number;
}

interface GlbMaterialDefinition {
  name?: string;
  pbrMetallicRoughness?: {
    baseColorTexture?: GlbTextureReference;
    metallicRoughnessTexture?: GlbTextureReference;
  };
  normalTexture?: GlbTextureReference;
  occlusionTexture?: GlbTextureReference;
  emissiveTexture?: GlbTextureReference;
}

interface GlbDocument {
  bufferViews?: GlbBufferView[];
  images?: GlbImage[];
  textures?: GlbTextureDefinition[];
  samplers?: Array<{ magFilter?: number; minFilter?: number; wrapS?: number; wrapT?: number }>;
  materials?: GlbMaterialDefinition[];
}

function extensionOf(fileName: string) {
  return fileName.toLowerCase().split('.').pop() || '';
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

function readGlb(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) return null;

  let document: GlbDocument | null = null;
  let binary: Uint8Array | null = null;
  let offset = 12;
  while (offset + 8 <= data.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) {
      document = JSON.parse(new TextDecoder().decode(chunk).trimEnd()) as GlbDocument;
    } else if (type === 0x004e4942) {
      binary = chunk;
    }
    offset += 8 + length;
  }
  return document && binary ? { document, binary } : null;
}

export default function ObjectViewer({ data, fileName }: ObjectViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<ViewerActions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current as HTMLDivElement;
    if (!container) return;

    let disposed = false;
    let cleanup = () => undefined;
    let recoveredTextures: import('three').Texture[] = [];

    async function initialize() {
      try {
        setError(null);
        setReady(false);
        const THREE = await import('three');
        const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
        const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

        if (disposed) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xe7e8e9);

        const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 10000);
        camera.position.set(3, 2, 4);

        const renderer = new THREE.WebGLRenderer({
          antialias: window.devicePixelRatio <= 1.5,
          alpha: false,
          powerPreference: 'low-power',
          precision: 'mediump',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.toneMappingExposure = 0.9;
        container.replaceChildren(renderer.domElement);

        const environmentGenerator = new THREE.PMREMGenerator(renderer);
        const environmentTarget = environmentGenerator.fromScene(new RoomEnvironment(), 0.02);
        scene.environment = environmentTarget.texture;
        scene.environmentIntensity = 0.65;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = false;

        scene.add(new THREE.HemisphereLight(0xffffff, 0x5c6268, 0.85));
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
        keyLight.position.set(4, 6, 5);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0xce1141, 0.45);
        rimLight.position.set(-5, 2, -4);
        scene.add(rimLight);

        let model: LoadedModel;
        const extension = extensionOf(fileName);
        const arrayBuffer = toArrayBuffer(data);

        if (extension === 'glb' || extension === 'gltf') {
          const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
          const source = extension === 'gltf' ? new TextDecoder().decode(data) : arrayBuffer;
          const gltf = await new GLTFLoader().parseAsync(source, '');
          model = gltf.scene;

          if (extension === 'glb') {
            const parsed = readGlb(data);
            if (parsed?.document.images?.length) {
              const textureDefinitions = parsed.document.textures || [];
              const samplers = parsed.document.samplers || [];
              const textures = await Promise.all(parsed.document.images.map(async (image) => {
                if (image.bufferView === undefined || !image.mimeType) return null;
                const bufferView = parsed.document.bufferViews?.[image.bufferView];
                if (!bufferView) return null;
                const start = bufferView.byteOffset || 0;
                const bytes = parsed.binary.subarray(start, start + bufferView.byteLength);
                const bitmap = await createImageBitmap(new Blob([toArrayBuffer(bytes)], { type: image.mimeType }));
                const texture = new THREE.Texture(bitmap);
                texture.flipY = false;
                texture.needsUpdate = true;
                return texture;
              }));

              const filterMap = new Map<number, import('three').TextureFilter>([
                [9728, THREE.NearestFilter], [9729, THREE.LinearFilter],
                [9984, THREE.NearestMipmapNearestFilter], [9985, THREE.LinearMipmapNearestFilter],
                [9986, THREE.NearestMipmapLinearFilter], [9987, THREE.LinearMipmapLinearFilter],
              ]);
              const wrapMap = new Map<number, import('three').Wrapping>([
                [33071, THREE.ClampToEdgeWrapping], [33648, THREE.MirroredRepeatWrapping], [10497, THREE.RepeatWrapping],
              ]);

              textureDefinitions.forEach((definition, textureIndex) => {
                const texture = definition.source === undefined ? null : textures[definition.source];
                if (!texture) return;
                const sampler = definition.sampler === undefined ? undefined : samplers[definition.sampler];
                if (sampler?.magFilter === 9728) texture.magFilter = THREE.NearestFilter;
                if (sampler?.magFilter === 9729) texture.magFilter = THREE.LinearFilter;
                if (sampler?.minFilter) texture.minFilter = filterMap.get(sampler.minFilter) || texture.minFilter;
                if (sampler?.wrapS) texture.wrapS = wrapMap.get(sampler.wrapS) || texture.wrapS;
                if (sampler?.wrapT) texture.wrapT = wrapMap.get(sampler.wrapT) || texture.wrapT;
                texture.name = `embedded-texture-${textureIndex}`;
              });

              const textureFor = (reference?: GlbTextureReference) => {
                if (!reference) return null;
                const definition = textureDefinitions[reference.index];
                const texture = definition?.source === undefined ? null : textures[definition.source];
                if (texture) texture.channel = reference.texCoord || 0;
                return texture;
              };
              const materialDefinitions = parsed.document.materials || [];
              model.traverse((object) => {
                if (!(object instanceof THREE.Mesh)) return;
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach((material) => {
                  const definition = materialDefinitions.find((item) => item.name === material.name)
                    || (materialDefinitions.length === 1 ? materialDefinitions[0] : undefined);
                  if (!definition) return;
                  const target = material as import('three').MeshStandardMaterial;
                  const colorMap = textureFor(definition.pbrMetallicRoughness?.baseColorTexture);
                  const ormMap = textureFor(definition.pbrMetallicRoughness?.metallicRoughnessTexture);
                  const normalMap = textureFor(definition.normalTexture);
                  const emissiveMap = textureFor(definition.emissiveTexture);
                  const occlusionMap = textureFor(definition.occlusionTexture);
                  if (colorMap) {
                    colorMap.colorSpace = THREE.SRGBColorSpace;
                    target.map = colorMap;
                  }
                  if (ormMap) {
                    target.metalnessMap = ormMap;
                    target.roughnessMap = ormMap;
                  }
                  if (normalMap) target.normalMap = normalMap;
                  if (emissiveMap) {
                    emissiveMap.colorSpace = THREE.SRGBColorSpace;
                    target.emissiveMap = emissiveMap;
                  }
                  if (occlusionMap) target.aoMap = occlusionMap;
                  target.needsUpdate = true;
                });
              });
              recoveredTextures = textures.filter((texture): texture is import('three').Texture => Boolean(texture));
            }
          }
        } else if (extension === 'obj') {
          const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
          model = new OBJLoader().parse(new TextDecoder().decode(data));
          const palette = [0xce1141, 0x527a8a, 0x3c4044, 0x8d0929];
          let meshIndex = 0;
          model.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.material = new THREE.MeshStandardMaterial({
                color: palette[meshIndex % palette.length],
                metalness: 0.22,
                roughness: 0.5,
              });
              meshIndex += 1;
            }
          });
        } else if (extension === 'stl') {
          const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
          const geometry = new STLLoader().parse(arrayBuffer);
          geometry.computeVertexNormals();
          model = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color: 0xce1141, metalness: 0.28, roughness: 0.46 }),
          );
        } else if (extension === 'fbx') {
          const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
          model = new FBXLoader().parse(arrayBuffer, '');
        } else {
          throw new Error(`Unsupported 3D format: .${extension || 'unknown'}`);
        }

        if (disposed) return;
        scene.add(model);

        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        model.position.sub(center);

        const maxDimension = Math.max(size.x, size.y, size.z) || 1;
        const distance = maxDimension / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        camera.position.set(distance * 0.9, distance * 0.55, distance * 1.15);
        camera.near = Math.max(maxDimension / 1000, 0.001);
        camera.far = Math.max(maxDimension * 100, 100);
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.update();
        const homePosition = camera.position.clone();
        const homeTarget = controls.target.clone();

        const grid = new THREE.GridHelper(maxDimension * 3, 20, 0xb6b8ba, 0xd8d9da);
        grid.position.y = -size.y / 2;
        scene.add(grid);

        let pendingFrame = 0;
        const renderOnDemand = () => {
          if (disposed || pendingFrame) return;
          pendingFrame = window.requestAnimationFrame(() => {
            pendingFrame = 0;
            renderer.render(scene, camera);
          });
        };

        const resize = () => {
          const width = Math.max(container.clientWidth, 1);
          const height = Math.max(container.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderOnDemand();
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
        controls.addEventListener('change', renderOnDemand);
        actionsRef.current = {
          reset: () => {
            camera.position.copy(homePosition);
            controls.target.copy(homeTarget);
            controls.update();
            renderOnDemand();
          },
          zoomIn: () => {
            const offset = camera.position.clone().sub(controls.target);
            offset.setLength(Math.max(controls.minDistance, offset.length() / 1.22));
            camera.position.copy(controls.target).add(offset);
            controls.update(); renderOnDemand();
          },
          zoomOut: () => {
            const offset = camera.position.clone().sub(controls.target);
            offset.setLength(Math.min(controls.maxDistance, offset.length() * 1.22));
            camera.position.copy(controls.target).add(offset);
            controls.update(); renderOnDemand();
          },
        };
        setReady(true);
        const renderWhenVisible = () => {
          if (document.visibilityState === 'visible') renderOnDemand();
        };
        document.addEventListener('visibilitychange', renderWhenVisible);
        resize();

        cleanup = () => {
          actionsRef.current = null;
          resizeObserver.disconnect();
          controls.removeEventListener('change', renderOnDemand);
          document.removeEventListener('visibilitychange', renderWhenVisible);
          if (pendingFrame) window.cancelAnimationFrame(pendingFrame);
          controls.dispose();
          environmentGenerator.dispose();
          environmentTarget.dispose();
          scene.environment = null;
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry?.dispose();
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material) => material?.dispose());
            }
          });
          recoveredTextures.forEach((texture) => {
            const image = texture.image as ImageBitmap | undefined;
            image?.close?.();
            texture.dispose();
          });
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
      } catch (viewerError) {
        if (!disposed) {
          setError(viewerError instanceof Error ? viewerError.message : 'Unable to render this 3D model.');
        }
      }
    }

    void initialize();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [data, fileName]);

  return (
    <div className="object-viewer" ref={viewerRef}>
      <div className="viewer-canvas" ref={containerRef} />
      {ready && !error ? <div className="viewer-toolbar" role="toolbar" aria-label="3D viewer controls">
        <button onClick={() => actionsRef.current?.reset()} title="Reset view" aria-label="Reset 3D view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V4h4M5 5a9 9 0 1 1-1 9"/></svg><span>Reset view</span></button>
        <span className="viewer-toolbar-divider" />
        <button onClick={() => actionsRef.current?.zoomOut()} title="Zoom out" aria-label="Zoom out"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="M7 10h6m2 5 5 5"/></svg></button>
        <button onClick={() => actionsRef.current?.zoomIn()} title="Zoom in" aria-label="Zoom in"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="M7 10h6m-3-3v6m5 2 5 5"/></svg></button>
        <button onClick={() => { const viewer = viewerRef.current; if (!viewer) return; if (document.fullscreenElement) void document.exitFullscreen(); else void viewer.requestFullscreen(); }} title="Full screen" aria-label="Open 3D viewer in full screen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/></svg></button>
      </div> : null}
      {error ? (
        <div className="viewer-error" role="alert">
          <b>Model could not be displayed</b>
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
