import { useThree } from '@react-three/fiber'
import { useEffect, useRef, useCallback } from 'react'
import { PointOfView, radians, degrees } from '@takram/three-geospatial'
import { Camera, WebGLRenderer } from 'three'

/*********
/////////////

NOTICE TO ANYONE MODIFYING FILE, DO NOT TRY TO USE DEFAULT
CAMERA CONTROLS, YOU HAVE TO INSTEAD MODIFY THE PITCH 
AND HEADING VALUES DIRECTLY


WHEN A USER HOLDS DOWN CONTROL AND THEN DRAGS, THEY SHOULD
MODIFY THE PITCH AND HEADING VALUES THAT ARE THEN PASSED
TO ThreeMapContainer

////////////
***********/

// Create a custom event for pitch and heading changes
export const PITCH_HEADING_CHANGE_EVENT = 'pitchHeadingChange'

/**
 * Simple hook to log mouse events
 */
function useMouseEventLogger() {
  useEffect(() => {
    
    // Global event capture - will catch ALL mouse events at the document level before anything else
    const captureGlobalMouseDown = (e: MouseEvent) => {
      // Check if the target is a canvas or inside the Three.js container
      const isCanvas = e.target instanceof HTMLCanvasElement
      const isThreeContainer = (e.target as HTMLElement)?.closest?.('.three-container') !== null
      
      if (isCanvas || isThreeContainer) {
      } else {
      }
    }
    
    const captureGlobalMouseUp = (e: MouseEvent) => {
      // Check if the target is a canvas or inside the Three.js container
      const isCanvas = e.target instanceof HTMLCanvasElement
      const isThreeContainer = (e.target as HTMLElement)?.closest?.('.three-container') !== null
      
      if (isCanvas || isThreeContainer) {
      }
    }
    
    // Add capture phase listeners at the document level
    // This will catch ALL events before they reach any other handlers
    document.addEventListener('mousedown', captureGlobalMouseDown, { capture: true })
    document.addEventListener('mouseup', captureGlobalMouseUp, { capture: true })
    
    // Set up a MutationObserver to detect when canvas is added to the DOM
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node instanceof HTMLElement) {
              // Check if this node is a canvas or contains a canvas
              const canvasElements = node.tagName === 'CANVAS' ? [node] : node.querySelectorAll('canvas')
              
              if (canvasElements.length > 0) {
                
                canvasElements.forEach(canvas => {
                  // Add direct event listeners to the canvas
                  const handleCanvasMouseDown = (e: MouseEvent) => {
                  }
                  
                  canvas.addEventListener('mousedown', handleCanvasMouseDown as EventListener, { capture: true })
                })
              }
            }
          })
        }
      }
    })
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true })
    
    // Also try to find any existing canvas elements
    const existingCanvases = document.querySelectorAll('canvas')
    if (existingCanvases.length > 0) {
      
      existingCanvases.forEach(canvas => {
        const handleCanvasMouseDown = (e: MouseEvent) => {
        }
        
        canvas.addEventListener('mousedown', handleCanvasMouseDown, { capture: true })
      })
    }
    
    return () => {
      document.removeEventListener('mousedown', captureGlobalMouseDown, { capture: true })
      document.removeEventListener('mouseup', captureGlobalMouseUp, { capture: true })
      observer.disconnect()
    }
  }, [])
}

/**
 * Hook that enables rotating the map's pitch and heading when holding down the control key and dragging
 * the mouse.
 * 
 * @param providedCamera - Optional camera to use instead of the default one from useThree
 * @param providedControls - Optional controls to use instead of the default ones from useThree
 * @param renderer - Optional WebGLRenderer to attach events to
 */
export function useControlDragRotation(providedCamera?: Camera, providedControls?: any, renderer?: WebGLRenderer): void {
  // Use the mouse event logger hook
  useMouseEventLogger()
  
  // Try to access the WebGLRenderer directly
  useEffect(() => {
    if (renderer && renderer.domElement) {
      
      const handleRendererClick = (e: MouseEvent) => {
      }
      
      // Try to add event listeners directly to the canvas
      renderer.domElement.addEventListener('pointerdown', handleRendererClick as EventListener, { capture: true })
      
      return () => {
        renderer.domElement.removeEventListener('pointerdown', handleRendererClick as EventListener, { capture: true })
      }
    }
  }, [renderer])
  
  // Directly patch the GlobeControls to intercept events
  useEffect(() => {
    if (providedControls) {
      // Try to access internal event handlers
      if (providedControls.pointerTracker) { 
        // Try to monkey patch the addPointer method
        const originalAddPointer = providedControls.pointerTracker.addPointer
        if (originalAddPointer && typeof originalAddPointer === 'function') {
          providedControls.pointerTracker.addPointer = function(e: PointerEvent) {
            return originalAddPointer.call(this, e)
          }
        }
      }
      
      // Try to access the domElement directly
      if (providedControls.domElement) {
        const handleControlsMouseDown = (e: MouseEvent) => {
        }
        
        providedControls.domElement.addEventListener('mousedown', handleControlsMouseDown, { capture: true })
      }
    }
    
    return () => {
      // Cleanup if needed
    }
  }, [providedControls])
  // Get the camera and controls from the Three.js context if not provided
  const internalCamera = useThree(({ camera }) => camera)
  const internalControls = useThree(({ controls }) => controls)
  
  // Use provided camera/controls or fall back to the ones from context
  const camera = providedCamera || internalCamera
  const controls = providedControls || internalControls
  
  // Store the last mouse position
  const lastMousePosition = useRef({ x: 0, y: 0 })

  // Track if control key is pressed
  const isControlPressed = useRef(false)
  
  // Track if we're currently dragging
  const isDragging = useRef(false)

  // Store current pitch, heading, and distance values
  const currentHeadingRef = useRef<number>(radians(110)) // Default heading
  const currentPitchRef = useRef<number>(radians(-90)) // Default pitch (-90 to match App.tsx)
  const currentDistanceRef = useRef<number>(14000) // Default distance (14000 to match App.tsx)

  // Define all handlers with useCallback to avoid recreating them on each render
  const handleKeyDown = useCallback((e: KeyboardEvent): void => {
    // Check if control or meta key is pressed
    if (e.key === 'Control' || e.key === 'Meta' || e.ctrlKey || e.metaKey) {
      isControlPressed.current = true
      
      if (camera) {
        // Log current pitch and heading when control is pressed
        const pov = new PointOfView()
        pov.setFromCamera(camera as Camera)
        console.log(`[ControlDragRotation] PITCH: ${degrees(pov.pitch).toFixed(2)}° HEADING: ${degrees(pov.heading).toFixed(2)}°`)
      }
      
      // Change cursor to indicate rotation mode is available
      document.body.style.cursor = 'grab'
    }
  }, [camera])

  const handleKeyUp = useCallback((e: KeyboardEvent): void => {
    // Check if control or meta key is released
    if (e.key === 'Control' || e.key === 'Meta' || (!e.ctrlKey && !e.metaKey && isControlPressed.current)) {
      isControlPressed.current = false
      
      // Reset cursor
      document.body.style.cursor = ''
      
      // Re-enable controls if they were disabled
      if (controls && 'setEnabled' in controls) {
        ;(controls as any).setEnabled(true)
      }
    }
  }, [controls])

  const handleMouseDown = useCallback((e: MouseEvent): void => {
    // Check both our ref and the event's ctrlKey/metaKey properties
    const controlIsPressed = isControlPressed.current || e.ctrlKey || e.metaKey
    
    if (controlIsPressed) {
      // Update our ref in case we detected it from the event
      isControlPressed.current = true
      
      // Initialize dragging state
      isDragging.current = true
      lastMousePosition.current = { x: e.clientX, y: e.clientY }
      
      // Change cursor to indicate rotation mode
      document.body.style.cursor = 'move'
      
      // Disable the default GlobeControls behavior
      if (controls && 'setEnabled' in controls) {
        ;(controls as any).setEnabled(false)
      }
      
      // Get current camera orientation for initial values
      if (camera) {
        const pov = new PointOfView()
        pov.setFromCamera(camera as Camera)
        currentHeadingRef.current = pov.heading
        currentPitchRef.current = pov.pitch
        currentDistanceRef.current = pov.distance
        console.log(`[ControlDragRotation] Starting drag with PITCH: ${degrees(pov.pitch).toFixed(2)}° HEADING: ${degrees(pov.heading).toFixed(2)}° DISTANCE: ${pov.distance.toFixed(2)}`)
      }
      
      // Prevent default behavior
      e.stopPropagation()
      e.preventDefault()
    }
  }, [controls])

  const handleMouseMove = useCallback((e: MouseEvent): void => {
    // Always check the event's ctrlKey/metaKey properties first, then our ref
    const controlIsPressed = e.ctrlKey || e.metaKey || isControlPressed.current
    
    // Update our ref if control is pressed in the event
    if (e.ctrlKey || e.metaKey) {
      isControlPressed.current = true
    }
    
    // Log pitch and heading when control is pressed, regardless of dragging state
    if (controlIsPressed && camera) {
      const pov = new PointOfView()
      pov.setFromCamera(camera as Camera)
      
      // Always update all refs with the current camera values
      currentHeadingRef.current = pov.heading
      currentPitchRef.current = pov.pitch
      currentDistanceRef.current = pov.distance
      
      console.log(`PITCH: ${degrees(pov.pitch).toFixed(2)}° HEADING: ${degrees(pov.heading).toFixed(2)}° DISTANCE: ${pov.distance.toFixed(2)}`)
    }
    
    // Process any mouse move with control key pressed and if we're dragging
    if (controlIsPressed) {
      // If we're not already dragging, start dragging
      if (!isDragging.current) {
        isDragging.current = true;
        lastMousePosition.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const deltaX = e.clientX - lastMousePosition.current.x
      const deltaY = e.clientY - lastMousePosition.current.y
      
      // Only process if there's actual movement
      if (deltaX !== 0 || deltaY !== 0) {
        console.log('[ControlDragRotation] Mouse move delta:', { deltaX, deltaY })
        
        try {
          // Make sure controls are disabled
          if (controls && 'setEnabled' in controls) {
            ;(controls as any).setEnabled(false)
          }
          
          // Sensitivity factor for rotation - increased for more noticeable movement
          const sensitivity = 0.5
          
          // Get current values from our refs
          const currentHeading = currentHeadingRef.current
          const currentPitch = currentPitchRef.current
          
          console.log('[ControlDragRotation] Current values - heading:', degrees(currentHeading).toFixed(2), 'pitch:', degrees(currentPitch).toFixed(2))
          
          // Apply the new orientation based on mouse movement
          // Invert deltaX for more intuitive rotation (drag right to rotate right)
          const newHeading = currentHeading - radians(deltaX * sensitivity)
          
          // Calculate raw pitch before clamping
          // Note: Invert deltaY for more intuitive pitch control
          const rawNewPitch = currentPitch + radians(deltaY * sensitivity)
          
          // Apply limits to avoid gimbal lock
          const newPitch = Math.max(
            radians(-89), // Limit to avoid gimbal lock
            Math.min(radians(89), rawNewPitch)
          )
          
          console.log('[ControlDragRotation] Calculated new pitch:', degrees(newPitch).toFixed(2), 'from current:', degrees(currentPitch).toFixed(2), 'delta:', deltaY, 'raw:', degrees(rawNewPitch).toFixed(2))
          
          // Update our refs with the new values
          currentHeadingRef.current = newHeading
          currentPitchRef.current = newPitch
          
          // Convert to degrees for the event
          const pitchDegrees = degrees(newPitch)
          const headingDegrees = degrees(newHeading)
          
          // Logging is already done when mouse moves with control pressed
          
          // Create event detail with exact values including distance
          const eventDetail = {
            pitch: pitchDegrees,
            heading: headingDegrees,
            distance: currentDistanceRef.current
          }
          
          // Dispatch a custom event with the new pitch and heading values
          const pitchHeadingEvent = new CustomEvent(PITCH_HEADING_CHANGE_EVENT, {
            detail: eventDetail,
            bubbles: true,
            cancelable: true
          })
          
          console.log('[ControlDragRotation] DISPATCHING EVENT with detail:', eventDetail)
          
          // Dispatch the event
          document.dispatchEvent(pitchHeadingEvent)
          console.log('[ControlDragRotation] EVENT DISPATCHED')
        } catch (error) {
          console.error('[ControlDragRotation] Error updating pitch and heading:', error)
        }
      }
      
      // Only update last mouse position if we're in control-drag mode
      lastMousePosition.current = { x: e.clientX, y: e.clientY }
      
      // If we're in control+drag mode, prevent default behavior
      e.stopPropagation()
      e.preventDefault()
    }
  }, [controls])

  const handleMouseUp = useCallback((): void => {
    // Always log mouse up event
    
    if (isDragging.current) {
      
      // Reset cursor
      document.body.style.cursor = ''
      
      // Re-enable the default GlobeControls behavior
      if (controls && 'setEnabled' in controls) {
        ;(controls as any).setEnabled(true)
      }
    }
    isDragging.current = false
  }, [controls])

  const handleBlur = useCallback((): void => {
    isControlPressed.current = false
    isDragging.current = false
    document.body.style.cursor = ''
    
    // Re-enable controls
    if (controls && 'setEnabled' in controls) {
      ;(controls as any).setEnabled(true)
    }
  }, [controls])

  useEffect(() => {
    if (!controls || !camera) {
      return;
    }

    
    // Log initial camera state
    const pov = new PointOfView()
    pov.setFromCamera(camera)

    // Use the handleMouseUp callback defined earlier

    // Get the canvas element for mouse events
    const canvas = document.querySelector('canvas')
    if (!canvas) {
      console.error('[ControlDragRotation] Canvas element not found')
    } else {
    }
    
    // Create wrapper functions for type casting
    const mouseDownHandler = (e: Event): void => {
      handleMouseDown(e as MouseEvent)
    }
    
    const mouseMoveHandler = (e: Event): void => {
      handleMouseMove(e as MouseEvent)
    }
    
    const mouseUpHandler = (e: Event): void => {
      handleMouseUp()
    }
    
    // Add event listeners for keyboard
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })
    
    // For mouse events, try to use the canvas if available, otherwise fall back to document
    const mouseTarget = canvas || document
    
    // Make sure to attach to both document and canvas for better coverage
    document.addEventListener('mousedown', mouseDownHandler, { capture: true })
    mouseTarget.addEventListener('mousedown', mouseDownHandler, { capture: true })
    
    document.addEventListener('mousemove', mouseMoveHandler, { capture: true })
    
    document.addEventListener('mouseup', mouseUpHandler, { capture: true })
    mouseTarget.addEventListener('mouseup', mouseUpHandler, { capture: true })
    
    // Add direct event listeners for mouse events
    const directMouseDownHandler = () => {
    }
    
    const directMouseUpHandler = () => {
    }
    
    document.addEventListener('mousedown', directMouseDownHandler, { capture: true })
    document.addEventListener('mouseup', directMouseUpHandler, { capture: true })
    
    // Log to confirm listeners are attached
    
    // Log initial pitch and heading values
    
    // Add blur event listener to reset state when window loses focus
    
    window.addEventListener('blur', handleBlur, { capture: true })

    // Cleanup
    return (): void => {
      
      // Reset cursor just in case
      document.body.style.cursor = ''
      
      // Re-enable the default GlobeControls behavior
      if (controls && 'setEnabled' in controls) {
        ;(controls as any).setEnabled(true)
      }
      
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
      window.removeEventListener('blur', handleBlur, { capture: true })
      
      const mouseTarget = canvas || document
      document.removeEventListener('mousedown', mouseDownHandler, { capture: true })
      mouseTarget.removeEventListener('mousedown', mouseDownHandler, { capture: true })
      
      document.removeEventListener('mousemove', mouseMoveHandler, { capture: true })
      
      document.removeEventListener('mouseup', mouseUpHandler, { capture: true })
      mouseTarget.removeEventListener('mouseup', mouseUpHandler, { capture: true })
      
      // Remove direct event listeners
      document.removeEventListener('mousedown', directMouseDownHandler, { capture: true })
      document.removeEventListener('mouseup', directMouseUpHandler, { capture: true })
    }
  }, [camera, controls, handleKeyDown, handleKeyUp, handleBlur])
}
