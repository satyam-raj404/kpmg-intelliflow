import { useRef, useState, useCallback } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

export function useDashboardExport(title: string, company = "ALL") {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    const el = containerRef.current;
    if (!el || isExporting) return;
    setIsExporting(true);

    try {
      // toPng uses getComputedStyle() so oklch/lch/lab colors are resolved to
      // rgb by the browser before serialization — no CSS parser involved
      const dataUrl = await toPng(el, {
        pixelRatio: 1.5,
        skipFonts: false,
        // Skip open tooltips/popovers that may float over content
        filter: (node) =>
          !(node instanceof HTMLElement &&
            (node.classList.contains("recharts-tooltip-wrapper") ||
             node.getAttribute("data-radix-popper-content-wrapper") != null)),
      });

      // Load image to get natural dimensions
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      });

      // A4 landscape: 297 × 210 mm
      const PDF_W = 297;
      const PDF_H = 210;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const pxPerMm = img.width / PDF_W;
      const pageHeightPx = PDF_H * pxPerMm;

      // Draw full image onto an offscreen canvas once, then slice per page
      const full = document.createElement("canvas");
      full.width = img.width;
      full.height = img.height;
      full.getContext("2d")!.drawImage(img, 0, 0);

      let srcY = 0;
      let firstPage = true;
      while (srcY < img.height) {
        if (!firstPage) pdf.addPage();
        firstPage = false;

        const sliceH = Math.min(pageHeightPx, img.height - srcY);
        const slice = document.createElement("canvas");
        slice.width = img.width;
        slice.height = Math.ceil(sliceH);
        slice.getContext("2d")!.drawImage(full, 0, -srcY);

        pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, PDF_W, sliceH / pxPerMm);
        srcY += pageHeightPx;
      }

      const date = new Date().toISOString().slice(0, 10);
      const co = company && company !== "ALL" ? `_${company}` : "";
      pdf.save(`IntelliFlow_${title.replace(/[\s/\\]+/g, "_")}${co}_${date}.pdf`);

    } catch (err) {
      console.error("[PDF export]", err);
    } finally {
      setIsExporting(false);
    }
  }, [title, company, isExporting]);

  return { containerRef, exportPdf, isExporting };
}
