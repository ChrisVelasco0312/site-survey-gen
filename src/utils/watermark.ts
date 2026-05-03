import type { Report } from '../types/Report';
import { storageUrlToDataUrl } from './reportImagesStorage';

function formatToGMS(latitude: number, longitude: number): string {
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';

  const absLat = Math.abs(latitude);
  const absLon = Math.abs(longitude);

  const latDeg = Math.floor(absLat);
  const latMin = Math.floor((absLat - latDeg) * 60);
  const latSec = ((absLat - latDeg - latMin / 60) * 3600).toFixed(2);

  const lonDeg = Math.floor(absLon);
  const lonMin = Math.floor((absLon - lonDeg) * 60);
  const lonSec = ((absLon - lonDeg - lonMin / 60) * 3600).toFixed(2);

  return `${latDeg}°${latMin}'${latSec}\"${latDir} ${lonDeg}°${lonMin}'${lonSec}\"${lonDir}`;
}

function getWatermarkLines(report: Report): string[] {
  const latitude = report.address?.latitude ?? 0;
  const longitude = report.address?.longitude ?? 0;
  const hasCoords = latitude !== 0 || longitude !== 0;
  const distrito = report.address?.distrito?.trim() || 'SIN DISTRITO';
  const siteName = report.address?.site_name?.trim() || 'SIN NOMBRE';

  return [
    `FECHA: ${report.date || 'SIN FECHA'}`,
    `COORDENADAS: ${hasCoords ? formatToGMS(latitude, longitude) : 'SIN COORDENADAS'}`,
    `SITE SURVEY: ${distrito} ${siteName}`,
    'CONSORCIO VALLE SEGURO',
  ];
}

function truncateTextToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '...';
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, mid)}${ellipsis}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${text.slice(0, Math.max(0, low))}${ellipsis}`;
}

async function resolveToDataUrl(src: string): Promise<string> {
  if (!src) throw new Error('No image source');
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  return await storageUrlToDataUrl(src);
}

/**
 * Produce a watermarked data URL from an image source (data URL or Storage URL)
 */
export async function buildWatermarkedImage(src: string, report: Report, logoDataUrl?: string): Promise<string> {
  const resolved = await resolveToDataUrl(src);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const node = new Image();
    node.onload = () => resolve(node);
    node.onerror = () => reject(new Error('Failed to load image'));
    node.src = resolved;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  ctx.drawImage(img, 0, 0);

  const lines = getWatermarkLines(report);
  const scale = Math.min(canvas.width, canvas.height);
  const fontSize = Math.max(18, Math.min(28, Math.round(scale * 0.028)));
  const horizontalPadding = Math.max(12, Math.round(canvas.width * 0.016));
  const verticalPadding = Math.max(10, Math.round(canvas.height * 0.015));
  const lineHeight = Math.round(fontSize * 1.25);
  const blockHeight = verticalPadding * 2 + lineHeight * lines.length;
  const margin = Math.max(8, Math.round(canvas.width * 0.01));

  const x = margin;
  const y = canvas.height - blockHeight - margin;

  ctx.font = `700 ${fontSize}px Roboto, Arial, sans-serif`;
  ctx.letterSpacing = `${Math.max(1, Math.round(fontSize * 0.08))}px`;
  ctx.fillStyle = '#FFD700';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.12));
  ctx.strokeStyle = '#000000';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  let logoWidth = 0;
  const logoGap = Math.max(8, Math.round(canvas.width * 0.008));
  if (logoDataUrl) {
    try {
      const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const n = new Image();
        n.onload = () => resolve(n);
        n.onerror = () => reject(new Error('Failed to load logo'));
        n.src = logoDataUrl;
      });
      const maxLogoHeight = blockHeight - verticalPadding * 2;
      const scaleLogo = Math.min(1, maxLogoHeight / logoImg.naturalHeight);
      logoWidth = Math.round(logoImg.naturalWidth * scaleLogo);
      const logoHeight = Math.round(logoImg.naturalHeight * scaleLogo);
      const logoX = x + horizontalPadding;
      const logoY = y + verticalPadding + Math.round((blockHeight - verticalPadding * 2 - logoHeight) / 2);
      ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
    } catch (e) {
      logoWidth = 0;
    }
  }

  const maxTextWidth = canvas.width - horizontalPadding * 2 - logoWidth - (logoWidth ? logoGap : 0);
  const textX = canvas.width - horizontalPadding;
  lines.forEach((line, index) => {
    const text = truncateTextToWidth(ctx, line, maxTextWidth);
    const textY = y + verticalPadding + index * lineHeight;
    ctx.strokeText(text, textX, textY);
    ctx.fillText(text, textX, textY);
  });

  ctx.shadowColor = 'transparent';
  return canvas.toDataURL('image/jpeg', 0.9);
}

export default buildWatermarkedImage;
