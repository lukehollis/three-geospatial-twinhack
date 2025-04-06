import React, { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { Geodetic } from '@takram/three-geospatial';
import { Object3D, Vector3 } from 'three';

// Define a city data interface
interface CityData {
  name: string;
  longitude: number;
  latitude: number;
  population?: number; // Optional, can be used for filtering or sizing
}

// Sample city data - you can replace this with a more comprehensive dataset
const majorCities: CityData[] = [
  { name: 'New York', longitude: -74.006, latitude: 40.7128, population: 8419000 },
  { name: 'London', longitude: -0.1278, latitude: 51.5074, population: 8982000 },
  { name: 'Tokyo', longitude: 139.6503, latitude: 35.6762, population: 13960000 },
  { name: 'Paris', longitude: 2.3522, latitude: 48.8566, population: 2161000 },
  { name: 'Sydney', longitude: 151.2093, latitude: -33.8688, population: 5312000 },
  { name: 'Los Angeles', longitude: -118.2437, latitude: 34.0522, population: 3990000 },
  { name: 'Chicago', longitude: -87.6298, latitude: 41.8781, population: 2705000 },
  { name: 'Beijing', longitude: 116.4074, latitude: 39.9042, population: 21540000 },
  { name: 'Moscow', longitude: 37.6173, latitude: 55.7558, population: 12500000 },
  { name: 'Mumbai', longitude: 72.8777, latitude: 19.0760, population: 12440000 },
  { name: 'Berlin', longitude: 13.4050, latitude: 52.5200, population: 3670000 },
  { name: 'Mexico City', longitude: -99.1332, latitude: 19.4326, population: 9210000 },
  { name: 'São Paulo', longitude: -46.6333, latitude: -23.5505, population: 12330000 },
  { name: 'Cairo', longitude: 31.2357, latitude: 30.0444, population: 9540000 },
  { name: 'Seoul', longitude: 126.9780, latitude: 37.5665, population: 9776000 },
];

// Convert degrees to radians
const toRadians = (degrees: number) => degrees * Math.PI / 180;

interface CityLabelsProps {
  minPopulation?: number; // Optional filter for city size
  labelScale?: number; // Scale factor for labels
  distanceScale?: number; // How far labels should be from the globe surface
}

const CityLabels: React.FC<CityLabelsProps> = ({ 
  minPopulation = 0, 
  labelScale = 1,
  distanceScale = 1.02 // Slightly above the globe surface
}) => {
  const { camera, gl, scene } = useThree();
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const labelsRef = useRef<Object3D>(new Object3D());
  const [cities, setCities] = useState<CityData[]>([]);
  
  // Filter cities based on population
  useEffect(() => {
    setCities(majorCities.filter(city => !minPopulation || (city.population || 0) >= minPopulation));
  }, [minPopulation]);

  // Initialize CSS2DRenderer
  useEffect(() => {
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none'; // Let mouse events pass through
    document.body.appendChild(labelRenderer.domElement);
    
    labelRendererRef.current = labelRenderer;
    
    // Add the labels object to the scene
    scene.add(labelsRef.current);
    
    // Handle window resize
    const handleResize = () => {
      if (labelRenderer) {
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (labelRenderer && labelRenderer.domElement && labelRenderer.domElement.parentNode) {
        labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);
      }
      if (labelsRef.current) {
        scene.remove(labelsRef.current);
      }
    };
  }, [scene]);

  // Create city labels
  useEffect(() => {
    // Clear existing labels
    while (labelsRef.current.children.length > 0) {
      labelsRef.current.remove(labelsRef.current.children[0]);
    }
    
    // Create new labels for each city
    cities.forEach(city => {
      // Convert geodetic coordinates to Cartesian
      const geodetic = new Geodetic(
        toRadians(city.longitude),
        toRadians(city.latitude)
      );
      
      // Get the position on the globe
      const position = geodetic.toECEF();
      
      // Scale the position to place the label slightly above the surface
      const scaledPosition = position.clone().multiplyScalar(distanceScale);
      
      // Create the label element
      const labelDiv = document.createElement('div');
      labelDiv.className = 'city-label';
      labelDiv.textContent = city.name;
      labelDiv.style.color = 'white';
      labelDiv.style.padding = '2px 4px';
      labelDiv.style.fontSize = `${10 * labelScale}px`;
      labelDiv.style.fontWeight = 'bold';
      labelDiv.style.textShadow = '0 0 3px black, 0 0 3px black, 0 0 3px black, 0 0 3px black';
      labelDiv.style.pointerEvents = 'none';
      
      // Create the CSS2D object and position it
      const label = new CSS2DObject(labelDiv);
      label.position.copy(scaledPosition);
      
      // Add the label to our container
      labelsRef.current.add(label);
    });
  }, [cities, labelScale, distanceScale]);

  // Render the labels on each frame
  useFrame(() => {
    if (labelRendererRef.current) {
      labelRendererRef.current.render(scene, camera);
    }
    
    // Optional: Hide labels that are facing away from the camera
    labelsRef.current.children.forEach((child) => {
      const label = child as CSS2DObject;
      const position = label.position.clone();
      const cameraPosition = camera.position.clone();
      
      // Calculate dot product to determine if label is facing the camera
      const dot = position.normalize().dot(cameraPosition.normalize());
      
      // Hide labels facing away from the camera
      if (label.element) {
        label.element.style.opacity = dot > 0 ? '1' : '0';
      }
    });
  });

  return null; // This component doesn't render any React elements directly
};

export default CityLabels;
