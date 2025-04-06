import { css } from '@emotion/react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SMAA, ToneMapping } from '@react-three/postprocessing'
import {
  type GlobeControls as GlobeControlsImpl,
  type TilesRenderer as TilesRendererImpl
} from '3d-tiles-renderer'
import {
  GLTFExtensionsPlugin,
  GoogleCloudAuthPlugin,
  TileCompressionPlugin,
  TilesFadePlugin,
  UpdateOnChangePlugin
} from '3d-tiles-renderer/plugins'
import {
  GlobeControls,
  TilesAttributionOverlay,
  TilesPlugin,
  TilesRenderer
} from '3d-tiles-renderer/r3f'
import { simulationTextInputAtom } from './CreatorToolContainer'
import { useAtomValue, useSetAtom, useAtom } from 'jotai'
import { cloudCoverageAtom } from './WeatherControlMenu'
import { getDefaultStore } from 'jotai/vanilla'
import { simulationStateAtom } from '../services/SimulationService'
import { mapFocusLocationAtom } from '../helpers/states'
import {
  EffectMaterial,
  type EffectComposer as EffectComposerImpl
} from 'postprocessing'
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  type FC
} from 'react'
import { DRACOLoader } from 'three-stdlib'

import { TileCreasedNormalsPlugin } from '@takram/three-3d-tiles-support'
import {
  AerialPerspective,
  Atmosphere,
  type AtmosphereApi,
  Stars,
  type StarsImpl
} from '@takram/three-atmosphere/r3f'
import { type CloudsEffect } from '@takram/three-clouds'
import { Clouds } from '@takram/three-clouds/r3f'
import { Geodetic, PointOfView, radians } from '@takram/three-geospatial'
import { getECIToECEFRotationMatrix } from '@takram/three-atmosphere'
import {
  Depth,
  Dithering,
  LensFlare,
  Normal
} from '@takram/three-geospatial-effects/r3f'

import { EffectComposer } from '../helpers/EffectComposer'
import { HaldLUT } from '../helpers/HaldLUT'
import { googleMapsApiKeyAtom, needsApiKeyAtom } from '../helpers/states'
import { Stats } from '../helpers/Stats'
import { GeoJSONContainer } from '../components/GeoJSONContainer'

// Simple wrapper for GeoJSONContainer which now directly accesses the atoms
const GeoJSONContainerWrapper: FC = () => {
  return <GeoJSONContainer />;
}
import { useColorGradingControls } from '../helpers/useColorGradingControls'
import { useControls } from '../helpers/useControls'
import { useGoogleMapsAPIKeyControls } from '../helpers/useGoogleMapsAPIKeyControls'
import { useKeyboardControl } from '../helpers/useKeyboardControl'
import SimulationManager from '../components/SimulationManager'
import {
  useLocalDateControls,
  type LocalDateControlsParams
} from '../helpers/useLocalDateControls'
import { usePovControls } from '../helpers/usePovControls'
import { useToneMappingControls } from '../helpers/useToneMappingControls'
import { useCloudsControls } from '../helpers/useCloudsControls'
import ThreeLiveUAEvents from './ThreeLiveUAEvents'
import ThreeNotmars from './ThreeNotmars'
import ThreeCaptureFlag from './ThreeCaptureFlag'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')

const Globe: FC = () => {
  // Generate a unique ID for this component instance to use as keys
  const instanceId = useRef(Date.now().toString()).current
  const controls = useThree(
    ({ controls }) => controls as GlobeControlsImpl | null
  )
  useEffect(() => {
    if (controls != null) {
      const callback = (): void => {
        controls.adjustHeight = true
        controls.removeEventListener('start', callback)
      }
      controls.addEventListener('start', callback)
      return () => {
        controls.removeEventListener('start', callback)
      }
    }
    return () => {}
  }, [controls])

  const apiKey = useAtomValue(googleMapsApiKeyAtom)

  const [tiles, setTiles] = useState<TilesRendererImpl | null>(null)
  const setNeedsApiKey = useSetAtom(needsApiKeyAtom)
  useEffect(() => {
    if (tiles == null) {
      return
    }
    const callback = (): void => {
      setNeedsApiKey(true)
    }
    tiles.addEventListener('load-error', callback)
    return () => {
      tiles.removeEventListener('load-error', callback)
    }
  }, [tiles, setNeedsApiKey])

  // Create and register plugins manually using useEffect
  useEffect(() => {
    if (tiles) {
      // Create separate plugin instances for each feature
      const authPlugin = new GoogleCloudAuthPlugin({
        apiToken: apiKey !== '' ? apiKey : (import.meta.env['VITE_GOOGLE_MAP_API_KEY'] || ''),
        autoRefreshToken: true
      });
      
      const gltfPlugin = new GLTFExtensionsPlugin();
      gltfPlugin.dracoLoader = dracoLoader;
      
      const compressionPlugin = new TileCompressionPlugin();
      const updatePlugin = new UpdateOnChangePlugin();
      const fadePlugin = new TilesFadePlugin();
      const creasedNormalsPlugin = new TileCreasedNormalsPlugin({ 
        creaseAngle: radians(30) 
      });
      
      // Register all plugins manually
      tiles.registerPlugin(authPlugin);
      tiles.registerPlugin(gltfPlugin);
      tiles.registerPlugin(compressionPlugin);
      tiles.registerPlugin(updatePlugin);
      tiles.registerPlugin(fadePlugin);
      tiles.registerPlugin(creasedNormalsPlugin);
      
      // Return cleanup function to unregister plugins when component unmounts
      return () => {
        tiles.unregisterPlugin(authPlugin);
        tiles.unregisterPlugin(gltfPlugin);
        tiles.unregisterPlugin(compressionPlugin);
        tiles.unregisterPlugin(updatePlugin);
        tiles.unregisterPlugin(fadePlugin);
        tiles.unregisterPlugin(creasedNormalsPlugin);
      };
    }
    
    // Return a no-op cleanup function when tiles is null
    return () => {};
  }, [tiles, apiKey]); // Re-run when tiles or apiKey changes
  
  return (
    <TilesRenderer
      key={apiKey} // Reconstruct tiles when API key changes.
      ref={setTiles}
    >
      <GlobeControls
        enableDamping
        // Globe controls adjust the camera height based on very low LoD tiles
        // during the initial load, causing the camera to unexpectedly jump to
        // the sky when set to a low altitude.
        // Re-enable it when the user first drags.
        adjustHeight={false}
        maxAltitude={Math.PI * 0.55} // Permit grazing angles
        // maxDistance={7500} // Below the bottom of the top cloud layer, for now
      />
      <TilesAttributionOverlay />
    </TilesRenderer>
  )
}

interface SceneProps extends LocalDateControlsParams {
  exposure?: number
  longitude?: number
  latitude?: number
  heading?: number
  pitch?: number
  distance?: number
  coverage?: number
}

const Scene: FC<SceneProps> = ({
  exposure = 10,
  longitude = -122.4027251,
  latitude = 37.7939119,
  heading = 110,
  pitch = -90,
  distance = 14000000,
  coverage: initialCoverage = 0.3,
  ...localDate
}) => {
  // Add refs for stars and rotation matrix
  const starsRef = useRef<StarsImpl>(null)
  const rotationMatrixRef = useRef(new THREE.Matrix4())
  // Use the cloudCoverageAtom instead of the prop for cloud coverage
  const coverage = useAtomValue(cloudCoverageAtom);
  // Create a ref to store the GlobeControls instance
  const globeControlsRef = useRef<GlobeControlsImpl | null>(null)
  
  // Create state for pitch and heading that can be updated by control-drag
  const [currentPitch, setCurrentPitch] = useState<number>(pitch)
  const [currentHeading, setCurrentHeading] = useState<number>(heading)
  const mapFocusLocation = useAtomValue(mapFocusLocationAtom);

  
  // Get simulation input, state, and geoJsonData from Jotai atoms
  const simulationInput = useAtomValue(simulationTextInputAtom)
  const simulationState = useAtomValue(simulationStateAtom)
  
  // Initialize refs to track the latest values (helps with event handling)
  const pitchRef = useRef<number>(pitch)
  const headingRef = useRef<number>(heading)
  
  // Ref to track if we've already framed the simulation
  const hasFramedSimulation = useRef<boolean>(false)
  
  // Get the camera from Three.js
  const camera = useThree(({ camera }) => camera)
  
  // Update refs when props change
  useEffect(() => {
    pitchRef.current = pitch
    headingRef.current = heading
  }, [pitch, heading])
  
  // Update refs when state changes
  useEffect(() => {
    pitchRef.current = currentPitch
    headingRef.current = currentHeading
  }, [currentPitch, currentHeading])
  
  const { toneMappingMode } = useToneMappingControls({ exposure })
  const lut = useColorGradingControls()
  const { lensFlare, normal, depth } = useControls(
    'effects',
    {
      lensFlare: true,
      depth: false,
      normal: false
    }
  )
  usePovControls(camera)
  const motionDate = useLocalDateControls({ longitude, ...localDate })
  const { correctAltitude, correctGeometricError, photometric } = useControls(
    'atmosphere',
    {
      correctAltitude: true,
      correctGeometricError: true,
      photometric: true,
      animate: true
    }
  )

  // Track initial render state
  const isInitialRender = useRef(true)
  
  useLayoutEffect(() => {
    // IMPORTANT: Always use the props values directly for pitch and distance
    // This ensures the values from mapFocusLocation are properly applied
    const currentPitch = pitch
    const currentHeading = heading
    const currentDistance = distance
    
    // Log the exact values we're using to update the camera
    console.log('[ThreeMapContainer] Updating camera with EXACT values:', {
      longitude,
      latitude,
      heading: currentHeading,
      pitch: currentPitch,
      distance: currentDistance
    })
    
    // Create a new PointOfView with the exact values from props
    const pov = new PointOfView(currentDistance, radians(currentHeading), radians(currentPitch))
    
    // Get the current geodetic position
    const geodetic = new Geodetic(radians(longitude), radians(latitude))
    
    // Apply the camera orientation
    pov.decompose(
      geodetic.toECEF(),
      camera.position,
      camera.quaternion,
      camera.up
    )
    
    // Force the camera to update its matrices
    camera.updateMatrix()
    camera.updateMatrixWorld(true)
    
    // Set isInitialRender to false after first render
    isInitialRender.current = false
    
    console.log('[ThreeMapContainer] CAMERA UPDATED - PITCH:', currentPitch.toFixed(2), 'HEADING:', currentHeading.toFixed(2), 'DISTANCE:', currentDistance.toFixed(2))
  }, [longitude, latitude, currentHeading, currentPitch, distance, camera])
  
  // Listen for pitch and heading change events from control-drag
  useEffect(() => {
    // console.log('[ThreeMapContainer] Setting up event listener for:', PITCH_HEADING_CHANGE_EVENT)
    
    const handlePitchHeadingChange = (event: Event) => {
      const customEvent = event as CustomEvent
      console.log('[ThreeMapContainer] RECEIVED EVENT:', event)
      console.log('[ThreeMapContainer] EVENT DETAIL:', customEvent.detail)
      console.log('[ThreeMapContainer] RECEIVED EVENT - PITCH:', customEvent.detail?.pitch?.toFixed(2), 'HEADING:', customEvent.detail?.heading?.toFixed(2))
      
      if (customEvent.detail && 
          typeof customEvent.detail.pitch === 'number' && 
          typeof customEvent.detail.heading === 'number') {
        
        console.log('[ThreeMapContainer] BEFORE update - currentPitch:', currentPitch, 'currentHeading:', currentHeading)
        
        // Force update with the new values
        const newPitch = customEvent.detail.pitch
        const newHeading = customEvent.detail.heading
        
        console.log('[ThreeMapContainer] UPDATING to pitch:', newPitch.toFixed(2), 'heading:', newHeading.toFixed(2))
        
        // IMPORTANT: Update both state and refs
        setCurrentPitch(newPitch)
        setCurrentHeading(newHeading)
        pitchRef.current = newPitch
        headingRef.current = newHeading
        
        // Force camera update immediately for better responsiveness
        try {
          // Get current camera state including distance
          const currentPov = new PointOfView()
          currentPov.setFromCamera(camera)
          
          // Always use the distance from the event when available
          // This ensures we don't revert to previous distances after zooming
          const eventDistance = typeof customEvent.detail.distance === 'number' ? customEvent.detail.distance : currentPov.distance
          
          console.log('[ThreeMapContainer] Using distance from event:', eventDistance, 'current camera distance:', currentPov.distance)
          
          // Create a new PointOfView with the updated values and preserved distance
          const pov = new PointOfView(eventDistance, radians(newHeading), radians(newPitch))
          
          // Get the current geodetic position
          const geodetic = new Geodetic(radians(longitude), radians(latitude))
          
          // Apply the new camera orientation
          pov.decompose(
            geodetic.toECEF(),
            camera.position,
            camera.quaternion,
            camera.up
          )
          
          // Force the camera to update its matrices
          camera.updateMatrix()
          camera.updateMatrixWorld(true)
          
          console.log('[ThreeMapContainer] CAMERA UPDATED FROM EVENT - PITCH:', newPitch.toFixed(2), 'HEADING:', newHeading.toFixed(2))
        } catch (error) {
          console.error('[ThreeMapContainer] Error updating camera:', error)
        }
      } else {
        console.error('[ThreeMapContainer] Invalid event detail:', customEvent.detail)
      }
    }
    
    // Add event listener
    // document.addEventListener(PITCH_HEADING_CHANGE_EVENT, handlePitchHeadingChange)
    // console.log('[ThreeMapContainer] Event listener added for:', PITCH_HEADING_CHANGE_EVENT)
    
    // Clean up
    return () => {
      // console.log('[ThreeMapContainer] Removing event listener for:', PITCH_HEADING_CHANGE_EVENT)
      // document.removeEventListener(PITCH_HEADING_CHANGE_EVENT, handlePitchHeadingChange)
    }
  }, [camera, latitude, longitude])

  // Effects must know the camera near/far changed by GlobeControls.
  const composerRef = useRef<EffectComposerImpl>(null)
  useFrame(() => {
    const composer = composerRef.current
    if (composer != null) {
      composer.passes.forEach(pass => {
        if (pass.fullscreenMaterial instanceof EffectMaterial) {
          pass.fullscreenMaterial.adoptCameraSettings(camera)
        }
      })
    }
  })

  const atmosphereRef = useRef<AtmosphereApi>(null)
  useFrame(() => {
    const date = new Date(motionDate.get())
    atmosphereRef.current?.updateByDate(date)
    
    // Update stars rotation based on Earth's rotation
    getECIToECEFRotationMatrix(date, rotationMatrixRef.current)
    if (starsRef.current != null) {
      starsRef.current.setRotationFromMatrix(rotationMatrixRef.current)
    }
  })

  const [clouds, setClouds] = useState<CloudsEffect | null>(null)
  
  // Create a ref to track the previous coverage value
  const prevCoverageRef = useRef<number>(coverage)
  
  // Update clouds effect when coverage changes
  useEffect(() => {
    if (clouds && prevCoverageRef.current !== coverage) {
      console.log('[ThreeMapContainer] Cloud coverage changed:', coverage)
      prevCoverageRef.current = coverage
      
      // Force clouds to update with new coverage
      if (clouds.cloudLayers && clouds.cloudLayers.length > 0) {
        // Update each cloud layer
        clouds.cloudLayers.forEach(layer => {
          if (layer) {
            layer.densityScale = coverage * 0.5 + 0.1 // Scale appropriately
          }
        })
      }
    }
  }, [clouds, coverage])
  
  const [{ enabled, toneMapping }, cloudsProps] = useCloudsControls(clouds, {
    coverage,
    animate: true,
  })

  useKeyboardControl()
  
  // Get the controls for the control-drag rotation feature
  const controls = useThree(({ controls }) => controls as GlobeControlsImpl | null)
  
  // Store the controls in our ref for access
  useEffect(() => {
    if (controls) {
      globeControlsRef.current = controls
      console.log('[ThreeMapContainer] GlobeControls instance stored in ref:', controls)
    }
  }, [controls])
  

  const { scene, gl } = useThree();
  
  // Add direct event listeners to the WebGLRenderer's DOM element
  useEffect(() => {
    if (gl && gl.domElement) {
     
      const handleRendererMouseDown = (e: MouseEvent) => {
      }
      
      // Add event listener directly to the WebGLRenderer's DOM element
      gl.domElement.addEventListener('mousedown', handleRendererMouseDown)
      
      return () => {
        gl.domElement.removeEventListener('mousedown', handleRendererMouseDown)
      }
    }
  }, [gl])
  

  const showSky = useMemo(() => {
    return mapFocusLocation.distance && mapFocusLocation.distance <= 6000;
  }, [mapFocusLocation.distance]);


  
  return (
    <>
      <Stars
        ref={starsRef}
        data='/assets/stars.bin'
        scale={[20000000, 20000000, 20000000]}
        radianceScale={10}
        background={false}
      />
      
      <Atmosphere
        ref={atmosphereRef}
        correctAltitude={correctAltitude}
        photometric={photometric}
      >
        <GlobeControls
          ref={(instance: GlobeControlsImpl | null) => {
            if (instance) {
              globeControlsRef.current = instance
              
              // Add a method to enable/disable controls
              if (!('setEnabled' in instance)) {
                (instance as any).setEnabled = (enabled: boolean) => {
                  if (!enabled) {
                    // Store original values
                    (instance as any)._originalEnabled = instance.enabled
                    instance.enabled = false
                  } else {
                    // Restore original values
                    instance.enabled = (instance as any)._originalEnabled ?? true
                  }
                }
              }
            }
          }}
        />
        <Globe />
        {/* Add GeoJSONContainer to display GeoJSON objects */}
        <GeoJSONContainerWrapper />
        
        {/* Add SimulationManager for actor simulation */}
        <SimulationManager />
        
        {/* Add Live UA Events markers */}
        <ThreeLiveUAEvents />
        
        {/* Add Notmars markers */}
        <ThreeNotmars />

        {/* ADd three capture flag markers demo */}
        <ThreeCaptureFlag />
        
        <EffectComposer ref={composerRef} multisampling={0}>
          <Fragment
            // Effects are order-dependant; we need to reconstruct the nodes.
            key={JSON.stringify([
              correctGeometricError,
              lensFlare,
              normal,
              depth,
              lut,
              enabled,
              toneMappingMode
            ])}
          >
            {!normal && !depth && (
              <>
                {enabled && (
                  <Clouds
                    ref={setClouds}
                    shadow-farScale={0.25}
                    {...cloudsProps}
                  />
                )}
                <AerialPerspective
                  sky={true}
                  sunIrradiance
                  skyIrradiance                  
                  correctGeometricError={correctGeometricError}
                  irradianceScale={2 / Math.PI}
                />
              </>
            )}
            {toneMapping && (
              <>
                {lensFlare && <LensFlare />}
                {depth && <Depth useTurbo />}
                {normal && <Normal />}
                {!normal && !depth && (
                  <>
                    <ToneMapping mode={toneMappingMode} />
                    {lut != null && <HaldLUT path={lut} />}
                    <SMAA />
                    <Dithering />
                  </>
                )}
              </>
            )}
          </Fragment>
        </EffectComposer>
      </Atmosphere>
    </>
  )
}

export const ThreeMapContainer: FC<SceneProps> = initialProps => {
  // Using an empty object instead of { collapsed: true } to fix type issues
  // Remove collapsed property to fix type errors
  useGoogleMapsAPIKeyControls()
  const needsApiKey = useAtomValue(needsApiKeyAtom)
  // Get simulation input from the chat input component
  const simulationInput = useAtomValue(simulationTextInputAtom)
  
  // Initialize jotaiStore for global access (used by GeoJSONService)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.jotaiStore = getDefaultStore();
    }
  }, [])
  
  // Add state to track if the component is mounted
  // This helps ensure proper initialization in development mode
  const [isMounted, setIsMounted] = useState(false)
  
  // Force a render cycle after component mounts
  useEffect(() => {
    setIsMounted(true)
    
    // Force a re-render after a short delay to ensure Three.js initializes properly
    const timer = setTimeout(() => {
      // This empty state update forces a re-render
      setIsMounted(state => state)
    }, 10)
    
    return () => clearTimeout(timer)
  }, [])
  
  // Get the simulation state to check if we have actors to control
  const [simState] = useAtom(simulationStateAtom);
  
  // IMPORTANT: Get the map focus location directly from the atom
  const mapFocusLocation = useAtomValue(mapFocusLocationAtom);
  
  // CRITICAL: Don't use useState here as it's causing the issue
  // Instead, directly create the props object with the current mapFocusLocation values
  // This ensures the Scene component always gets the latest values
  const sceneProps = {
    ...initialProps,
    latitude: mapFocusLocation.latitude,
    longitude: mapFocusLocation.longitude,
    heading: mapFocusLocation.heading || initialProps.heading || 110,
    pitch: typeof mapFocusLocation.pitch === 'number' ? mapFocusLocation.pitch : -90,
    distance: typeof mapFocusLocation.distance === 'number' ? mapFocusLocation.distance : 14000 
  };
  

  return (
    <>
      <Canvas gl={{ depth: false }} camera={{}}>
        <Stats />
        <Scene {...sceneProps} />
      </Canvas>
      
      {needsApiKey && (
        <div
          css={css`
            position: absolute;
            top: 50%;
            left: 50%;
            color: white;
            text-align: center;
            line-height: 1.5;
            transform: translate(-50%, -50%);
          `}
        >
          Our API key has seemingly exceeded its daily quota.
          <br />
          Enter your{' '}
          <a
            href='https://developers.google.com/maps/documentation/tile/get-api-key'
            target='_blank'
            rel='noreferrer'
            style={{ color: 'inherit' }}
          >
            Google Maps API key
          </a>{' '}
          at the top right of this screen, or check back tomorrow.
        </div>
      )}
    </>
  )
}

export default ThreeMapContainer 
