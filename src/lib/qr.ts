export type QrTheme = {
  size?: number;
  withLogo?: boolean; // ignored — kept for API compatibility
};

/**
 * Generate a STANDARD-COMPLIANT QR code (ISO/IEC 18004) as a PNG data URL.
 *
 * Design choices for maximum scannability:
 * - Pure black modules on pure white background (max contrast)
 * - Square modules (no rounding) — required by the spec for reliable decoding
 * - Quiet zone of 4 modules (mandatory per spec)
 * - Error correction level M (15%) — best balance density/robustness when no logo
 * - Module size ≥ 4px to ensure camera can resolve each module
 */
export async function generateBadgeQR(payload: string, theme: QrTheme = {}): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  const size = theme.size ?? 600;

  return await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    type: "image/png",
    margin: 4, // quiet zone in modules — required by ISO/IEC 18004
    width: size,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
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
