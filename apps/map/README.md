
![map_example_2](https://github.com/user-attachments/assets/98518d15-28c6-4b39-aca0-643d858a7c97)

# GeoJSON Renderer for Three.js Geospatial Visualization

This document explains how the GeoJSON renderer interprets GeoJSON data and displays it in Three.js within our geospatial visualization application.

## Overview

The GeoJSON renderer is responsible for converting standard GeoJSON objects into Three.js 3D meshes and positioning them correctly on the globe. This allows for dynamic visualization of geographic features such as points, polygons, and lines in 3D space.

## Data Flow

1. **Input Data**: The renderer receives GeoJSON data from the backend API via the `geojsonDataAtom` Jotai atom.
2. **Processing**: The GeoJSON is parsed and converted into Three.js geometries.
3. **Rendering**: The resulting meshes are added to the Three.js scene and positioned at the correct geographic coordinates.

## Coordinate Conversion

The renderer converts geographic coordinates (latitude/longitude) to 3D space using the `@takram/three-geospatial` library:

```typescript
const latLngToVector3 = (lat: number, lng: number, height: number = 0): THREE.Vector3 => {
  const geodetic = new Geodetic(radians(lng), radians(lat), height);
  const position = new THREE.Vector3();
  geodetic.toECEF(position);
  return position;
};
```

This converts from geodetic coordinates (lat/lng) to Earth-Centered, Earth-Fixed (ECEF) coordinates, which is the 3D coordinate system used by the globe.

## GeoJSON Type Handling

The renderer supports different GeoJSON geometry types and creates appropriate Three.js geometries:

Here's a quick example: 
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  },
  "properties": {
    "model": "https://example.com/path/to/model.glb",
    "modelScale": 1.0,
    "modelRotation": [0, 0, 0],
    "color": "#FF0000",
    "height": 100
  }
}
```

### Points

For point features, the renderer creates a sphere:

```typescript
if (type === 'Point') {
  geometry = new THREE.SphereGeometry(50, 32, 32);
}
```

### Polygons

For polygon features, the renderer creates an extruded shape:

1. It extracts the outer ring of coordinates from the polygon
2. Creates a 2D shape using Three.js `Shape`
3. Converts the polygon coordinates to local space relative to the center point
4. Applies a scale factor based on latitude (to account for the Mercator projection distortion)
5. Extrudes the shape to create a 3D geometry

```typescript
const shape = new THREE.Shape();
const [centerLat, centerLng] = coordinates;
const scale = 0.0001 / Math.cos(centerLat * Math.PI / 180);

// Add points to shape...

const extrudeSettings = {
  steps: 1,
  depth: height,
  bevelEnabled: false,
};

geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
```

### LineStrings

For line features, the renderer creates a tube geometry:

```typescript
geometry = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, height, 0)
  ]),
  20, 
  20, 
  8, 
  false
);
```

### Fallback

For unsupported types, the renderer creates a simple cube as a fallback:

```typescript
geometry = new THREE.BoxGeometry(100, height, 100);
```

## Styling and Appearance

The renderer applies styling based on properties in the GeoJSON:

```typescript
const color = properties.color || '#FF0000';
const height = properties.height || 100;

const material = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(color),
  transparent: true,
  opacity: 0.8,
  side: THREE.DoubleSide,
  metalness: 0.2,
  roughness: 0.5,
  clearcoat: 0.5,
  clearcoatRoughness: 0.2,
  emissive: new THREE.Color(color).multiplyScalar(0.2), // Slight glow
});
```

## Positioning and Orientation

After creating the mesh, the renderer:

1. Positions it at the correct coordinates using the `latLngToVector3` function
2. Orients it to be perpendicular to the Earth's surface
3. Scales it to make it more visible
4. Adds lighting to enhance visibility

```typescript
const position = latLngToVector3(lat, lng);
mesh.position.copy(position);

// Orient the mesh to be perpendicular to the surface
const up = position.clone().normalize();
const axis = new THREE.Vector3(0, 1, 0);
const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, up);
mesh.quaternion.copy(quaternion);

// Scale the mesh
mesh.scale.multiplyScalar(OBJECT_SCALE);
```


## Camera Control

When a new object is added, the renderer automatically zooms to its location:

```typescript
zoomToCoordinates(lat, lng, 1000);
```

## Troubleshooting

If objects are not visible, consider:

1. **Scale Issues**: The objects might be too small or too large. Adjust the `OBJECT_SCALE` constant.
2. **Positioning Issues**: Check the conversion from lat/lng to 3D coordinates.
3. **Visibility Issues**: Objects might be positioned below the map surface or too far above it.
4. **Camera Issues**: The camera might not be looking at the correct position.
5. **Z-fighting**: Objects might be at the same depth as map tiles, causing rendering conflicts.

## Integration

The GeoJSON renderer is integrated into the Three.js scene in `ThreeMapContainer.tsx`:

```typescript
<GeoJSONContainer geoJsonData={useAtomValue(geojsonDataAtom)} />
```
