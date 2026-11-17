import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { ReportSettings } from '../types';
import { formatArabicDate, formatUmmAlQuraDate } from './dateUtils';

export interface StructuredExcelSheet {
  sheetName: string;
  rows: Record<string, any>[];
}

export function exportStructuredExcelReport(
  fileName: string,
  sheets: StructuredExcelSheet[]
) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };

  sheets.forEach((sheet) => {
    const safeName = sheet.sheetName.slice(0, 31).replace(/[\\/?*[\]]/g, '-');
    const safeRows =
      sheet.rows.length > 0 ? sheet.rows : [{ ملاحظة: 'لا توجد بيانات مسجلة خلال الفترة المحددة' }];
    const ws = XLSX.utils.json_to_sheet(safeRows);

    // Auto column widths for readability and filtering
    const keys = Object.keys(safeRows[0] || {});
    ws['!cols'] = keys.map((k) => {
      const maxLen = Math.max(
        k.length,
        ...safeRows.map((r) => String(r[k] ?? '').length)
      );
      return { wch: Math.min(45, Math.max(14, maxLen + 4)) };
    });

    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export interface ReportExportKpi {
  label: string;
  value: string | number;
}

export interface ReportExportChartBar {
  label: string;
  value: number;
  unit?: string;
}

export interface ReportExportTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ReportExportNoteBlock {
  title: string;
  items: { label: string; value: string }[];
}

export interface OfficialReportPayload {
  reportTitle: string;
  subtitle?: string;
  periodLabel: string;
  metadata: { label: string; value: string }[];
  kpis: ReportExportKpi[];
  charts?: { title: string; bars: ReportExportChartBar[] }[];
  tables: ReportExportTable[];
  notesBlocks?: ReportExportNoteBlock[];
  supervisorName?: string;
}

function getLogoSvgMarkup(logoDataUrl?: string): string {
  if (logoDataUrl) {
    return `<img src="${logoDataUrl}" alt="شعار مكتبة وثبة" style="height:56px;width:56px;object-fit:contain;border-radius:12px;" />`;
  }
  return `
    <div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#3b707d,#162b31);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:18px;border:2px solid #d4af37;">
      وثبة
    </div>
  `;
}

export function printOfficialReport(
  payload: OfficialReportPayload,
  reportSettings: ReportSettings
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة لإتمام الطباعة');
    return;
  }

  const nowIso = new Date().toISOString();
  const hijriToday = formatUmmAlQuraDate(nowIso);
  const gregToday = formatArabicDate(nowIso);

  const metadataHtml = payload.metadata
    .map(
      (m) => `
      <div class="meta-item">
        <span class="meta-label">${m.label}:</span>
        <strong class="meta-val">${m.value}</strong>
      </div>`
    )
    .join('');

  const kpiHtml = payload.kpis
    .map(
      (k) => `
      <div class="kpi-box">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
      </div>`
    )
    .join('');

  const chartsHtml = (payload.charts || [])
    .filter((c) => c.bars.length > 0)
    .map((chart) => {
      const max = Math.max(1, ...chart.bars.map((b) => b.value));
      return `
        <div class="section">
          <h3>${chart.title}</h3>
          <div class="chart-list">
            ${chart.bars
              .map((b) => {
                const w = b.value === 0 ? 0 : Math.max(4, Math.round((b.value / max) * 100));
                return `
                  <div class="bar-row">
                    <div class="bar-head">
                      <span>${b.label}</span>
                      <strong>${b.value}${b.unit ? ` ${b.unit}` : ''}</strong>
                    </div>
                    <div class="bar-track">
                      <div class="bar-fill" style="width:${w}%"></div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    })
    .join('');

  const tablesHtml = payload.tables
    .map(
      (tbl) => `
      <div class="section">
        <h3>${tbl.title}</h3>
        <table>
          <thead>
            <tr>${tbl.columns.map((c) => `<th>${c}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${
              tbl.rows.length === 0
                ? `<tr><td colspan="${tbl.columns.length}" style="text-align:center;color:#64748b;">لا توجد بيانات مسجلة</td></tr>`
                : tbl.rows
                    .map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
                    .join('')
            }
          </tbody>
        </table>
      </div>`
    )
    .join('');

  const notesHtml = (payload.notesBlocks || [])
    .map(
      (block) => `
      <div class="section notes-card">
        <h3>${block.title}</h3>
        <div class="notes-grid">
          ${block.items
            .map(
              (item) => `
            <div class="note-item">
              <div class="note-label">${item.label}</div>
              <div class="note-val">${item.value || '—'}</div>
            </div>`
            )
            .join('')}
        </div>
      </div>`
    )
    .join('');

  const signaturesHtml = reportSettings.showSignatures
    ? `
      <div class="signatures">
        <div class="sig-box">
          <div class="sig-title">${reportSettings.supervisorSignatureLabel}</div>
          <div class="sig-name">${payload.supervisorName || 'المشرف المسؤول'}</div>
          <div class="sig-line">التوقيع: ..........................</div>
        </div>
        <div class="sig-box">
          <div class="sig-title">${reportSettings.adminSignatureLabel}</div>
          <div class="sig-name">${reportSettings.signatoryTitle} • ${reportSettings.signatoryName}</div>
          <div class="sig-line">الختم والاعتماد: ..................</div>
        </div>
      </div>`
    : '';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>${payload.reportTitle} | ${reportSettings.issuerOrganization}</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Tajawal', sans-serif; direction: rtl; color: #1e293b; background: #fff; margin: 0; padding: 24px; }
        .header-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #3b707d; padding-bottom: 14px; margin-bottom: 18px; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-title { font-size: 20px; font-weight: 900; color: #162b31; }
        .brand-sub { font-size: 12px; color: #3b707d; font-weight: 700; }
        .report-meta-right { text-align: left; font-size: 11px; color: #475569; }
        .title-banner { background: #e3ecf3; border: 1px solid #c5d8df; border-radius: 14px; padding: 14px 18px; margin-bottom: 16px; }
        .title-banner h1 { margin: 0; font-size: 18px; color: #162b31; font-weight: 900; }
        .title-banner p { margin: 4px 0 0; font-size: 12px; color: #325d68; font-weight: 700; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
        .meta-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; font-size: 11px; }
        .meta-label { color: #64748b; }
        .meta-val { color: #0f172a; margin-right: 4px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
        .kpi-box { border: 1px solid #c5d8df; border-radius: 12px; padding: 10px; background: #f4f7f8; text-align: center; }
        .kpi-label { font-size: 11px; color: #475569; font-weight: 700; }
        .kpi-value { font-size: 17px; font-weight: 900; color: #3b707d; margin-top: 4px; }
        .section { margin-bottom: 18px; page-break-inside: avoid; }
        .section h3 { font-size: 14px; font-weight: 800; color: #162b31; border-right: 4px solid #3b707d; padding-right: 8px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: right; }
        th { background: #3b707d; color: #fff; font-weight: 800; }
        tr:nth-child(even) { background: #f8fafc; }
        .chart-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .bar-row { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; }
        .bar-head { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px; }
        .bar-track { height: 8px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
        .bar-fill { height: 100%; background: #3b707d; border-radius: 99px; }
        .notes-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .note-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; font-size: 11px; }
        .note-label { font-weight: 800; color: #3b707d; margin-bottom: 4px; }
        .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 28px; padding-top: 16px; border-top: 2px dashed #cbd5e1; page-break-inside: avoid; }
        .sig-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; font-size: 12px; }
        .sig-title { font-weight: 900; color: #162b31; }
        .sig-name { color: #3b707d; font-weight: 700; margin-top: 4px; }
        .sig-line { margin-top: 16px; color: #64748b; }
        .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        @media print { @page { size: A4; margin: 1.2cm; } }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="brand">
          ${reportSettings.showLogo ? getLogoSvgMarkup(reportSettings.logoDataUrl) : ''}
          <div>
            <div class="brand-title">${reportSettings.issuerOrganization}</div>
            <div class="brand-sub">${reportSettings.reportHeaderTitle}</div>
          </div>
        </div>
        <div class="report-meta-right">
          <div>تاريخ الإصدار: <strong>${hijriToday}</strong></div>
          <div>الموافق: ${gregToday}</div>
          <div>الفترة: <strong>${payload.periodLabel}</strong></div>
        </div>
      </div>

      <div class="title-banner">
        <h1>${payload.reportTitle}</h1>
        ${payload.subtitle ? `<p>${payload.subtitle}</p>` : ''}
      </div>

      ${metadataHtml ? `<div class="meta-grid">${metadataHtml}</div>` : ''}
      ${kpiHtml ? `<div class="kpi-grid">${kpiHtml}</div>` : ''}
      ${chartsHtml}
      ${tablesHtml}
      ${notesHtml}
      ${signaturesHtml}

      <div class="footer">${reportSettings.footerText}</div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

export async function downloadOfficialReportPdf(
  payload: OfficialReportPayload,
  reportSettings: ReportSettings,
  fileName: string
): Promise<void> {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // continue
    }
  }

  const pageW = 1240;
  const pageH = 1754;
  const margin = 56;
  const contentW = pageW - margin * 2;
  const pages: HTMLCanvasElement[] = [];

  let loadedLogo: HTMLImageElement | null = null;
  if (reportSettings.showLogo && reportSettings.logoDataUrl) {
    loadedLogo = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = reportSettings.logoDataUrl!;
    });
  }

  const createPage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageW, pageH);
    ctx.direction = 'rtl';
    pages.push(canvas);
    return ctx;
  };

  let ctx = createPage();
  let y = margin;

  const drawPageFooter = (targetCtx: CanvasRenderingContext2D, pageNum: number) => {
    targetCtx.save();
    targetCtx.strokeStyle = '#e2e8f0';
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(margin, pageH - 64);
    targetCtx.lineTo(pageW - margin, pageH - 64);
    targetCtx.stroke();

    targetCtx.fillStyle = '#64748b';
    targetCtx.font = '600 18px Tajawal, Cairo, sans-serif';
    targetCtx.textAlign = 'center';
    targetCtx.fillText(
      `${reportSettings.footerText}  |  صفحة ${pageNum}`,
      pageW / 2,
      pageH - 34
    );
    targetCtx.restore();
  };

  const ensureSpace = (neededH: number) => {
    if (y + neededH > pageH - 90) {
      drawPageFooter(ctx, pages.length);
      ctx = createPage();
      y = margin;
    }
  };

  // Header
  if (reportSettings.showLogo) {
    if (loadedLogo) {
      ctx.drawImage(loadedLogo, pageW - margin - 72, y, 72, 72);
    } else {
      ctx.fillStyle = '#3b707d';
      ctx.beginPath();
      ctx.roundRect(pageW - margin - 72, y, 72, 72, 16);
      ctx.fill();
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Tajawal, Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('وثبة', pageW - margin - 36, y + 44);
    }
  }

  const textRightX = reportSettings.showLogo ? pageW - margin - 90 : pageW - margin;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#162b31';
  ctx.font = 'bold 28px Tajawal, Cairo, sans-serif';
  ctx.fillText(reportSettings.issuerOrganization, textRightX, y + 30);
  ctx.fillStyle = '#3b707d';
  ctx.font = '600 20px Tajawal, Cairo, sans-serif';
  ctx.fillText(reportSettings.reportHeaderTitle, textRightX, y + 62);

  const nowIso = new Date().toISOString();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '600 18px Tajawal, Cairo, sans-serif';
  ctx.fillText(`تاريخ الإصدار: ${formatUmmAlQuraDate(nowIso)}`, margin, y + 26);
  ctx.fillText(`الموافق: ${formatArabicDate(nowIso)}`, margin, y + 54);
  ctx.fillText(`الفترة: ${payload.periodLabel}`, margin, y + 82);

  y += 98;
  ctx.strokeStyle = '#3b707d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(pageW - margin, y);
  ctx.stroke();
  y += 22;

  // Report Banner
  ctx.fillStyle = '#e3ecf3';
  ctx.beginPath();
  ctx.roundRect(margin, y, contentW, payload.subtitle ? 94 : 66, 16);
  ctx.fill();
  ctx.strokeStyle = '#c5d8df';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = '#162b31';
  ctx.font = 'bold 28px Tajawal, Cairo, sans-serif';
  ctx.fillText(payload.reportTitle, pageW - margin - 20, y + 40);
  if (payload.subtitle) {
    ctx.fillStyle = '#325d68';
    ctx.font = '600 19px Tajawal, Cairo, sans-serif';
    ctx.fillText(payload.subtitle, pageW - margin - 20, y + 74);
  }
  y += (payload.subtitle ? 94 : 66) + 20;

  // Metadata cards (3 cols)
  if (payload.metadata.length > 0) {
    const cols = 3;
    const gap = 12;
    const cardW = (contentW - gap * (cols - 1)) / cols;
    const rowsCount = Math.ceil(payload.metadata.length / cols);
    ensureSpace(rowsCount * 62 + 12);
    payload.metadata.forEach((m, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const x = pageW - margin - cardW * (c + 1) - gap * c;
      const cy = y + r * 62;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(x, cy, cardW, 52, 10);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748b';
      ctx.font = '600 16px Tajawal, Cairo, sans-serif';
      ctx.fillText(`${m.label}:`, x + cardW - 12, cy + 22);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px Tajawal, Cairo, sans-serif';
      ctx.fillText(String(m.value).slice(0, 32), x + cardW - 12, cy + 44);
    });
    y += rowsCount * 62 + 16;
  }

  // KPI cards (4 cols)
  if (payload.kpis.length > 0) {
    const cols = 4;
    const gap = 12;
    const cardW = (contentW - gap * (cols - 1)) / cols;
    const rowsCount = Math.ceil(payload.kpis.length / cols);
    ensureSpace(rowsCount * 82 + 12);
    payload.kpis.forEach((k, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const x = pageW - margin - cardW * (c + 1) - gap * c;
      const cy = y + r * 82;
      ctx.fillStyle = '#f4f7f8';
      ctx.beginPath();
      ctx.roundRect(x, cy, cardW, 70, 12);
      ctx.fill();
      ctx.strokeStyle = '#c5d8df';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#475569';
      ctx.font = '600 16px Tajawal, Cairo, sans-serif';
      ctx.fillText(k.label.slice(0, 26), x + cardW / 2, cy + 25);
      ctx.fillStyle = '#3b707d';
      ctx.font = 'bold 26px Tajawal, Cairo, sans-serif';
      ctx.fillText(String(k.value), x + cardW / 2, cy + 56);
    });
    y += rowsCount * 82 + 18;
  }

  // Charts
  for (const chart of payload.charts || []) {
    if (chart.bars.length === 0) continue;
    ensureSpace(60 + chart.bars.length * 40);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#162b31';
    ctx.font = 'bold 22px Tajawal, Cairo, sans-serif';
    ctx.fillText(`▪ ${chart.title}`, pageW - margin, y + 22);
    y += 38;
    const maxVal = Math.max(1, ...chart.bars.map((b) => b.value));
    for (const bar of chart.bars) {
      ensureSpace(44);
      ctx.fillStyle = '#334155';
      ctx.font = '600 17px Tajawal, Cairo, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(bar.label.slice(0, 48), pageW - margin, y + 16);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#162b31';
      ctx.font = 'bold 17px Tajawal, Cairo, sans-serif';
      ctx.fillText(`${bar.value}${bar.unit ? ` ${bar.unit}` : ''}`, margin, y + 16);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(margin, y + 24, contentW, 12, 6);
      ctx.fill();
      const fillW = bar.value === 0 ? 0 : Math.max(18, Math.round((bar.value / maxVal) * contentW));
      if (fillW > 0) {
        ctx.fillStyle = '#3b707d';
        ctx.beginPath();
        ctx.roundRect(pageW - margin - fillW, y + 24, fillW, 12, 6);
        ctx.fill();
      }
      y += 44;
    }
    y += 14;
  }

  // Tables
  for (const tbl of payload.tables) {
    ensureSpace(100);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#162b31';
    ctx.font = 'bold 22px Tajawal, Cairo, sans-serif';
    ctx.fillText(`▪ ${tbl.title}`, pageW - margin, y + 22);
    y += 36;

    const colCount = Math.max(1, tbl.columns.length);
    const colW = contentW / colCount;

    const drawTableHeader = () => {
      ctx.fillStyle = '#3b707d';
      ctx.fillRect(margin, y, contentW, 42);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Tajawal, Cairo, sans-serif';
      ctx.textAlign = 'center';
      tbl.columns.forEach((col, cIdx) => {
        const cx = pageW - margin - colW * cIdx - colW / 2;
        ctx.fillText(String(col).slice(0, 20), cx, y + 27);
      });
      y += 42;
    };

    drawTableHeader();

    if (tbl.rows.length === 0) {
      ensureSpace(44);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(margin, y, contentW, 40);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(margin, y, contentW, 40);
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.font = '600 16px Tajawal, Cairo, sans-serif';
      ctx.fillText('لا توجد بيانات مسجلة خلال هذه الفترة', pageW / 2, y + 26);
      y += 40;
    } else {
      for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
        if (y + 42 > pageH - 90) {
          drawPageFooter(ctx, pages.length);
          ctx = createPage();
          y = margin;
          drawTableHeader();
        }
        const row = tbl.rows[rIdx];
        ctx.fillStyle = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
        ctx.fillRect(margin, y, contentW, 38);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin, y, contentW, 38);
        ctx.fillStyle = '#1e293b';
        ctx.font = '600 15px Tajawal, Cairo, sans-serif';
        ctx.textAlign = 'center';
        row.forEach((cell, cIdx) => {
          const cx = pageW - margin - colW * cIdx - colW / 2;
          ctx.fillText(String(cell ?? '-').slice(0, 24), cx, y + 24);
        });
        y += 38;
      }
    }
    y += 22;
  }

  // Notes & Recommendations
  for (const block of payload.notesBlocks || []) {
    ensureSpace(80 + block.items.length * 46);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#162b31';
    ctx.font = 'bold 22px Tajawal, Cairo, sans-serif';
    ctx.fillText(`▪ ${block.title}`, pageW - margin, y + 22);
    y += 36;
    for (const item of block.items) {
      ensureSpace(58);
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(margin, y, contentW, 50, 10);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#3b707d';
      ctx.font = 'bold 16px Tajawal, Cairo, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${item.label}:`, pageW - margin - 14, y + 21);
      ctx.fillStyle = '#1e293b';
      ctx.font = '500 16px Tajawal, Cairo, sans-serif';
      ctx.fillText(String(item.value || '—').slice(0, 95), pageW - margin - 14, y + 43);
      y += 58;
    }
    y += 14;
  }

  // Signatures
  if (reportSettings.showSignatures) {
    ensureSpace(120);
    const sigW = (contentW - 24) / 2;
    const drawSig = (x: number, title: string, name: string, lineText: string) => {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(x, y, sigW, 100, 14);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillStyle = '#162b31';
      ctx.font = 'bold 18px Tajawal, Cairo, sans-serif';
      ctx.fillText(title, x + sigW - 16, y + 30);
      ctx.fillStyle = '#3b707d';
      ctx.font = '600 17px Tajawal, Cairo, sans-serif';
      ctx.fillText(name, x + sigW - 16, y + 58);
      ctx.fillStyle = '#64748b';
      ctx.font = '500 15px Tajawal, Cairo, sans-serif';
      ctx.fillText(lineText, x + sigW - 16, y + 84);
    };

    drawSig(
      pageW - margin - sigW,
      reportSettings.supervisorSignatureLabel,
      payload.supervisorName || 'المشرف المسؤول',
      'التوقيع: .............................'
    );
    drawSig(
      margin,
      reportSettings.adminSignatureLabel,
      `${reportSettings.signatoryTitle} • ${reportSettings.signatoryName}`,
      'الختم والاعتماد: .....................'
    );
  }

  drawPageFooter(ctx, pages.length);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  pages.forEach((canvas, idx) => {
    if (idx > 0) pdf.addPage();
    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
  });

  pdf.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
}
