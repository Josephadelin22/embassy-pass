import inovLogo from "@/assets/inov-logo.png";

export type QrTheme = {
  size?: number;
  withLogo?: boolean; // garde compat — logo désormais en filigrane par défaut
};

/**
 * Generate a STANDARD-COMPLIANT QR code (ISO/IEC 18004) as a PNG data URL.
 *
 * - Niveau de correction H (30%) pour rester scannable malgré le filigrane
 * - Logo INOV E-TECH dessiné en arrière-plan TRÈS léger (opacité ~8%)
 * - Modules noirs purs dessinés PAR-DESSUS le filigrane → scan garanti
 * - Quiet zone de 4 modules (obligatoire)
 */
export async function generateBadgeQR(payload: string, theme: QrTheme = {}): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  const size = theme.size ?? 600;

  // 1) Génère le QR sur un canvas (fond blanc + modules noirs)
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, payload, {
    errorCorrectionLevel: "H",
    margin: 4,
    width: size,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const ctx = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;

  // 2) Charge le logo
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = inovLogo;
  });

  // 3) Dessine le logo en filigrane DERRIÈRE les modules :
  //    on capture les modules noirs, on remet le fond blanc, on dessine le logo
  //    très léger, puis on redessine les modules noirs par-dessus.
  const qrImageData = ctx.getImageData(0, 0, W, H);

  // Fond blanc
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // Logo centré, ~55% de la taille, opacité très faible
  const logoSize = Math.round(W * 0.55);
  const lx = (W - logoSize) / 2;
  const ly = (H - logoSize) / 2;
  ctx.globalAlpha = 0.08; // vraiment léger
  ctx.drawImage(img, lx, ly, logoSize, logoSize);
  ctx.globalAlpha = 1;

  // Redessine les modules noirs par-dessus pour garantir le scan
  const blackOverlay = ctx.createImageData(W, H);
  const src = qrImageData.data;
  const dst = blackOverlay.data;
  for (let i = 0; i < src.length; i += 4) {
    // pixel noir du QR original ?
    if (src[i] < 30 && src[i + 1] < 30 && src[i + 2] < 30) {
      dst[i] = 0;
      dst[i + 1] = 0;
      dst[i + 2] = 0;
      dst[i + 3] = 255;
    } else {
      dst[i + 3] = 0; // transparent → laisse voir le filigrane
    }
  }
  ctx.putImageData(blackOverlay, 0, 0);

  return canvas.toDataURL("image/png");
}

export type BadgePdfInput = {
  qrDataUrl: string;
  fullName: string;
  category: string;
  organization?: string | null;
  reference: string;
};

/** Build a beautifully branded PDF badge (A6 portrait). */
export async function generateBadgePDF(input: BadgePdfInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" });
  const W = 105;
  const H = 148;

  // Navy header
  doc.setFillColor(13, 27, 61);
  doc.rect(0, 0, W, 28, "F");
  doc.setFillColor(245, 179, 36);
  doc.rect(0, 28, W, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("INOV E-TECH .L Ltd", W / 2, 13, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("BADGE D'ACCÈS OFFICIEL", W / 2, 21, { align: "center" });

  // White card behind QR (ensures pure white quiet zone in print)
  const qrSize = 70;
  const qrX = (W - qrSize) / 2;
  const qrY = 38;
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, "F");
  doc.addImage(input.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // Name
  doc.setTextColor(13, 27, 61);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const nameLines = doc.splitTextToSize(input.fullName.toUpperCase(), W - 16);
  doc.text(nameLines, W / 2, 118, { align: "center" });

  // Category
  doc.setFillColor(13, 27, 61);
  const cat = input.category.toUpperCase();
  doc.setFontSize(8);
  const catW = doc.getTextWidth(cat) + 10;
  const catX = (W - catW) / 2;
  doc.roundedRect(catX, 124, catW, 6, 1.5, 1.5, "F");
  doc.setTextColor(245, 179, 36);
  doc.text(cat, W / 2, 128.2, { align: "center" });

  if (input.organization) {
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(input.organization, W / 2, 134, { align: "center" });
  }

  doc.setTextColor(140, 140, 140);
  doc.setFontSize(6);
  doc.text(`Réf: ${input.reference.slice(0, 8).toUpperCase()}`, W / 2, 144, { align: "center" });

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
