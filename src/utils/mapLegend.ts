
export const LEGEND_WIDTH = 300;
export const LEGEND_HEIGHT = 535; // Exact height: 30 (header) + 505 (rows)

export function drawLegend(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
) {
  const x = canvasWidth - LEGEND_WIDTH - 20; // 20px padding from right
  const y = 20; // 20px padding from top
  const w = LEGEND_WIDTH;
  
  // Save context
  ctx.save();
  ctx.translate(x, y);

  // Background - fill white first
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, w, LEGEND_HEIGHT); 

  // Styles
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1;
  ctx.font = 'bold 16px "Times New Roman", serif';
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Helper for rows
  let currentY = 0;
  const col1W = 100; // Symbol column width
  const col2W = w - col1W; // Description column width

  // Draw borders function
  const drawRowBorder = (y: number) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  };

  const drawVertLine = () => {
    ctx.beginPath();
    ctx.moveTo(col1W, 0);
    ctx.lineTo(col1W, LEGEND_HEIGHT); // Use full height
    ctx.stroke();
  };
  
  // Outer Border (Double) - Draw at the end to be on top
  const drawOuterBorder = (h: number) => {
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  };

  // Header
  const headerHeight = 30;
  ctx.fillText('SÍMBOLO', col1W / 2, headerHeight / 2);
  ctx.fillText('DESCRIPCIÓN', col1W + col2W / 2, headerHeight / 2);
  
  currentY += headerHeight;
  drawRowBorder(currentY);
  
  // Double line below header
  ctx.lineWidth = 3; // Make it thicker to simulate double or just thick separator
  ctx.beginPath();
  ctx.moveTo(0, currentY);
  ctx.lineTo(w, currentY);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Function to draw a row
  const drawRow = (drawSymbol: (cx: number, cy: number) => void, text: string, height: number) => {
    const cy = currentY + height / 2;
    const cx = col1W / 2;
    
    // Draw symbol
    ctx.save();
    drawSymbol(cx, cy);
    ctx.restore();
    
    // Draw Description
    ctx.save();
    ctx.font = '16px "Times New Roman", serif'; // Normal font for desc
    ctx.textAlign = 'left';
    ctx.fillStyle = 'black';
    // Center vertically
    ctx.textBaseline = 'middle';
    ctx.fillText(text, col1W + 10, cy);
    ctx.restore();

    currentY += height;
    drawRowBorder(currentY);
  };

  // Row 1: Camera Post
  // Symbol: Blue circle (left), Blue vertical rect (right)
  drawRow((cx, cy) => {
    // Circle
    ctx.fillStyle = '#0070C0';
    ctx.beginPath();
    ctx.arc(cx - 15, cy + 5, 8, 0, Math.PI * 2);
    ctx.fill();
    // Bar
    ctx.fillRect(cx + 5, cy - 15, 6, 30);
  }, 'Poste de Cámara', 60);

  // Row 2: Aerial Line
  // Symbol: Blue line --- (Azul)
  drawRow((cx, cy) => {
    ctx.strokeStyle = '#0070C0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.stroke();
    
    ctx.fillStyle = 'black';
    ctx.font = '12px "Times New Roman", serif';
    ctx.fillText('(Azul)', cx + 15, cy);
  }, 'Línea Aérea', 35);

  // Row 3: Support Post
  // Symbol: White circle with grey border
  drawRow((cx, cy) => {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx - 20, cy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, 'Poste de Apoyo', 35);

  // Row 4: Energy Post
  // Symbol: Red circle, Red vertical bar
  drawRow((cx, cy) => {
    ctx.fillStyle = 'red';
    // Circle
    ctx.beginPath();
    ctx.arc(cx - 15, cy + 5, 8, 0, Math.PI * 2);
    ctx.fill();
    // Bar
    ctx.fillRect(cx + 5, cy - 15, 6, 30);
  }, 'Poste de Energía', 60);

  // Row 5: Underground Line
  // Symbol: Red line --- (Rojo)
  drawRow((cx, cy) => {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.stroke();
    
    ctx.fillStyle = 'black';
    ctx.font = '12px "Times New Roman", serif';
    ctx.fillText('(Rojo)', cx + 15, cy);
  }, 'Línea Subterránea', 35);

  // Row 6: Box 60x60 (Green)
  drawRow((cx, cy) => {
    ctx.fillStyle = '#00B050';
    ctx.fillRect(cx - 10, cy - 10, 20, 20);
  }, 'Caja 60 x 60', 40);

  // Row 7: Box 40x40 (Brown)
  drawRow((cx, cy) => {
    ctx.fillStyle = '#A5510B'; // Brown/Orange
    ctx.fillRect(cx - 8, cy - 8, 16, 16);
  }, 'Caja 40 x 40', 40);

  // Row 8: LPR Type T
  // Symbol: -[LPR]- T -[LPR]- 
  // Looks like a T shape in grey, with lines extending and [LPR] text.
  // Actually image shows:
  // -[LPR]- T -[LPR]-
  //       _|_ 
  // Let's approximate: Horizontal line, T in middle, [LPR] text on line.
  // The image shows:
  // Top: Line --- [LPR] --- (Big Grey T) --- [LPR] ---
  // Bottom: Inverted T symbol? Or just T?
  // Let's look closely at crop 3.
  // It looks like:
  // -[LPR]- T -[LPR]-
  //         _|_
  // And the description is "Estructura LPR Tipo T"
  
  drawRow((cx, cy) => {
    // Draw the schematic
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'black';
    
    // Center T (Grey)
    ctx.fillStyle = '#A0A0A0';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('T', cx, cy - 5);
    
    // Inverted T below (symbol for ground?)
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 10);
    ctx.lineTo(cx, cy + 20);
    ctx.moveTo(cx - 5, cy + 20);
    ctx.lineTo(cx + 5, cy + 20);
    ctx.stroke();

    // Side lines with [LPR]
    ctx.font = '8px sans-serif';
    ctx.fillStyle = 'black';
    
    // Left
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy - 5);
    ctx.lineTo(cx - 45, cy - 5);
    ctx.stroke();
    // Fill white behind text
    ctx.fillStyle = 'white';
    ctx.fillRect(cx - 40, cy - 10, 20, 10);
    ctx.fillStyle = 'black';
    ctx.fillText('[LPR]', cx - 30, cy - 5); 
    
    // Right
    ctx.beginPath();
    ctx.moveTo(cx + 15, cy - 5);
    ctx.lineTo(cx + 45, cy - 5);
    ctx.stroke();
    // Fill white behind text
    ctx.fillStyle = 'white';
    ctx.fillRect(cx + 20, cy - 10, 20, 10);
    ctx.fillStyle = 'black';
    ctx.fillText('[LPR]', cx + 30, cy - 5);

  }, 'Estructura LPR Tipo T', 70);

  // Row 9: LPR Type L
  // Image: 
  //      L
  // |
  // L___[LPR]
  // Looks like a schematic of an L pole.
  drawRow((cx, cy) => {
    // Grey L
    ctx.fillStyle = '#A0A0A0';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('L', cx, cy - 10);
    
    // Diagram lines
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Vertical line left
    ctx.moveTo(cx - 20, cy + 5);
    ctx.lineTo(cx - 20, cy + 20);
    // Horizontal connect
    ctx.lineTo(cx + 10, cy + 20);
    ctx.stroke();
    
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'black';
    ctx.fillText('[LPR]', cx + 10, cy + 20);
    
  }, 'Estructura LPR Tipo L', 70);

  // Row 10: LPR Type C
  // Image: 
  //   ~[LPR]~
  //      C
  // Looks like bracket top?
  drawRow((cx, cy) => {
     // Grey C
    ctx.fillStyle = '#A0A0A0';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('C', cx, cy + 10);
    
    // Top Bracket
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy - 10);
    ctx.lineTo(cx - 20, cy - 15);
    ctx.lineTo(cx + 20, cy - 15);
    ctx.lineTo(cx + 20, cy - 10);
    ctx.stroke();
    
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'black';
    // Clear rect behind text?
    ctx.fillStyle = 'white';
    ctx.fillRect(cx - 15, cy - 20, 30, 10);
    ctx.fillStyle = 'black';
    ctx.fillText('[LPR]', cx, cy - 15);
  }, 'Estructura LPR Tipo C', 60);

  // Vertical Separator Line - use calculated height
  const finalHeight = currentY;
  
  // Fill any remaining white space if we want a fixed height box, or just crop to content.
  // Let's crop to content (finalHeight).
  
  // Redraw background white to clean up any mess? No, we already filled.
  // Actually, if we filled 560 and used 538, we have white space at bottom.
  // It's better to stroke the rect around the *actual* content.
  
  ctx.beginPath();
  ctx.moveTo(col1W, 0);
  ctx.lineTo(col1W, finalHeight);
  ctx.stroke();

  // Draw outer border at the end to cover everything nicely
  drawOuterBorder(finalHeight);

  ctx.restore();
}
