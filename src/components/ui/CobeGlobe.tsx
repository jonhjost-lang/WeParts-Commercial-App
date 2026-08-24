import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

export interface GlobeMarker { id: string; location: [number, number]; label: string }
interface CobeGlobeProps { markers: GlobeMarker[]; focusLocation: [number, number]; className?: string }

function targetAngles([latitude, longitude]: [number, number]) {
  return {
    phi: -longitude * Math.PI / 180 - Math.PI / 2,
    theta: latitude * Math.PI / 180,
  };
}

export default function CobeGlobe({ markers, focusLocation, className = '' }: CobeGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const focusRef = useRef(targetAngles(focusLocation));
  const selectedLocationRef = useRef(focusLocation);
  const selectedKeyRef = useRef(focusLocation.join(','));
  const startAnimationRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const nextKey = focusLocation.join(',');
    selectedLocationRef.current = focusLocation;
    if (nextKey === selectedKeyRef.current) return;
    selectedKeyRef.current = nextKey;
    focusRef.current = targetAngles(focusLocation);
    startAnimationRef.current();
  }, [focusLocation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let frame = 0;
    let running = false;
    let isVisible = true;
    let lastRender = 0;
    let warmupUntil = performance.now() + 700;
    let phi = focusRef.current.phi;
    let theta = focusRef.current.theta;
    const initialFocus = focusRef.current;
    const size = Math.max(canvas.clientWidth, 280);
    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio, 0.85), width: size, height: size,
      phi, theta, dark: 1, diffuse: 1.4, mapSamples: 4500, mapBrightness: 8,
      baseColor: [0.18, 0.2, 0.22], markerColor: [0.9, 0.05, 0.27], glowColor: [0.92, 0.94, 0.95],
      markerElevation: 0.025, markers: markers.map((marker) => ({ id: marker.id, location: marker.location, size: Math.abs(targetAngles(marker.location).phi - initialFocus.phi) < .001 ? 0.085 : 0.045 })),
    });
    const animate = (now: number) => {
      frame = 0;
      if (disposed || !isVisible || document.visibilityState !== 'visible') { running = false; return; }
      if (now - lastRender < 32) { frame = window.requestAnimationFrame(animate); return; }

      lastRender = now;
      const target = focusRef.current;
      const rawDelta = target.phi - phi;
      const shortestDelta = Math.atan2(Math.sin(rawDelta), Math.cos(rawDelta));
      const thetaDelta = target.theta - theta;
      phi += Math.sign(shortestDelta) * Math.min(Math.abs(shortestDelta) * 0.13, 0.085);
      theta += thetaDelta * 0.11;
      const selected = selectedLocationRef.current;
      globe.update({ phi, theta, markers: markers.map((marker) => ({ id: marker.id, location: marker.location, size: marker.location[0] === selected[0] && marker.location[1] === selected[1] ? 0.09 : 0.04 })) });

      const settled = Math.abs(shortestDelta) < 0.0005 && Math.abs(thetaDelta) < 0.0005;
      if (!settled || now < warmupUntil) {
        frame = window.requestAnimationFrame(animate);
      } else {
        running = false;
      }
    };
    const startAnimation = () => {
      if (disposed || running || !isVisible || document.visibilityState !== 'visible') return;
      running = true;
      warmupUntil = performance.now() + 300;
      frame = window.requestAnimationFrame(animate);
    };
    startAnimationRef.current = startAnimation;

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) startAnimation();
      else if (frame) { window.cancelAnimationFrame(frame); frame = 0; running = false; }
    }, { threshold: 0.05 });
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') startAnimation();
      else if (frame) { window.cancelAnimationFrame(frame); frame = 0; running = false; }
    };
    observer.observe(canvas);
    document.addEventListener('visibilitychange', handleVisibility);
    startAnimation();
    return () => {
      disposed = true;
      startAnimationRef.current = () => undefined;
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      globe.destroy();
    };
  }, [markers]);

  return <div className={`cobe-globe ${className}`}><canvas ref={canvasRef} aria-label="Interactive globe showing pickup locations" /><div className="globe-focus-label"><span />{markers.find((marker) => marker.location[0] === focusLocation[0] && marker.location[1] === focusLocation[1])?.label}</div></div>;
}
