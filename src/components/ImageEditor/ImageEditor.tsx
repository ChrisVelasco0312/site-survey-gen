import { useRef, useState, useEffect, useCallback } from 'preact/hooks';
import {
  Stack,
  Text,
  Box,
  Button,
  Slider,
  Group,
  Center,
  SegmentedControl,
  ActionIcon,
  ColorSwatch,
  Tooltip,
} from '@mantine/core';
import {
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
  IconEdit,
} from '@tabler/icons-react';

/* ── Types ── */
export type Tool = 'select' | 'eraser' | 'pencil' | 'square' | 'square-fill' | 'circle' | 'circle-fill';

export interface BaseShape {
  id: string;
  type: string;
  color: string;
  strokeWidth: number;
  rotation?: number; // radians
}

export interface RectShape extends BaseShape {
  type: 'square' | 'square-fill';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleShape extends BaseShape {
  type: 'circle' | 'circle-fill';
  x: number;
  y: number;
  radius: number;
}

export interface PencilShape extends BaseShape {
  type: 'pencil';
  points: { x: number; y: number }[];
}

export type Shape = RectShape | CircleShape | PencilShape;

/* ── Helpers ── */

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

/* ── Component ─────────────────────────────────────────────── */

interface ImageEditorProps {
  width: number;
  height: number;
  /**
   * Base image URL to load. If provided, it will be drawn on the base canvas.
   * If not provided, relies on `children` or `baseCanvasRef` logic.
   */
  baseImage?: string;
  /**
   * Reference to an external canvas that contains the base content (e.g. Map).
   * Used during save to merge.
   */
  baseCanvasRef?: React.RefObject<HTMLCanvasElement>;
  /**
   * Content to render behind the editor layers.
   * E.g. The live Map canvas.
   */
  children?: React.ReactNode;
  
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export function ImageEditor({
  width,
  height,
  baseImage,
  baseCanvasRef,
  children,
  onSave,
  onCancel,
}: ImageEditorProps) {
  /* ── State ── */
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
  const internalBaseRef = useRef<HTMLImageElement | null>(null); // For baseImage

  const interactionRef = useRef<{
    isDown: boolean;
    startPos: { x: number; y: number };
    currentShape?: Shape;
    movingShapeStart?: Shape; 
    resizeHandle?: string;
    lastMousePos?: { x: number; y: number };
    startRotation?: number; 
  }>({
    isDown: false,
    startPos: { x: 0, y: 0 },
  });

  /* ── Init ── */
  useEffect(() => {
    // Init history
    if (history.length === 0) {
      setHistory([[]]);
      setHistoryIndex(0);
    }
  }, []);

  // Update canvas size
  useEffect(() => {
    const drawingCanvas = drawingCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (drawingCanvas) {
        drawingCanvas.width = width;
        drawingCanvas.height = height;
    }
    if (tempCanvas) {
        tempCanvas.width = width;
        tempCanvas.height = height;
    }
    renderCanvas();
  }, [width, height]);

  // Load base image if provided
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  useEffect(() => {
    if (baseImage) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            internalBaseRef.current = img;
            setIsImageLoaded(true);
        };
        img.src = baseImage;
    }
  }, [baseImage]);

  /* ── Logic ── */

  const shapesRef = useRef<Shape[]>([]);
  useEffect(() => {
    shapesRef.current = shapes;
    renderCanvas();
  }, [shapes, selectedShapeId, hoveredShapeId, transformMode]);

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
    
    shapesRef.current.forEach(shape => {
      ctx.save();
      ctx.lineWidth = shape.strokeWidth;
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const rotation = shape.rotation || 0;
      let cx = 0, cy = 0;

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

    // Draw selection
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

        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        const halfW = bounds.w / 2;
        const halfH = bounds.h / 2;
        
        ctx.strokeStyle = transformMode === 'rotate' ? '#e67e22' : '#00a8ff';
        ctx.lineWidth = 1;
        ctx.setLineDash(transformMode === 'rotate' ? [] : [5, 5]);
        
        ctx.strokeRect(-halfW - 5, -halfH - 5, bounds.w + 10, bounds.h + 10);
        
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
                ctx.arc(c.x, c.y, handleSize/2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillRect(c.x - half, c.y - half, handleSize, handleSize);
                ctx.strokeRect(c.x - half, c.y - half, handleSize, handleSize);
            }
        });

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
     if (selectedShapeId) {
         const shape = shapesRef.current.find(s => s.id === selectedShapeId);
         if (shape) {
             let cx = 0, cy = 0;
             let halfW = 0, halfH = 0;
             
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

     for (let i = shapesRef.current.length - 1; i >= 0; i--) {
         const s = shapesRef.current[i];
         const rotation = s.rotation || 0;
         
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
    const { x, y } = getCanvasCoords(e);
    const hit = hitTest(x, y);
    if (hit.shapeId === selectedShapeId && selectedShapeId) {
        setTransformMode(prev => prev === 'scale' ? 'rotate' : 'scale');
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

        if (hit.shapeId) {
            if (hit.shapeId !== selectedShapeId) {
                setSelectedShapeId(hit.shapeId);
                setTransformMode('scale');
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
    const { x, y } = getCanvasCoords(e);
    
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
            if (shape.type === 'pencil') {
                const p = shape as PencilShape;
                p.points = p.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));
            } else {
                (shape as any).x += dx;
                (shape as any).y += dy;
            }
        }
        newShapes[shapeIndex] = shape;
        setShapes(newShapes);
        return;
    }

    const current = interactionRef.current.currentShape;
    if (!current) return;
    
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    if (!tempCtx) return;
    tempCtx.clearRect(0, 0, width, height);
    
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
        
        tempCtx.beginPath();
        if (p.points.length > 0) {
            tempCtx.moveTo(p.points[0].x, p.points[0].y);
            for (let i = 1; i < p.points.length; i++) tempCtx.lineTo(p.points[i].x, p.points[i].y);
        }
        tempCtx.stroke();
    } else {
        const w = x - startX;
        const h = y - startY;
        
        tempCtx.beginPath();
        if (current.type.includes('square')) {
            if (current.type === 'square-fill') tempCtx.fillRect(startX, startY, w, h);
            else tempCtx.strokeRect(startX, startY, w, h);
            (current as RectShape).width = w;
            (current as RectShape).height = h;
        } else if (current.type.includes('circle')) {
             const radius = Math.sqrt(w * w + h * h);
             tempCtx.arc(startX, startY, radius, 0, 2 * Math.PI);
             if (current.type === 'circle-fill') tempCtx.fill();
             else tempCtx.stroke();
             (current as CircleShape).radius = radius;
        }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactionRef.current.isDown) return;
    interactionRef.current.isDown = false;
    
    const tempCtx = tempCanvasRef.current?.getContext('2d');
    tempCtx?.clearRect(0, 0, width, height);

    if (activeTool === 'select') {
        if (selectedShapeId && interactionRef.current.movingShapeStart) {
             pushHistory([...shapes]);
        }
        return;
    }

    if (interactionRef.current.currentShape) {
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
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = width;
    finalCanvas.height = height;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw Base
    if (baseCanvasRef?.current) {
        ctx.drawImage(baseCanvasRef.current, 0, 0, width, height);
    } else if (internalBaseRef.current) {
        ctx.drawImage(internalBaseRef.current, 0, 0, width, height);
    } else {
        // Transparent or white background if no base
        // ctx.fillStyle = 'white';
        // ctx.fillRect(0, 0, width, height);
    }

    // 2. Draw Shapes
    if (drawingCanvasRef.current) {
        ctx.drawImage(drawingCanvasRef.current, 0, 0);
    }

    const dataUrl = finalCanvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  /* ── Shortcuts ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
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
  }, [historyIndex, history, selectedShapeId]);

  return (
    <Stack gap="sm">
      {/* Header Bar */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
            <Text size="sm" fw={500}>Editor</Text>
        </Group>
        
        <Group gap="sm">
           {/* History Controls */}
           <Group gap={4} style={{ borderRight: '1px solid var(--mantine-color-default-border)', paddingRight: 10 }}>
               <Tooltip label="Deshacer (Ctrl+Z)" withArrow>
                  <ActionIcon variant="subtle" color="gray" onClick={undo} disabled={historyIndex <= 0}>
                     <IconArrowBackUp size={18} />
                  </ActionIcon>
               </Tooltip>
               <Tooltip label="Rehacer (Ctrl+Shift+Z)" withArrow>
                  <ActionIcon variant="subtle" color="gray" onClick={redo} disabled={historyIndex >= history.length - 1}>
                     <IconArrowForwardUp size={18} />
                  </ActionIcon>
               </Tooltip>
               <Tooltip label="Eliminar seleccionado (Supr)" withArrow>
                  <ActionIcon variant="subtle" color="red" onClick={deleteSelected} disabled={!selectedShapeId}>
                     <IconTrash size={18} />
                  </ActionIcon>
               </Tooltip>
           </Group>

           {/* Save/Cancel */}
           <Group gap="xs">
              <Button size="xs" variant="default" onClick={onCancel}>Cancelar</Button>
              <Button size="xs" color="blue" onClick={handleSaveEdit} leftSection={<IconCheck size={14} />}>Guardar Edición</Button>
           </Group>
        </Group>
      </Group>

      {/* Toolbar */}
      <Box 
        p="xs" 
        style={{ 
            border: '1px solid var(--mantine-color-default-border)', 
            borderRadius: 'var(--mantine-radius-md)',
            backgroundColor: 'var(--mantine-color-gray-0)'
        }}
      >
          <Group gap="md" wrap="wrap">
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
            
            {/* Divider */}
            <Box style={{ width: 1, height: 24, backgroundColor: 'var(--mantine-color-default-border)' }} />

            <Group gap="xs">
                <Text size="xs" fw={500} c="dimmed">Color:</Text>
                <Group gap={4}>
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
            </Group>

            {/* Divider */}
            <Box style={{ width: 1, height: 24, backgroundColor: 'var(--mantine-color-default-border)' }} />

            <Group gap="xs">
                <Text size="xs" fw={500} c="dimmed">Grosor:</Text>
                <Slider
                  min={1}
                  max={10}
                  value={strokeWidth}
                  onChange={setStrokeWidth}
                  size="sm"
                  w={100}
                />
            </Group>
          </Group>
      </Box>

      <Box style={{ position: 'relative', width: '100%', aspectRatio: `${width}/${height}`, maxWidth: '100%', border: '1px solid #ddd', borderRadius: 4, overflow: 'hidden' }}>
        {/* Base Layer */}
        <Box style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            {children}
            {baseImage && !children && (
                <img src={baseImage} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            )}
        </Box>

        {/* Editor Layers */}
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
      </Box>
    </Stack>
  );
}
