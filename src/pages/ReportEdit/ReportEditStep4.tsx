import { useRef, useState, useEffect, useCallback } from 'preact/hooks';
import {
  Stack,
  Text,
  Box,
  Alert,
  FileInput,
  Button,
  Slider,
  Group,
  Anchor,
  Center,
  ThemeIcon,
  SegmentedControl,
  ActionIcon,
  ColorSwatch,
  Tooltip,
} from '@mantine/core';
import {
  IconDownload,
  IconExternalLink,
  IconWifiOff,
  IconEdit,
  IconCheck,
  IconX,
  IconTrash,
  IconPencil,
  IconSquare,
  IconSquareFilled,
  IconCircle,
  IconCircleFilled,
  IconPointer,
  IconEraser,
  IconArrowBackUp,
  IconArrowForwardUp,
} from '@tabler/icons-react';
import type { Report } from '../../types/Report';
import { useConnectivity } from '../../hooks/useConnectivity';

/* ── Constants ─────────────────────────────────────────────── */

const DEFAULT_LAT = 4.5709;
const DEFAULT_LON = -74.2973;
const TILE_SIZE = 256;
const GRID_W = 7; // Covers 1792px width
const GRID_H = 4; // Covers 1024px height
// Exact resolution requested by user
const CANVAS_WIDTH = 1732;
const CANVAS_HEIGHT = 974;
const ZOOM_MIN = 15;
const ZOOM_MAX = 21;
const ZOOM_DEFAULT = 17;
const MAX_NATIVE_ZOOM = 19;


/* ── Types ── */
type Tool = 'select' | 'eraser' | 'pencil' | 'square' | 'square-fill' | 'circle' | 'circle-fill';

interface BaseShape {
  id: string;
  type: string;
  color: string;
  strokeWidth: number;
  rotation?: number; // radians
}

interface RectShape extends BaseShape {
  type: 'square' | 'square-fill';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CircleShape extends BaseShape {
  type: 'circle' | 'circle-fill';
  x: number;
  y: number;
  radius: number;
}

interface PencilShape extends BaseShape {
  type: 'pencil';
  points: { x: number; y: number }[];
}

type Shape = RectShape | CircleShape | PencilShape;

/* ── Helpers ── */

/** Rotate a point (x,y) around center (cx,cy) by angle (radians). */
const rotatePoint = (x: number, y: number, cx: number, cy: number, angle: number) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
};

/* ── Tile math ─────────────────────────────────────────────── */

function latLonToTile(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x, y };
}

/** Load a single OSM or Satellite tile as an Image. Supports digital zoom beyond MAX_NATIVE_ZOOM. */
async function loadTile(z: number, x: number, y: number, type: 'osm' | 'satellite'): Promise<CanvasImageSource> {
  if (z <= MAX_NATIVE_ZOOM) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Tile ${z}/${x}/${y} failed`));
      if (type === 'satellite') {
        // Esri World Imagery (uses z/y/x ordering in REST URL)
        img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
      } else {
        // OpenStreetMap (standard z/x/y)
        img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
      }
    });
  }

  // Overzoom logic: fetch parent tile from MAX_NATIVE_ZOOM and crop/scale
  const scale = 2 ** (z - MAX_NATIVE_ZOOM);
  const xParent = Math.floor(x / scale);
  const yParent = Math.floor(y / scale);
  
  const parentImg = await loadTile(MAX_NATIVE_ZOOM, xParent, yParent, type);

  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  const cropSize = TILE_SIZE / scale;
  const srcX = (x % scale) * cropSize;
  const srcY = (y % scale) * cropSize;

  ctx.drawImage(parentImg, srcX, srcY, cropSize, cropSize, 0, 0, TILE_SIZE, TILE_SIZE);
  return canvas;
}

/** Render a GRID×GRID tile mosaic centered on (lat, lon) onto the given canvas. */
async function renderTilesToCanvas(
  canvas: HTMLCanvasElement,
  lat: number,
  lon: number,
  zoom: number,
  type: 'osm' | 'satellite',
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Handle fractional zoom:
  // We load tiles for the integer zoom level (intZoom)
  // and scale the canvas context by the fractional difference.
  const intZoom = Math.floor(zoom);
  const scale = 2 ** (zoom - intZoom);

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Reset transform to identity before clearing
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Clear with a neutral background while tiles load
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const center = latLonToTile(lat, lon, intZoom);
  const max = 2 ** intZoom - 1;
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  const halfW = Math.floor(GRID_W / 2);
  const halfH = Math.floor(GRID_H / 2);

  // Calculate offsets to center the TILE_SIZE*GRID grid within the custom CANVAS size
  const gridPixelWidth = GRID_W * TILE_SIZE;
  const gridPixelHeight = GRID_H * TILE_SIZE;
  const offsetX = (CANVAS_WIDTH - gridPixelWidth) / 2;
  const offsetY = (CANVAS_HEIGHT - gridPixelHeight) / 2;

  // Apply scaling for fractional zoom, centered on the canvas
  const scaleCx = CANVAS_WIDTH / 2;
  const scaleCy = CANVAS_HEIGHT / 2;
  ctx.translate(scaleCx, scaleCy);
  ctx.scale(scale, scale);
  ctx.translate(-scaleCx, -scaleCy);

  for (let dy = 0; dy < GRID_H; dy++) {
    for (let dx = 0; dx < GRID_W; dx++) {
      const tx = clamp(center.x - halfW + dx);
      const ty = clamp(center.y - halfH + dy);
      const drawX = Math.floor(dx * TILE_SIZE + offsetX);
      const drawY = Math.floor(dy * TILE_SIZE + offsetY);

      try {
        const img = await loadTile(intZoom, tx, ty, type);
        ctx.drawImage(img, drawX, drawY, TILE_SIZE, TILE_SIZE);
      } catch {
        ctx.fillStyle = '#ddd';
        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Reset transform to draw crosshair crisp and centered (ignoring zoom scale? No, crosshair should stay centered)
  // Actually, usually crosshair is UI overlay, but here it is burnt into canvas.
  // If we scale the map, we probably want the crosshair to remain constant size or scale?
  // Constant size is usually better for a "sight".
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Draw crosshair at center
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  ctx.strokeStyle = 'rgba(220, 50, 50, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy);
  ctx.lineTo(cx + 12, cy);
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx, cy + 12);
  ctx.stroke();
}

/* ── Component ─────────────────────────────────────────────── */

interface ReportEditStep4Props {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

export function ReportEditStep4({ report, setReport, readOnly }: ReportEditStep4Props) {
  const hasCoords = report.address.latitude !== 0 || report.address.longitude !== 0;
  const lat = hasCoords ? report.address.latitude : DEFAULT_LAT;
  const lon = hasCoords ? report.address.longitude : DEFAULT_LON;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [mapType, setMapType] = useState<'osm' | 'satellite'>('osm');
  const [loading, setLoading] = useState(false);
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const isOnline = useConnectivity();

  /* ── Editor State ── */
  const [isEditing, setIsEditing] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [drawColor, setDrawColor] = useState('#fa5252'); // Red
  
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [history, setHistory] = useState<Shape[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  const [transformMode, setTransformMode] = useState<'scale' | 'rotate'>('scale');

  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const interactionRef = useRef<{
    isDown: boolean;
    startPos: { x: number; y: number };
    currentShape?: Shape;
    movingShapeStart?: Shape; // Snapshot of shape before move/resize
    resizeHandle?: string; // 'tl', 'tr', 'bl', 'br'
    lastMousePos?: { x: number; y: number };
    startRotation?: number; // for rotation
  }>({
    isDown: false,
    startPos: { x: 0, y: 0 },
  });

  const hasEditedMap = Boolean(report.edited_map_image_url?.trim());

  // Re-render tiles whenever lat, lon or zoom changes
  useEffect(() => {
    if (!isOnline) {
      setLoading(false);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setLoading(true);
    renderTilesToCanvas(canvas, lat, lon, zoom, mapType).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [lat, lon, zoom, isOnline, mapType]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `mapa-sitio-${report.address.pm_number || report.id}.png`;
    a.click();
  }, [report.address.pm_number, report.id]);

  const onDiagramFileChange = (file: File | null) => {
    setImageWarning(null);
    if (!file) {
      setReport({ ...report, edited_map_image_url: undefined, updated_at: Date.now() });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      
      // Validate image dimensions/ratio
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const ratio = width / height;
        // Ideal: ~1.77 (16:9). Accept 1.5 to 2.0. Min width 1000px.
        const isRatioOk = ratio >= 1.5 && ratio <= 2.2;
        const isResOk = width >= 1000;
        
        if (!isRatioOk || !isResOk) {
          setImageWarning(
            'Para un ajuste perfecto en el PDF, se recomienda una imagen de 1732x974 píxeles (aprox. 16:9) y alta resolución.'
          );
        }
        setReport({ ...report, edited_map_image_url: result, updated_at: Date.now() });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const clearDiagram = () => {
    setImageWarning(null);
    setReport({ ...report, edited_map_image_url: undefined, updated_at: Date.now() });
  };

  /* ── Editor Logic ── */

  // Sync internal state with ref for events
  const shapesRef = useRef<Shape[]>([]);
  useEffect(() => {
    shapesRef.current = shapes;
    renderCanvas();
  }, [shapes, selectedShapeId, hoveredShapeId, transformMode]);

  // Handle undo/redo shortcuts or buttons
  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setShapes(history[newIndex]);
      setSelectedShapeId(null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setShapes(history[newIndex]);
      setSelectedShapeId(null);
    }
  };

  const pushHistory = (newShapes: Shape[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newShapes);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setShapes(newShapes);
  };
  
  // Initialize history
  useEffect(() => {
    if (isEditing && history.length === 0) {
      setHistory([[]]);
      setHistoryIndex(0);
    }
  }, [isEditing]);

  const deleteSelected = () => {
    if (selectedShapeId) {
      const newShapes = shapes.filter((s) => s.id !== selectedShapeId);
      pushHistory(newShapes);
      setSelectedShapeId(null);
    }
  };

  const renderCanvas = () => {
    const canvas = drawingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all shapes
    shapesRef.current.forEach(shape => {
      ctx.save();
      ctx.lineWidth = shape.strokeWidth;
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const rotation = shape.rotation || 0;
      let cx = 0, cy = 0;

      // Draw Shape
      if (shape.type === 'pencil') {
        const s = shape as PencilShape;
        if (s.points.length > 0) {
            const xs = s.points.map(p => p.x);
            const ys = s.points.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            cx = (minX + maxX) / 2;
            cy = (minY + maxY) / 2;
            
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            ctx.translate(-cx, -cy);
            
            ctx.beginPath();
            ctx.moveTo(s.points[0].x, s.points[0].y);
            s.points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        }
      } else if (shape.type === 'square' || shape.type === 'square-fill') {
        const s = shape as RectShape;
        cx = s.x + s.width / 2;
        cy = s.y + s.height / 2;

        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        
        ctx.beginPath();
        if (s.type === 'square-fill') {
            ctx.fillRect(-s.width / 2, -s.height / 2, s.width, s.height);
        } else {
            ctx.strokeRect(-s.width / 2, -s.height / 2, s.width, s.height);
        }
      } else if (shape.type === 'circle' || shape.type === 'circle-fill') {
        const s = shape as CircleShape;
        cx = s.x;
        cy = s.y;
        
        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        ctx.beginPath();
        ctx.arc(0, 0, s.radius, 0, 2 * Math.PI);
        if (s.type === 'circle-fill') ctx.fill();
        else ctx.stroke();
      }
      ctx.restore();
    });

    // Draw selection overlay
    if (selectedShapeId) {
      const shape = shapesRef.current.find(s => s.id === selectedShapeId);
      if (shape) {
        ctx.save();
        
        const rotation = shape.rotation || 0;
        let bounds = { w: 0, h: 0 };
        let cx = 0, cy = 0;

        if (shape.type === 'pencil') {
           const s = shape as PencilShape;
           const xs = s.points.map(p => p.x);
           const ys = s.points.map(p => p.y);
           const minX = Math.min(...xs);
           const maxX = Math.max(...xs);
           const minY = Math.min(...ys);
           const maxY = Math.max(...ys);
           bounds = { w: maxX - minX, h: maxY - minY };
           cx = minX + bounds.w / 2;
           cy = minY + bounds.h / 2;
        } else if (shape.type.includes('square')) {
           const s = shape as RectShape;
           bounds = { w: s.width, h: s.height };
           cx = s.x + s.width / 2;
           cy = s.y + s.height / 2;
        } else if (shape.type.includes('circle')) {
           const s = shape as CircleShape;
           bounds = { w: s.radius * 2, h: s.radius * 2 };
           cx = s.x;
           cy = s.y;
        }

        // Apply transform to draw selection box at center
        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        const halfW = bounds.w / 2;
        const halfH = bounds.h / 2;
        
        // Selection Box Style
        ctx.strokeStyle = transformMode === 'rotate' ? '#e67e22' : '#00a8ff'; // Orange for rotate, Blue for scale
        ctx.lineWidth = 1;
        ctx.setLineDash(transformMode === 'rotate' ? [] : [5, 5]); // Solid for rotate, dashed for scale
        
        ctx.strokeRect(-halfW - 5, -halfH - 5, bounds.w + 10, bounds.h + 10);
        
        // Handles
        ctx.setLineDash([]);
        ctx.fillStyle = '#fff';
        const handleSize = 8;
        const half = handleSize / 2;
        
        const corners = [
            { x: -halfW - 5, y: -halfH - 5 }, // TL
            { x: halfW + 5, y: -halfH - 5 }, // TR
            { x: -halfW - 5, y: halfH + 5 }, // BL
            { x: halfW + 5, y: halfH + 5 }, // BR
        ];

        corners.forEach(c => {
            ctx.beginPath();
            if (transformMode === 'rotate') {
                ctx.arc(c.x, c.y, handleSize/2, 0, 2 * Math.PI); // Circle handles for rotate
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillRect(c.x - half, c.y - half, handleSize, handleSize); // Square handles for scale
                ctx.strokeRect(c.x - half, c.y - half, handleSize, handleSize);
            }
        });

        // Center Point (Pivot)
        if (transformMode === 'rotate') {
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.restore();
      }
    }
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = tempCanvasRef.current || drawingCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const hitTest = (x: number, y: number): { shapeId: string | null, handle: string | null } => {
     // Check handles first if selected
     if (selectedShapeId) {
         const shape = shapesRef.current.find(s => s.id === selectedShapeId);
         if (shape) {
             let cx = 0, cy = 0;
             let halfW = 0, halfH = 0;
             
             // Calculate local center and dimensions
             if (shape.type === 'pencil') {
                const s = shape as PencilShape;
                const xs = s.points.map(p => p.x);
                const ys = s.points.map(p => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                cx = (minX + maxX) / 2;
                cy = (minY + maxY) / 2;
                halfW = (maxX - minX) / 2;
                halfH = (maxY - minY) / 2;
             } else if (shape.type.includes('square')) {
                const s = shape as RectShape;
                cx = s.x + s.width / 2;
                cy = s.y + s.height / 2;
                halfW = s.width / 2;
                halfH = s.height / 2;
             } else if (shape.type.includes('circle')) {
                const s = shape as CircleShape;
                cx = s.x;
                cy = s.y;
                halfW = s.radius;
                halfH = s.radius;
             }
             
             // Transform mouse into shape local space (un-rotate)
             const angle = -(shape.rotation || 0);
             const local = rotatePoint(x, y, cx, cy, angle);
             
             const margin = 10;
             const corners = {
                 tl: { x: cx - halfW - 5, y: cy - halfH - 5 },
                 tr: { x: cx + halfW + 5, y: cy - halfH - 5 },
                 bl: { x: cx - halfW - 5, y: cy + halfH + 5 },
                 br: { x: cx + halfW + 5, y: cy + halfH + 5 },
             };
             
             for (const [key, pos] of Object.entries(corners)) {
                 if (Math.abs(local.x - pos.x) < margin && Math.abs(local.y - pos.y) < margin) {
                     return { shapeId: selectedShapeId, handle: key };
                 }
             }
         }
     }

     // Check shapes (reverse order for top-most)
     for (let i = shapesRef.current.length - 1; i >= 0; i--) {
         const s = shapesRef.current[i];
         const rotation = s.rotation || 0;
         
         // Calculate center
         let cx = 0, cy = 0;
         if (s.type === 'pencil') {
            const p = s as PencilShape;
            const xs = p.points.map(pt => pt.x);
            const ys = p.points.map(pt => pt.y);
            cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            cy = (Math.min(...ys) + Math.max(...ys)) / 2;
         } else if (s.type.includes('square')) {
            const r = s as RectShape;
            cx = r.x + r.width / 2;
            cy = r.y + r.height / 2;
         } else if (s.type.includes('circle')) {
            const c = s as CircleShape;
            cx = c.x;
            cy = c.y;
         }
         
         // Un-rotate mouse
         const local = rotatePoint(x, y, cx, cy, -rotation);
         const lx = local.x;
         const ly = local.y;
         
         if (s.type === 'pencil') {
             const ps = (s as PencilShape).points;
             for (const p of ps) {
                 if (Math.hypot(p.x - lx, p.y - ly) < s.strokeWidth + 5) {
                     return { shapeId: s.id, handle: null };
                 }
             }
         } else if (s.type.includes('square')) {
             const r = s as RectShape;
             if (lx >= r.x && lx <= r.x + r.width && ly >= r.y && ly <= r.y + r.height) {
                 if (r.type === 'square-fill') return { shapeId: s.id, handle: null };
                 const border = 5 + r.strokeWidth;
                 const onLeft = Math.abs(lx - r.x) < border;
                 const onRight = Math.abs(lx - (r.x + r.width)) < border;
                 const onTop = Math.abs(ly - r.y) < border;
                 const onBottom = Math.abs(ly - (r.y + r.height)) < border;
                 if (onLeft || onRight || onTop || onBottom) return { shapeId: s.id, handle: null };
             }
         } else if (s.type.includes('circle')) {
             const c = s as CircleShape;
             const dist = Math.hypot(lx - c.x, ly - c.y);
             if (c.type === 'circle-fill') {
                 if (dist <= c.radius) return { shapeId: s.id, handle: null };
             } else {
                 if (Math.abs(dist - c.radius) < 5 + c.strokeWidth) return { shapeId: s.id, handle: null };
             }
         }
     }
     return { shapeId: null, handle: null };
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !selectedShapeId) return;
    const { x, y } = getCanvasCoords(e);
    const hit = hitTest(x, y);
    if (hit.shapeId === selectedShapeId) {
        setTransformMode(prev => prev === 'scale' ? 'rotate' : 'scale');
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing) return;
    const { x, y } = getCanvasCoords(e);
    
    if (activeTool === 'select' || activeTool === 'eraser') {
        const hit = hitTest(x, y);
        if (activeTool === 'eraser') {
            if (hit.shapeId) {
                const newShapes = shapes.filter(s => s.id !== hit.shapeId);
                pushHistory(newShapes);
            }
            return;
        }

        // Select mode
        if (hit.shapeId) {
            if (hit.shapeId !== selectedShapeId) {
                setSelectedShapeId(hit.shapeId);
                setTransformMode('scale'); // Reset to scale on new selection
            }
            
            interactionRef.current = {
                isDown: true,
                startPos: { x, y },
                resizeHandle: hit.handle || undefined,
                lastMousePos: { x, y },
                movingShapeStart: JSON.parse(JSON.stringify(shapesRef.current.find(s => s.id === hit.shapeId))),
                startRotation: shapesRef.current.find(s => s.id === hit.shapeId)?.rotation || 0,
            };
        } else {
            setSelectedShapeId(null);
            interactionRef.current = { isDown: false, startPos: { x: 0, y: 0 } };
        }
        return;
    }

    // Drawing mode
    interactionRef.current.isDown = true;
    interactionRef.current.startPos = { x, y };
    
    const newId = Math.random().toString(36).substr(2, 9);
    let newShape: Shape | null = null;

    if (activeTool === 'pencil') {
        newShape = { id: newId, type: 'pencil', color: drawColor, strokeWidth, points: [{ x, y }] };
    } else if (activeTool.includes('square')) {
        newShape = { id: newId, type: activeTool as any, color: drawColor, strokeWidth, x, y, width: 0, height: 0 };
    } else if (activeTool.includes('circle')) {
        newShape = { id: newId, type: activeTool as any, color: drawColor, strokeWidth, x, y, radius: 0 };
    }

    if (newShape) {
        interactionRef.current.currentShape = newShape;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing) return;
    const { x, y } = getCanvasCoords(e);
    
    // Hover effect
    if (!interactionRef.current.isDown && (activeTool === 'select' || activeTool === 'eraser')) {
       const hit = hitTest(x, y);
       if (hit.shapeId !== hoveredShapeId) setHoveredShapeId(hit.shapeId);
       
       let cursor = 'default';
       if (hit.shapeId) {
           if (activeTool === 'eraser') cursor = 'crosshair';
           else if (hit.handle) {
               if (transformMode === 'rotate') {
                   cursor = 'alias'; 
               } else {
                   cursor = (hit.handle === 'tl' || hit.handle === 'br') ? 'nwse-resize' : 'nesw-resize';
               }
           } else {
               cursor = 'move';
           }
       }
       e.currentTarget.style.cursor = cursor;
       return;
    }

    if (!interactionRef.current.isDown) return;

    if (activeTool === 'select' && selectedShapeId) {
        const dx = x - interactionRef.current.lastMousePos!.x;
        const dy = y - interactionRef.current.lastMousePos!.y;
        interactionRef.current.lastMousePos = { x, y };

        const shapeIndex = shapes.findIndex(s => s.id === selectedShapeId);
        if (shapeIndex === -1) return;
        
        const newShapes = [...shapes];
        const shape = { ...newShapes[shapeIndex] };

        if (interactionRef.current.resizeHandle) {
             const handle = interactionRef.current.resizeHandle;
             // Rotation
             if (transformMode === 'rotate') {
                 let cx = 0, cy = 0;
                 if (shape.type === 'pencil') {
                     const s = shape as PencilShape;
                     const xs = s.points.map(p => p.x);
                     const ys = s.points.map(p => p.y);
                     cx = (Math.min(...xs) + Math.max(...xs)) / 2;
                     cy = (Math.min(...ys) + Math.max(...ys)) / 2;
                 } else if (shape.type.includes('square')) {
                     const s = shape as RectShape;
                     cx = s.x + s.width / 2;
                     cy = s.y + s.height / 2;
                 } else if (shape.type.includes('circle')) {
                     const s = shape as CircleShape;
                     cx = s.x;
                     cy = s.y;
                 }
                 
                 const angle = Math.atan2(y - cy, x - cx);
                 let handleAngle = 0;
                 if (handle === 'tl') handleAngle = -Math.PI * 0.75;
                 if (handle === 'tr') handleAngle = -Math.PI * 0.25;
                 if (handle === 'br') handleAngle = Math.PI * 0.25;
                 if (handle === 'bl') handleAngle = Math.PI * 0.75;
                 
                 shape.rotation = angle - handleAngle;
                 newShapes[shapeIndex] = shape;
                 setShapes(newShapes);
                 return;
             }

             // Resize
             if (shape.type.includes('square')) {
                if (Math.abs(shape.rotation || 0) < 0.1) {
                    const r = shape as RectShape;
                    if (handle.includes('l')) { r.x += dx; r.width -= dx; }
                    if (handle.includes('r')) { r.width += dx; }
                    if (handle.includes('t')) { r.y += dy; r.height -= dy; }
                    if (handle.includes('b')) { r.height += dy; }
                }
             } else if (shape.type.includes('circle')) {
                const c = shape as CircleShape;
                const dist = Math.hypot(x - c.x, y - c.y);
                c.radius = dist;
             }
        } else {
            // Moving
            if (shape.type === 'pencil') {
                const p = shape as PencilShape;
                p.points = p.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));
            } else {
                (shape as any).x += dx;
                (shape as any).y += dy;
            }
        }
        newShapes[shapeIndex] = shape;
        setShapes(newShapes); // Live update
        return;
    }

    // Drawing
    const current = interactionRef.current.currentShape;
    if (!current) return;
    
    // We can just use the temp canvas for drawing preview
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!tempCtx) return;
    tempCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    tempCtx.lineWidth = current.strokeWidth;
    tempCtx.strokeStyle = current.color;
    tempCtx.fillStyle = current.color;
    tempCtx.lineCap = 'round';
    tempCtx.lineJoin = 'round';

    const startX = interactionRef.current.startPos.x;
    const startY = interactionRef.current.startPos.y;

    if (current.type === 'pencil') {
        const p = current as PencilShape;
        p.points.push({ x, y });
        
        // Draw path
        tempCtx.beginPath();
        if (p.points.length > 0) {
            tempCtx.moveTo(p.points[0].x, p.points[0].y);
            for (let i = 1; i < p.points.length; i++) tempCtx.lineTo(p.points[i].x, p.points[i].y);
        }
        tempCtx.stroke();
    } else {
        const width = x - startX;
        const height = y - startY;
        
        tempCtx.beginPath();
        if (current.type.includes('square')) {
            if (current.type === 'square-fill') tempCtx.fillRect(startX, startY, width, height);
            else tempCtx.strokeRect(startX, startY, width, height);
            (current as RectShape).width = width;
            (current as RectShape).height = height;
        } else if (current.type.includes('circle')) {
             const radius = Math.sqrt(width * width + height * height);
             tempCtx.arc(startX, startY, radius, 0, 2 * Math.PI);
             if (current.type === 'circle-fill') tempCtx.fill();
             else tempCtx.stroke();
             (current as CircleShape).radius = radius;
        }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditing || !interactionRef.current.isDown) return;
    interactionRef.current.isDown = false;
    
    // Clear temp
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    tempCtx?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (activeTool === 'select') {
        // Commit move/resize to history
        if (selectedShapeId && interactionRef.current.movingShapeStart) {
             // Compare with start to see if changed
             // For now just push to history
             pushHistory([...shapes]);
        }
        return;
    }

    if (interactionRef.current.currentShape) {
        // Fix negative width/height for rects
        const s = interactionRef.current.currentShape;
        if (s.type.includes('square')) {
            const r = s as RectShape;
            if (r.width < 0) { r.x += r.width; r.width = Math.abs(r.width); }
            if (r.height < 0) { r.y += r.height; r.height = Math.abs(r.height); }
        }
        
        const newShapes = [...shapes, s];
        pushHistory(newShapes);
        interactionRef.current.currentShape = undefined;
    }
  };

  const handleSaveEdit = () => {
    const mapCanvas = canvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    if (!mapCanvas || !drawingCanvas) return;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = CANVAS_WIDTH;
    finalCanvas.height = CANVAS_HEIGHT;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(mapCanvas, 0, 0);
    ctx.drawImage(drawingCanvas, 0, 0);

    const dataUrl = finalCanvas.toDataURL('image/png');
    setReport({ ...report, edited_map_image_url: dataUrl, updated_at: Date.now() });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };
  
  /* ── Shortcuts ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
        if (!isEditing) return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelected();
        }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isEditing, historyIndex, history, selectedShapeId]);

  useEffect(() => {
    if (!isEditing) return;
    const drawingCanvas = drawingCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (drawingCanvas) {
      drawingCanvas.width = CANVAS_WIDTH;
      drawingCanvas.height = CANVAS_HEIGHT;
    }
    if (tempCanvas) {
      tempCanvas.width = CANVAS_WIDTH;
      tempCanvas.height = CANVAS_HEIGHT;
    }
    // Re-render when switching to edit mode
    renderCanvas();
  }, [isEditing]);
  
  /* ── Read-only view ── */
  if (readOnly) {
    return (
      <Stack gap="lg">
        <Box>
          <Text size="sm" fw={500} c="dimmed" mb="sm">Ubicación en mapa</Text>
          {!hasCoords ? (
            <Text size="sm" c="dimmed">Sin coordenadas (complete el paso 1).</Text>
          ) : (
            <Box style={{ width: '100%', maxWidth: 800, borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
              <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
            </Box>
          )}
        </Box>
        <Box>
          <Text size="sm" fw={500} c="dimmed" mb="sm">Diagrama del sitio editado</Text>
          {hasEditedMap ? (
            <Box style={{ maxWidth: 400, border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
              <img src={report.edited_map_image_url} alt="Diagrama del sitio" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </Box>
          ) : (
            <Text size="sm" c="dimmed">—</Text>
          )}
        </Box>
      </Stack>
    );
  }

  /* ── Editable view ── */
  return (
    <Stack gap="xl">
      {/* ── Map section ── */}
      <Box
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
          overflow: 'hidden',
        }}
      >
        {isOnline ? (
          <>
            {/* Map canvas & Editor Layer */}
            <Box style={{ position: 'relative' }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              
              {/* Editor Overlay */}
              {isEditing && (
                <>
                  <canvas
                    ref={drawingCanvasRef}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  />
                  <canvas
                    ref={tempCanvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDblClick={handleDoubleClick}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'crosshair' }}
                  />
                </>
              )}

              {loading && !isEditing && (
                <Box
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.6)',
                  }}
                >
                  <Text size="sm" c="dimmed">Cargando mapa…</Text>
                </Box>
              )}
            </Box>

            {/* Controls bar below the map */}
            <Box
              style={{
                padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)',
                borderTop: '1px solid var(--mantine-color-default-border)',
                background: 'var(--mantine-color-body)',
              }}
            >
              {isEditing ? (
                /* Editor Toolbar */
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Text size="sm" fw={500}>Editor de mapa</Text>

                    <Group gap="xs">
                       <Tooltip label="Deshacer (Ctrl+Z)" withArrow>
                          <ActionIcon variant="default" size="sm" onClick={undo} disabled={historyIndex <= 0}>
                             <IconArrowBackUp size={16} />
                          </ActionIcon>
                       </Tooltip>
                       <Tooltip label="Rehacer (Ctrl+Shift+Z)" withArrow>
                          <ActionIcon variant="default" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1}>
                             <IconArrowForwardUp size={16} />
                          </ActionIcon>
                       </Tooltip>
                       <Tooltip label="Eliminar seleccionado (Supr)" withArrow>
                          <ActionIcon variant="light" color="red" size="sm" onClick={deleteSelected} disabled={!selectedShapeId}>
                             <IconTrash size={16} />
                          </ActionIcon>
                       </Tooltip>
                    </Group>
                    <Group gap="xs">
                      <Button size="xs" variant="default" onClick={handleCancelEdit} leftSection={<IconX size={14} />}>Cancelar</Button>
                      <Button size="xs" color="blue" onClick={handleSaveEdit} leftSection={<IconCheck size={14} />}>Guardar Edición</Button>
                    </Group>
                  </Group>
                  <Group align="center" gap="md" wrap="wrap">
                    {/* Tools */}
                    <SegmentedControl
                      size="xs"
                      value={activeTool}
                      onChange={(v) => setActiveTool(v as any)}
                      data={[
                        { value: 'select', label: <Tooltip label="Seleccionar / Mover / Redimensionar" withArrow><Center><IconPointer size={16} /></Center></Tooltip> },
                        { value: 'pencil', label: <Tooltip label="Lápiz" withArrow><Center><IconPencil size={16} /></Center></Tooltip> },
                        { value: 'square', label: <Tooltip label="Cuadrado (Borde)" withArrow><Center><IconSquare size={16} /></Center></Tooltip> },
                        { value: 'square-fill', label: <Tooltip label="Cuadrado (Relleno)" withArrow><Center><IconSquareFilled size={16} /></Center></Tooltip> },
                        { value: 'circle', label: <Tooltip label="Círculo (Borde)" withArrow><Center><IconCircle size={16} /></Center></Tooltip> },
                        { value: 'circle-fill', label: <Tooltip label="Círculo (Relleno)" withArrow><Center><IconCircleFilled size={16} /></Center></Tooltip> },
                        { value: 'eraser', label: <Tooltip label="Borrador (Click para eliminar)" withArrow><Center><IconEraser size={16} /></Center></Tooltip> },
                      ]}
                    />

                    {/* Colors */}
                    <Group gap={6}>
                       {['#fa5252', '#228be6', '#40c057', '#fcc419', '#000000', '#ffffff'].map((c) => (
                         <ColorSwatch
                           key={c}
                           component="button"
                           color={c}
                           onClick={() => setDrawColor(c)}
                           style={{ color: '#fff', cursor: 'pointer' }}
                           size={22}
                         >
                           {drawColor === c && <IconCheck size={12} />}
                         </ColorSwatch>
                       ))}
                    </Group>
                    
                    {/* Stroke Width */}
                    <Box style={{ width: 100 }}>
                       <Text size="xs" c="dimmed" mb={2}>Grosor: {strokeWidth}</Text>
                       <Slider
                         min={1}
                         max={10}
                         value={strokeWidth}
                         onChange={setStrokeWidth}
                         size="sm"
                       />
                    </Box>
                  </Group>
                </Stack>
              ) : (
                /* Standard Controls */
                <>
                  {!hasCoords && (
                    <Alert color="blue" mb="sm">
                      Complete la dirección en el paso 1 para ver la ubicación exacta.
                    </Alert>
                  )}

                  <Group align="flex-end" gap="md" wrap="wrap">
                    <Box>
                      <Text size="xs" fw={500} mb={4}>Tipo de mapa</Text>
                      <SegmentedControl
                        size="xs"
                        value={mapType}
                        onChange={(val) => setMapType(val as 'osm' | 'satellite')}
                        data={[
                          { label: 'Mapa', value: 'osm' },
                          { label: 'Satélite', value: 'satellite' },
                        ]}
                      />
                    </Box>
                    <Box style={{ flex: 1, minWidth: 160, paddingBottom: 16 }}>
                      <Text size="xs" fw={500} mb={4}>
                        Zoom: {zoom.toFixed(1)} {zoom > 20 && <span style={{ color: 'red' }}>(Digital)</span>}
                      </Text>
                      <Slider
                        min={ZOOM_MIN}
                        max={ZOOM_MAX}
                        step={0.1}
                        color={zoom > 20 ? 'red' : 'blue'}
                        value={zoom}
                        onChange={setZoom}
                        marks={[
                          { value: ZOOM_MIN, label: String(ZOOM_MIN) },
                          { value: 20, label: '20' },
                          { value: ZOOM_MAX, label: String(ZOOM_MAX) },
                        ]}
                      />
                    </Box>
                    
                    <Button
                        leftSection={<IconEdit size={14} />}
                        variant="filled"
                        color="grape"
                        size="xs"
                        onClick={() => setIsEditing(true)}
                        disabled={loading}
                    >
                        Editar Mapa
                    </Button>

                    <Button
                      leftSection={<IconDownload size={14} />}
                      variant="light"
                      size="xs"
                      onClick={handleDownload}
                      disabled={loading}
                    >
                      Descargar
                    </Button>
                    
                    {hasCoords && (
                      <Button
                        component="a"
                        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="subtle"
                        size="xs"
                        leftSection={<IconExternalLink size={14} />}
                      >
                        Google Maps
                      </Button>
                    )}
                  </Group>
                </>
              )}
            </Box>
          </>
        ) : (
          /* Offline placeholder */
          <Box p="xl">
            <Center style={{ flexDirection: 'column', gap: 16 }}>
              <ThemeIcon variant="light" color="gray" size={64} radius="xl">
                <IconWifiOff size={32} />
              </ThemeIcon>
              <Text ta="center" size="sm" fw={500}>
                Sin conexión a internet
              </Text>
              <Text ta="center" size="xs" c="dimmed" style={{ maxWidth: 300 }}>
                Para visualizar el mapa satelital y descargar la imagen base, es necesaria una conexión a internet activa.
              </Text>
              {hasCoords && (
                <Button
                  component="a"
                  href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="sm"
                  leftSection={<IconExternalLink size={16} />}
                >
                  Abrir ubicación en Google Maps
                </Button>
              )}
            </Center>
          </Box>
        )}
      </Box>

      <Text size="xs" c="dimmed" mt={-12}>
        Ajuste el zoom, descargue la imagen, edítela externamente con las señales de instalación y súbala abajo.
      </Text>

      {/* ── Diagram upload section ── */}
      <Stack gap="sm">
        <Text size="sm" fw={500}>Imagen del diagrama editado</Text>

        {!hasEditedMap && (
          <Alert color="orange">
            La imagen del diagrama editado es obligatoria para enviar el reporte a revisión.
          </Alert>
        )}

        {hasEditedMap ? (
          <Stack gap="sm">
            {imageWarning && (
              <Alert color="yellow" title="Sugerencia de imagen">
                {imageWarning}
              </Alert>
            )}
            <Box style={{ maxWidth: 500, border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
              <img src={report.edited_map_image_url} alt="Diagrama del sitio" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </Box>
            <Group gap="xs">
              <FileInput accept="image/*" placeholder="Cambiar imagen" onChange={onDiagramFileChange} style={{ flex: '1', minWidth: 140 }} />
              <Button variant="light" color="red" size="xs" onClick={clearDiagram}>
                Quitar imagen
              </Button>
            </Group>
          </Stack>
        ) : (
          <FileInput
            accept="image/*"
            placeholder="Seleccionar imagen del diagrama"
            onChange={onDiagramFileChange}
          />
        )}
      </Stack>
    </Stack>
  );
}
