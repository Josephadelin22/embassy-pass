import logo from "@/assets/inov-logo.png";

export type QrTheme = {
  size?: number;
  navy?: string;
  gold?: string;
  withLogo?: boolean;
};

/**
 * Generate the QR code premium badge as a data URL (PNG).
 * Uses qr-code-styling with rounded eyes + INOV logo at center,
 * error correction level H (30%) for logo overlay.
 */
export async function generateBadgeQR(payload: string, theme: QrTheme = {}): Promise<string> {
  const { default: QRCodeStyling } = await import("qr-code-styling");
  const size = theme.size ?? 600;
  const navy = theme.navy ?? "#0d1b3d";
  const gold = theme.gold ?? "#f5b324";

  const qr = new QRCodeStyling({
    width: size,
    height: size,
    type: "canvas",
    data: payload,
    margin: 12,
    qrOptions: { errorCorrectionLevel: "H" },
    image: theme.withLogo === false ? undefined : logo,
    imageOptions: { crossOrigin: "anonymous", margin: 10, imageSize: 0.38, hideBackgroundDots: true },
    dotsOptions: { type: "rounded", color: navy },
    cornersSquareOptions: { type: "extra-rounded", color: navy },
    cornersDotOptions: { type: "dot", color: gold },
    backgroundOptions: { color: "#ffffff" },
  });

  const blob = (await qr.getRawData("png")) as Blob;
  return await blobToDataURL(blob);
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
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
  // A6: 105 x 148 mm
  const doc = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" });
  const W = 105;
  const H = 148;

  // Navy header
  doc.setFillColor(13, 27, 61);
  doc.rect(0, 0, W, 28, "F");

  // Gold band
  doc.setFillColor(245, 179, 36);
  doc.rect(0, 28, W, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("INOV E-TECH", W / 2, 13, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("BADGE D'ACCÈS OFFICIEL", W / 2, 21, { align: "center" });

  // QR center
  const qrSize = 70;
  doc.addImage(input.qrDataUrl, "PNG", (W - qrSize) / 2, 38, qrSize, qrSize);

  // Name
  doc.setTextColor(13, 27, 61);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const nameLines = doc.splitTextToSize(input.fullName.toUpperCase(), W - 16);
  doc.text(nameLines, W / 2, 118, { align: "center" });

  // Category badge
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

  // Footer
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
