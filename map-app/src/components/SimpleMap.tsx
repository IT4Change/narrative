import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Simple test component to verify Leaflet works
 */
export function SimpleMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    console.log('Initializing map...');

    try {
      const map = L.map(containerRef.current).setView([51.505, -0.09], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add a test marker
      L.marker([51.505, -0.09])
        .addTo(map)
        .bindPopup('Test marker!')
        .openPopup();

      mapRef.current = map;

      console.log('Map initialized successfully!');

      // Force resize after a short delay
      setTimeout(() => {
        map.invalidateSize();
        console.log('Map size invalidated');
      }, 100);

      return () => {
        console.log('Cleaning up map...');
        map.remove();
        mapRef.current = null;
      };
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'white',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          zIndex: 1000,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '18px' }}>Simple Map Test</h2>
        <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}>
          If you see this and a map with a marker, Leaflet works!
        </p>
      </div>
    </div>
  );
}
