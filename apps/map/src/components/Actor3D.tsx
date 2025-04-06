import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useGLTF, Ring, Circle } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
// Import Geodetic directly from three-geospatial
import { Geodetic, radians } from '@takram/three-geospatial';
// import { simulationStateAtom, simulationService } from '../services/SimulationService';
import { ActorAnimationState3D } from './SimulationManager';
import * as THREE from 'three';
// import { useAtomValue } from 'jotai';

interface Actor3DProps {
  actor: ActorAnimationState3D;
  isPlaying: boolean;
  isPaused: boolean;
  onDelete?: (actorId: string) => void;
}

// Default height if raycast fails
const DEFAULT_HEIGHT = 100; // meters

// Height offset to position actors above the surface
const HEIGHT_OFFSET = 100; // meters above detected surface

// Default scale if actor.scale is not provided
const DEFAULT_SCALE = 10; 

// Constants for the ring
const RING_SIZE = 900; // Base radius in meters
const RING_THICKNESS = 400; // Thickness in meters
const RING_COLOR = '#FFFFFF'; // white color for ring  
const OUTER_RING_COLOR = '#000000'; // black color for outer ring

// Define actor models mapping
const ACTOR_MODELS = {
    'truck': 'truck.glb',
    'car': 'car-passenger.glb',
    'sports car': 'car-sports.glb',
    'police car': 'car-police.glb',
    'taxi': 'car-taxi.glb',
    'bus': 'bus-passenger.glb',
    'plane': 'plane-passenger.glb',
    'ship': 'ship-cargo.glb',
    'fishing boat': 'boat-fishing.glb',
    'sailboat': 'boat-sail.glb',
    'yacht': 'ship-yacht.glb',
    'pirate ship': 'ship-pirate-flags.glb',
    'train': 'train-passenger.glb',
    'freight train': 'train-freight-big.glb',
    'high speed train': 'train-speed.glb',
    'submarine': 'submarine.glb',
    'jeep': 'jeep-open.glb'
  }


const Actor3D: React.FC<Actor3DProps> = ({ actor, isPlaying, isPaused, onDelete }) => {
  // Create refs for the model and meshes
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const debugCubeRef = useRef<THREE.Mesh>(null);
  const innerCubeRef = useRef<THREE.Mesh>(null);
  const outerDebugCubeRef = useRef<THREE.Mesh>(null); // Add ref for outer cube
  const raycaster = useRef(new THREE.Raycaster());
  const tilesRef = useRef<THREE.Group | null>(null);
  const [detectedHeight, setDetectedHeight] = useState<number | null>(null);
  
  // Add refs for smooth movement using lerp
  const targetPositionRef = useRef(new THREE.Vector3());
  const currentPositionRef = useRef(new THREE.Vector3());
  const targetQuaternionRef = useRef(new THREE.Quaternion());
  const currentQuaternionRef = useRef(new THREE.Quaternion());

  const DEBUG_MODE = true;
  
  // Access the scene to find the tiles group
  const { scene } = useThree();
  
  // Use useMemo to prevent reloading the same model unnecessarily if props change rapidly
  const modelPath = useMemo(() => {
      // Basic validation for modelFile
      const modelFile = actor.modelFile && actor.modelFile.endsWith('.glb') 
                       ? actor.modelFile 
                       : 'truck.glb'; // Fallback model
      return `https://static.mused.org/3dassets/${modelFile}`;
  }, [actor.modelFile]);

  // Load the GLB model based on the derived path
  const { scene: modelScene } = useGLTF(modelPath);
  
  // Find the tiles group in the scene for raycasting
  useEffect(() => {
    if (!tilesRef.current) {
      scene.traverse((object) => {
        // Make the search string more robust
        if (object.name && object.name.toLowerCase().includes('tilesrenderer')) { 
          console.log('Actor3D: Found tiles group:', object.name);
          tilesRef.current = object as THREE.Group;
        }
      });
       if (!tilesRef.current) {
         console.warn('Actor3D: TilesRenderer group not found in the scene. Raycasting will fail.');
       }
    }
  }, [scene]);

  // Function to center a model on its geometric center
  const centerModel = (model: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(model);

    // Check if the box is valid (not empty and does not contain Infinity)
    // FIX: Replace box.isFinite() with manual checks
    const isBoxFinite = 
        box.min.x !== -Infinity && box.min.y !== -Infinity && box.min.z !== -Infinity &&
        box.max.x !== Infinity && box.max.y !== Infinity && box.max.z !== Infinity;

    if (!box.isEmpty() && isBoxFinite) { // Use the manual check here
        const center = box.getCenter(new THREE.Vector3());
        const centeredGroup = new THREE.Group();
        const modelClone = model.clone();
        centeredGroup.add(modelClone);
        // Move the cloned model so its calculated center is at the origin of the new group
        modelClone.position.sub(center); 
        return centeredGroup;
    } else {
        // Log more details if the box is invalid
        console.warn("Actor3D: Could not compute valid bounding box for centering model.", { 
            isEmpty: box.isEmpty(), 
            min: box.min, 
            max: box.max 
        });
        // Return a clone without centering if box is invalid
        return model.clone(); 
    }
  };
  
  // Apply model, scale, orientation, and material changes
  useEffect(() => {
    if (modelRef.current && modelScene) {
      // Clear previous model
      while (modelRef.current.children.length > 0) {
        modelRef.current.remove(modelRef.current.children[0]);
      }

      // Clone and center the loaded model
      const centeredModel = centerModel(modelScene);
      modelRef.current.add(centeredModel);

      // Reset orientation before applying scale and specific rotations
      centeredModel.rotation.set(0, 0, 0);
      
      // FIX: Apply scale based on actor.scale or default
      const scaleValue = actor.scale ?? DEFAULT_SCALE;
      // Add validation for scale
      if (isNaN(scaleValue) || !isFinite(scaleValue) || scaleValue <= 0) {
          console.error(`[Actor3D ${actor.id}] Invalid scale value received:`, actor.scale, "Using default:", DEFAULT_SCALE);
          const scale = DEFAULT_SCALE;
          centeredModel.scale.set(scale, scale, scale);
      } else {
          const scale = scaleValue;
          // console.log(`[Actor3D ${actor.id}] Applying scale:`, scale); // Optional log
          centeredModel.scale.set(scale, scale, scale);
      }

      // Apply type-specific orientation adjustments
      // const actorTypeLower = actor.type?.toLowerCase() || '';
      // if (actorTypeLower.includes('plane')) {
      // } else if (actorTypeLower.includes('train')) {
      // } else if (actorTypeLower.includes('ship') || actorTypeLower.includes('boat') || actorTypeLower.includes('submarine')) {
      // } else {
      // }

      // Make materials unlit (MeshBasicMaterial)
      centeredModel.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material) {
           const applyBasicMaterial = (mat: THREE.Material | undefined): THREE.MeshBasicMaterial => {
              const basicMat = new THREE.MeshBasicMaterial();
              if (mat) {
                 // Copy common properties if they exist
                 if ('color' in mat && mat.color instanceof THREE.Color) basicMat.color.copy(mat.color);
                 if ('map' in mat && mat.map instanceof THREE.Texture) basicMat.map = mat.map;
                 basicMat.transparent = mat.transparent ?? false;
                 basicMat.opacity = mat.opacity ?? 1.0;
                 basicMat.wireframe = mat.wireframe ?? false;
                 basicMat.side = mat.side ?? THREE.FrontSide;
                 // Dispose old material if possible
                 // if (typeof mat.dispose === 'function') mat.dispose(); 
              }
              return basicMat;
           };

          if (Array.isArray(object.material)) {
            object.material = object.material.map(applyBasicMaterial);
          } else {
            object.material = applyBasicMaterial(object.material);
          }
        }
      });
    }
  // Depend on modelScene and actor properties that affect appearance
  }, [modelScene, actor.type, actor.scale]); 
  
  // Helper function to convert lat/lng to 3D position
  const latLngToVector3 = (lat: number, lng: number, height: number = 0): THREE.Vector3 => {
    // Validate inputs
    if (isNaN(lat) || isNaN(lng) || isNaN(height)) {
        console.error("Actor3D: Invalid lat/lng/height provided to latLngToVector3:", { lat, lng, height });
        // Return origin or last known position? For now, origin.
        return new THREE.Vector3(0,0,0); 
    }
    const geodetic = new Geodetic(radians(lng), radians(lat), height);
    const position = new THREE.Vector3();
    geodetic.toECEF(position);
    return position;
  };

  // Perform raycast to determine surface height
  // Consider optimizing this - maybe only raycast when actor type/major location changes
  useEffect(() => {
    if (!tilesRef.current || !actor?.position) return; // Check actor.position exists

    // Use the INITIAL position for the raycast, assuming height doesn't change drastically along the path for ground vehicles.
    // If dynamic height is needed later, this needs a more sophisticated approach (e.g., raycast less frequently).
    const [initialLongitude, initialLatitude] = actor.destinations?.[0]
        ? [actor.destinations[0].longitude, actor.destinations[0].latitude]
        : actor.position; // Fallback to current position if no destinations somehow

    // Ensure position is valid before raycasting
    if (isNaN(initialLatitude) || isNaN(initialLongitude)) {
        console.warn(`Actor3D: Invalid initial position for raycasting for actor ${actor.id}. Skipping height detection.`);
        setDetectedHeight(actor.type === 'plane' ? 300 : DEFAULT_HEIGHT); // Use default if position invalid
        return;
    }

    const basePosition = latLngToVector3(initialLatitude, initialLongitude, 0);
    const direction = basePosition.clone().normalize();
    // Start slightly below the expected surface to ensure intersection
    const startPosition = direction.clone().multiplyScalar(basePosition.length() - 500);

    raycaster.current.set(startPosition, direction);
    // Limit raycast distance for performance? Maybe not necessary with tiles structure.
    // raycaster.current.far = 1000;

    try {
      const intersects = raycaster.current.intersectObject(tilesRef.current, true);

      if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        // Calculate height relative to the ECEF position at sea level (0 height)
        const heightAboveSeaLevel = intersectionPoint.length() - basePosition.length();
        const finalHeight = heightAboveSeaLevel + HEIGHT_OFFSET;
        setDetectedHeight(finalHeight);
        // console.log(`Actor3D: Detected height for ${actor.type} ${actor.id}: ${finalHeight.toFixed(2)}m`);
      } else {
        setDetectedHeight(actor.type === 'plane' ? 300 : DEFAULT_HEIGHT);
        // console.log(`Actor3D: Raycast miss for ${actor.type} ${actor.id}. Using default height.`);
      }
    } catch (error) {
       console.error(`Actor3D: Error during raycasting for actor ${actor.id}:`, error);
       setDetectedHeight(actor.type === 'plane' ? 300 : DEFAULT_HEIGHT); // Fallback on error
    }

  // Depend only on stable identifiers, type, and the tiles ref presence.
  // Use actor.id as a proxy for "new actor instance".
  }, [actor.id, actor.type, tilesRef.current]);

  // Update target position and rotation based on the received actor prop
  useEffect(() => {
    // actor prop now contains the dynamic position and heading from SimulationManager
    const [longitude, latitude] = actor.position; // Reads the updated position
    const heading = actor.heading; // Reads the updated heading

    // Use detected height or fallback based on type
    const elevation = detectedHeight !== null ? detectedHeight : (actor.type === 'plane' ? 300 : DEFAULT_HEIGHT);

    // *** ADD LOG ***
        console.log(`[Actor3D TargetEffect Inputs ${actor.id}] Lat: ${latitude?.toFixed(5)}, Lon: ${longitude?.toFixed(5)}, Elev: ${elevation?.toFixed(1)}, Heading: ${heading?.toFixed(2)}`);
    // *** END LOG ***


    // Calculate target ECEF position using actor's dynamic lat/lon
    let targetPos: THREE.Vector3;
     try {
         targetPos = latLngToVector3(latitude, longitude, elevation);
         // Validate calculated position
         if (isNaN(targetPos.x) || isNaN(targetPos.y) || isNaN(targetPos.z)) {
             console.error(`[Actor3D ${actor.id}] Invalid targetPos calculated from [${longitude}, ${latitude}, ${elevation}]:`, targetPos);
             return; // Prevent further calculation with NaN
         }
         // *** ADD LOG ***
              console.log(`[Actor3D TargetEffect Calc ${actor.id}] Calculated ECEF targetPos:`, targetPos.toArray().map(n=>n.toFixed(1)));
         // *** END LOG ***

     } catch (e) {
         console.error(`[Actor3D ${actor.id}] Error in latLngToVector3 for [${longitude}, ${latitude}, ${elevation}]:`, e);
         return;
     }
    targetPositionRef.current.copy(targetPos);

    // --- Calculate target rotation using actor's dynamic heading ---
    const headingRadians = (heading * Math.PI) / 180;
    const upVector = targetPos.clone().normalize();

    // Validate upVector
    if (isNaN(upVector.x) || isNaN(upVector.y) || isNaN(upVector.z) || upVector.lengthSq() < 0.1) {
         console.error(`[Actor3D ${actor.id}] Invalid upVector:`, upVector, 'from targetPos:', targetPos);
         return; // Stop if upVector is invalid
    }

    // Calculate basis vectors robustly
    const worldUp = new THREE.Vector3(0, 0, 1); // ECEF Z is up
    let eastVector = new THREE.Vector3().crossVectors(worldUp, upVector);
    // Check for pole singularity
    if (eastVector.lengthSq() < 1e-6) {
        // console.log(`[Actor3D ${actor.id}] Near pole, calculating alternative eastVector.`);
        // If upVector is aligned with worldUp, pick an arbitrary orthogonal vector like world X
        eastVector.set(1, 0, 0);
        // Rotate this arbitrary vector so it's orthogonal to the actual upVector
        eastVector.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(worldUp, upVector));
    }
    eastVector.normalize();
    if (isNaN(eastVector.x) || isNaN(eastVector.y) || isNaN(eastVector.z)) { console.error(`[Actor3D ${actor.id}] Invalid eastVector calculated.`); return; }


    const northVector = new THREE.Vector3().crossVectors(upVector, eastVector).normalize();
    if (isNaN(northVector.x) || isNaN(northVector.y) || isNaN(northVector.z)) { console.error(`[Actor3D ${actor.id}] Invalid northVector calculated.`); return; }

    // Calculate forward vector based on heading (0 = North)
    const forwardVector = new THREE.Vector3()
      .addScaledVector(northVector, Math.cos(headingRadians))
      .addScaledVector(eastVector, Math.sin(headingRadians))
      .normalize();
     if (isNaN(forwardVector.x) || isNaN(forwardVector.y) || isNaN(forwardVector.z) || forwardVector.lengthSq() < 0.1) {
         console.error(`[Actor3D ${actor.id}] Invalid forwardVector calculated from heading ${heading}. North:`, northVector, 'East:', eastVector);
         return;
     }

    // Recalculate right vector based on final up and forward for a clean basis
    const rightVector = new THREE.Vector3().crossVectors(upVector, forwardVector).normalize();
     if (isNaN(rightVector.x) || isNaN(rightVector.y) || isNaN(rightVector.z) || rightVector.lengthSq() < 0.1) {
         console.error(`[Actor3D ${actor.id}] Invalid rightVector calculated. Up:`, upVector, 'Forward:', forwardVector);
         return;
     }

     // Ensure forward is orthogonal to the new right and up (addresses potential drift)
     const finalForwardVector = new THREE.Vector3().crossVectors(rightVector, upVector).normalize();
      if (isNaN(finalForwardVector.x) || isNaN(finalForwardVector.y) || isNaN(finalForwardVector.z) || finalForwardVector.lengthSq() < 0.1) {
          console.error(`[Actor3D ${actor.id}] Invalid finalForwardVector calculated. Right:`, rightVector, 'Up:', upVector);
          return;
      }


    // Create rotation matrix using the robustly calculated basis
    // Basis: X=Right, Y=Up, Z=Forward (assuming model forward is +Z)
    const rotMatrix = new THREE.Matrix4();
    rotMatrix.makeBasis(rightVector, upVector, finalForwardVector);

    // Set target quaternion from matrix, with validation
    const targetQuat = new THREE.Quaternion();
    try {
       targetQuat.setFromRotationMatrix(rotMatrix);
       if (isNaN(targetQuat.x) || isNaN(targetQuat.y) || isNaN(targetQuat.z) || isNaN(targetQuat.w)) {
           throw new Error("Quaternion components are NaN");
       }
       // Update target only if valid
       targetQuaternionRef.current.copy(targetQuat);

       // *** MODIFY LOG ***
            const oldPos = currentPositionRef.current.toArray().map(n => n.toFixed(1));
            const newTgtPos = targetPositionRef.current.toArray().map(n => n.toFixed(1));
            if (oldPos.join(',') !== newTgtPos.join(',')) {
                 // Log the newly updated target ref value
                 console.log(`[Actor3D TargetEffect Ref ${actor.id}] TargetPos Ref Updated TO:`, newTgtPos);
            }
       // *** END LOG ***

    } catch (error) {
         console.error(`[Actor3D ${actor.id}] Error setting quaternion from rotation matrix:`, error);
         console.error("Matrix:", rotMatrix.elements);
         console.error("Basis Vectors:", { rightVector, upVector, finalForwardVector });
    }


    // Initialize current position/rotation if it's the first update
    if (!groupRef.current?.position || groupRef.current.position.lengthSq() === 0) {
        if (!isNaN(targetPositionRef.current.x) && !isNaN(targetQuaternionRef.current.x)) {
           currentPositionRef.current.copy(targetPositionRef.current);
           currentQuaternionRef.current.copy(targetQuaternionRef.current);
           if(groupRef.current) {
               groupRef.current.position.copy(targetPositionRef.current);
               groupRef.current.quaternion.copy(targetQuaternionRef.current);
               // *** ADD LOG ***
                   console.log(`[Actor3D TargetEffect Init ${actor.id}] Initialized group/current refs to Pos:`, targetPositionRef.current.toArray().map(n => n.toFixed(1)));
               // *** END LOG ***
           }
        } else {
             console.warn(`[Actor3D ${actor.id}] Cannot initialize position/rotation due to invalid target values.`);
        }
    }

  }, [actor.position, actor.heading, actor.type, detectedHeight]); // Runs when position/heading changes
  
  // Lerping logic in useFrame
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const isTargetPosValid = !isNaN(targetPositionRef.current.x);
    const isTargetQuatValid = !isNaN(targetQuaternionRef.current.x);

    // *** ADD LOG ***
    // Log the received props
    // console.log(`[Actor3D useFrame State ${actor.id}] PROPS: isPlaying=${isPlaying}, isPaused=${isPaused}`);
    // *** END LOG ***


    if (!isTargetPosValid || !isTargetQuatValid) {
       return;
    }

    // *** USE PROPS for condition ***
    if (isPlaying && !isPaused) {
      const positionLerpFactor = delta * 5;
      const rotationLerpFactor = delta * 4;
      const clampedPosLerp = Math.min(1.0, positionLerpFactor);
      const clampedRotLerp = Math.min(1.0, rotationLerpFactor);

      // *** ADD LOG ***
      const posBeforeLerp = currentPositionRef.current.clone();
      // *** END LOG ***

      currentPositionRef.current.lerp(targetPositionRef.current, clampedPosLerp);
      currentQuaternionRef.current.slerp(targetQuaternionRef.current, clampedRotLerp);

      // *** ADD LOG ***
          console.log(`[Actor3D useFrame Lerp ${actor.id}] Pos BEFORE Lerp:`, posBeforeLerp.toArray().map(n=>n.toFixed(1)));
          console.log(`[Actor3D useFrame Lerp ${actor.id}] Pos AFTER Lerp (target=${targetPositionRef.current.toArray().map(n=>n.toFixed(1))} alpha=${clampedPosLerp.toFixed(3)}):`, currentPositionRef.current.toArray().map(n=>n.toFixed(1)));
      // *** END LOG ***


      // Final check for NaN before applying to the group
      if (!isNaN(currentPositionRef.current.x) && !isNaN(currentQuaternionRef.current.x)) {
          const prevGroupPos = groupRef.current?.position.clone();

          groupRef.current.position.copy(currentPositionRef.current);
          groupRef.current.quaternion.copy(currentQuaternionRef.current);

           // Log only if position changed significantly after applying
           // console.log(`[Actor3D useFrame Applied ${actor.id}] Applied Pos TO group:`, groupRef.current.position.toArray().map(n=>n.toFixed(1)));


      } else {
           console.warn(`[Actor3D ${actor.id} Frame] NaN detected in lerped values. Pos:`, currentPositionRef.current, `Quat:`, currentQuaternionRef.current);
           // Snap to target as fallback
           groupRef.current.position.copy(targetPositionRef.current);
           groupRef.current.quaternion.copy(targetQuaternionRef.current);
           currentPositionRef.current.copy(targetPositionRef.current);
           currentQuaternionRef.current.copy(targetQuaternionRef.current);
      }

    } else {
      // Snapping logic
        // console.log(`[Actor3D useFrame State ${actor.id}] Snapping because PROPS: isPlaying=${isPlaying} or isPaused=${isPaused}`);
      if (groupRef.current.position.distanceToSquared(targetPositionRef.current) > 1e-4 ||
          groupRef.current.quaternion.angleTo(targetQuaternionRef.current) > 1e-3) {

          groupRef.current.position.copy(targetPositionRef.current);
          groupRef.current.quaternion.copy(targetQuaternionRef.current);

          currentPositionRef.current.copy(targetPositionRef.current);
          currentQuaternionRef.current.copy(targetQuaternionRef.current);
           // console.log(`[Actor3D useFrame Snap ${actor.id}] Snapped Pos TO group:`, groupRef.current.position.toArray().map(n=>n.toFixed(1)));
      }
    }
  });
  
  // Initialize position/rotation refs when groupRef becomes available
   useEffect(() => {
     if (groupRef.current) {
       currentPositionRef.current.copy(groupRef.current.position);
       currentQuaternionRef.current.copy(groupRef.current.quaternion);
     }
   }, []);

  // *** ADD LOG ***
      console.log(`[Actor3D Render ${actor.id}] Received Pos: [${actor.position[0]?.toFixed(5)}, ${actor.position[1]?.toFixed(5)}], Heading: ${actor.heading?.toFixed(2)}`);
  // *** END LOG ***

  return (
    // Position the group using the lerped values in useFrame
    <group ref={groupRef}> 
      {/* Container group at origin relative to the parent groupRef */}
      <group position={[0, 0, 0]} >
        {DEBUG_MODE ? (
          <mesh 
            ref={innerCubeRef}
            renderOrder={1001} // Render debug cube on top
          >
            <boxGeometry args={[10, 10, 10]} /> {/* Smaller debug cube */}
            <meshBasicMaterial 
              color={actor.type === 'plane' ? '#ff5555' : 
                    actor.type === 'ship' ? '#55ff55' : 
                    actor.type === 'train' ? '#5555ff' : '#ffff55'}
              transparent={true}
              opacity={0.6}
              depthTest={false} 
              toneMapped={false}
            />
          </mesh>
        ) : null}

        <group> 
            {/* Outer Ring for outline effect */}
            <Ring
                args={[RING_SIZE, RING_SIZE + RING_THICKNESS + 60, 32]} // inner, outer, segments
                rotation={[-Math.PI / 2, 0, 0]} // Rotate to lie flat initially (will be overridden by parent group)
                renderOrder={999} // Render behind model but above ground potentially
            >
                <meshBasicMaterial 
                    color={OUTER_RING_COLOR} 
                    side={THREE.DoubleSide} 
                    transparent={true} 
                    opacity={0.8} 
                    depthTest={false} // Might need adjustment depending on terrain interaction
                    toneMapped={false}
                />
            </Ring>
            {/* Inner Ring */}
            <Ring
                args={[RING_SIZE, RING_SIZE + RING_THICKNESS, 32]} // inner, outer, segments
                rotation={[-Math.PI / 2, 0, 0]} // Rotate to lie flat initially
                renderOrder={1000} // Same level as outer debug cube
            >
                <meshBasicMaterial 
                    color={RING_COLOR} 
                    side={THREE.DoubleSide} 
                    transparent={true} 
                    opacity={0.9} 
                    depthTest={false} // Disable depth test to ensure visibility
                    toneMapped={false}
                />
            </Ring>
        </group>

        {/* Model group - centered and oriented in useEffect */}
        <group ref={modelRef} />
      </group>
    </group>
  );
};

export default Actor3D;
