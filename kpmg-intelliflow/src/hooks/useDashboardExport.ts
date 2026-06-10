import { useRef, useState, useCallback } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export function useDashboardExport(title: string, company = "ALL") {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    const el = containerRef.current;
    if (!el || isExporting) return;
    setIsExporting(true);

    try {
      // Capture the full element height (including off-screen content)
      const canvas = await html2canvas(el, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: el.scrollWidth,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      // A4 landscape: 297mm × 210mm
      const PDF_W = 297;
      const PDF_H = 210;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      // px-per-mm ratio based on canvas width fitting the page width
      const pxPerMm = canvas.width / PDF_W;
      const pageHeightPx = PDF_H * pxPerMm;

      // Slice canvas into A4-height chunks and add one page per chunk
      let srcY = 0;
      let firstPage = true;
      while (srcY < canvas.height) {
        if (!firstPage) pdf.addPage();
        firstPage = false;

        const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.ceil(sliceH);
        slice.getContext("2d")!.drawImage(canvas, 0, -srcY);

        const imgH = sliceH / pxPerMm;
        pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, PDF_W, imgH);
        srcY += pageHeightPx;
      }

      // Filename encodes dashboard + company + date
      const date = new Date().toISOString().slice(0, 10);
      const co = company && company !== "ALL" ? `_${company}` : "";
      const name = `IntelliFlow_${title.replace(/[\s/\\]+/g, "_")}${co}_${date}.pdf`;
      pdf.save(name);
    } catch (err) {
      console.error("[PDF export]", err);
    } finally {
      setIsExporting(false);
    }
  }, [title, company, isExporting]);

  return { containerRef, exportPdf, isExporting };
}
