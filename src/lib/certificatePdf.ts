import jsPDF from 'jspdf';
import { ReadingCertificate } from '../types';
import { formatUmmAlQuraDate, formatArabicDate } from './dateUtils';

function wrapCenteredLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawCornerOrnament(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotRad: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotRad);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 70);
  ctx.lineTo(0, 0);
  ctx.lineTo(70, 0);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, 52);
  ctx.lineTo(14, 14);
  ctx.lineTo(52, 14);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(14, 14, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function downloadCertificatePdf(
  cert: ReadingCertificate,
  libraryName = 'مكتبة وثبة الذكية'
): Promise<void> {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // المتابعة بالخط المتاح
    }
  }

  const width = 1754;
  const height = 1240;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر تهيئة لوحة رسم الشهادة');

  const isWathab = cert.themeKeySnapshot === 'wathab';
  const primary = cert.primaryColorSnapshot || '#3b707d';
  const accent = cert.accentColorSnapshot || '#d4af37';

  // 1. خلفية الشهادة الفاخرة
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isWathab) {
    bgGrad.addColorStop(0, '#fffdf5');
    bgGrad.addColorStop(0.5, '#fef9e7');
    bgGrad.addColorStop(1, '#fbf3d5');
  } else {
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(0.5, '#f8fafc');
    bgGrad.addColorStop(1, cert.secondaryColorSnapshot || '#e3ecf3');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // هالة مائية خفيفة في المنتصف
  ctx.save();
  ctx.globalAlpha = isWathab ? 0.08 : 0.05;
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 340, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. الإطار المزدوج الفخم
  ctx.strokeStyle = primary;
  ctx.lineWidth = isWathab ? 18 : 14;
  ctx.strokeRect(42, 42, width - 84, height - 84);

  ctx.strokeStyle = isWathab ? '#d4af37' : accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(66, 66, width - 132, height - 132);

  // زخارف الزوايا الأربع
  const ornColor = isWathab ? '#b45309' : accent;
  drawCornerOrnament(ctx, 84, 84, 0, ornColor);
  drawCornerOrnament(ctx, width - 84, 84, Math.PI / 2, ornColor);
  drawCornerOrnament(ctx, width - 84, height - 84, Math.PI, ornColor);
  drawCornerOrnament(ctx, 84, height - 84, -Math.PI / 2, ornColor);

  ctx.textAlign = 'center';
  ctx.direction = 'rtl';

  // 3. شعار وترويسة مكتبة وثبة الذكية
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.arc(width / 2, 165, 48, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(width / 2, 165, 56, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Tajawal, Cairo, sans-serif';
  ctx.fillText('وثبة', width / 2, 175);

  ctx.fillStyle = primary;
  ctx.font = 'bold 28px Tajawal, Cairo, sans-serif';
  ctx.fillText(cert.issuerOrganization || libraryName, width / 2, 260);

  // 4. عنوان الشهادة الرئيسي
  ctx.fillStyle = isWathab ? '#92400e' : '#0f172a';
  ctx.font = 'bold 62px Tajawal, Cairo, sans-serif';
  ctx.fillText('شهادة إنجاز قرائي', width / 2, 345);

  // خط فاصل ذهبي
  ctx.strokeStyle = isWathab ? '#d4af37' : accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 220, 375);
  ctx.lineTo(width / 2 + 220, 375);
  ctx.stroke();

  // 5. نص التقديم واسم الطالب
  ctx.fillStyle = '#475569';
  ctx.font = '600 28px Tajawal, Cairo, sans-serif';
  ctx.fillText('تشهد إدارة المكتبة بكل فخر واعتزاز بأن الطالب المتميز:', width / 2, 445);

  ctx.fillStyle = primary;
  ctx.font = 'bold 58px Tajawal, Cairo, sans-serif';
  ctx.fillText(cert.studentNameSnapshot, width / 2, 525);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 24px Tajawal, Cairo, sans-serif';
  ctx.fillText(cert.studentGradeSnapshot || '', width / 2, 570);

  // 6. شارة اللقب المستحق وعدد الصفحات
  ctx.fillStyle = '#334155';
  ctx.font = '600 28px Tajawal, Cairo, sans-serif';
  ctx.fillText(
    `قد أتمَّ بنجاح قراءة واعتماد (${cert.pagesCompletedSnapshot.toLocaleString('ar-SA')} صفحة) واستحق عن جدارة لقب:`,
    width / 2,
    635
  );

  // صندوق اللقب الملوّن
  const pillW = 540;
  const pillH = 88;
  const pillX = width / 2 - pillW / 2;
  const pillY = 665;
  ctx.save();
  ctx.fillStyle = isWathab ? '#162b31' : primary;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 44);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = isWathab ? '#fef08a' : '#ffffff';
  ctx.font = 'bold 42px Tajawal, Cairo, sans-serif';
  ctx.fillText(
    isWathab ? `★ ${cert.rankTitleSnapshot} ★` : cert.rankTitleSnapshot,
    width / 2,
    724
  );

  // 7. العبارة التحفيزية
  ctx.fillStyle = '#334155';
  ctx.font = '600 25px Tajawal, Cairo, sans-serif';
  const phraseLines = wrapCenteredLines(ctx, cert.motivationalPhrase, 1240);
  phraseLines.slice(0, 2).forEach((line, idx) => {
    ctx.fillText(line, width / 2, 815 + idx * 42);
  });

  // 8. بيانات التوثيق والتاريخ والتوقيع
  const hijri = formatUmmAlQuraDate(cert.issuedAt);
  const greg = formatArabicDate(cert.issuedAt);

  // اليمين: تاريخ الإصدار والرقم الفريد
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px Tajawal, Cairo, sans-serif';
  ctx.fillText(`تاريخ الإصدار: ${hijri}`, width - 150, 995);
  ctx.fillStyle = '#475569';
  ctx.font = '600 20px Tajawal, Cairo, sans-serif';
  ctx.fillText(`الموافق: ${greg}`, width - 150, 1030);
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`رقم الشهادة: ${cert.certificateNumber}`, width - 150, 1068);

  // المنتصف: ختم المكتبة الرسمي
  ctx.textAlign = 'center';
  ctx.save();
  ctx.strokeStyle = primary;
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.arc(width / 2, 1020, 68, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = primary;
  ctx.font = 'bold 20px Tajawal, Cairo, sans-serif';
  ctx.fillText('ختم الاعتماد', width / 2, 1015);
  ctx.font = '600 18px Tajawal, Cairo, sans-serif';
  ctx.fillText('مكتبة وثبة', width / 2, 1045);

  // اليسار: الجهة المصدرة والتوقيع
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px Tajawal, Cairo, sans-serif';
  ctx.fillText(cert.signatoryTitle, 150, 995);
  ctx.fillStyle = primary;
  ctx.font = 'bold 26px Tajawal, Cairo, sans-serif';
  ctx.fillText(cert.signatoryName, 150, 1035);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 18px Tajawal, Cairo, sans-serif';
  ctx.fillText(
    cert.isReissue ? `نسخة معاد إصدارها (#${cert.version})` : 'إصدار إلكتروني موثق',
    150,
    1070
  );

  // التذييل
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = '600 18px Tajawal, Cairo, sans-serif';
  ctx.fillText(cert.footerNote, width / 2, 1142);

  // 9. التحويل إلى PDF حقيقي وتنزيله
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });
  pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
  pdf.save(`شهادة-${cert.rankTitleSnapshot}-${cert.studentNameSnapshot}.pdf`);
}

export function printCertificateHighQuality(
  cert: ReadingCertificate,
  libraryName = 'مكتبة وثبة الذكية'
): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة الشهادة');
    return;
  }

  const isWathab = cert.themeKeySnapshot === 'wathab';
  const primary = cert.primaryColorSnapshot || '#3b707d';
  const accent = cert.accentColorSnapshot || '#d4af37';
  const secondary = cert.secondaryColorSnapshot || '#e3ecf3';
  const hijri = formatUmmAlQuraDate(cert.issuedAt);
  const greg = formatArabicDate(cert.issuedAt);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>شهادة ${cert.rankTitleSnapshot} - ${cert.studentNameSnapshot}</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;800;900&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body {
          margin: 0;
          padding: 0;
          font-family: 'Tajawal', sans-serif;
          background: #ffffff;
          direction: rtl;
        }
        @page {
          size: A4 landscape;
          margin: 0;
        }
        .sheet {
          width: 297mm;
          height: 210mm;
          padding: 10mm;
          background: ${isWathab ? 'linear-gradient(135deg, #fffdf5 0%, #fef9e7 50%, #fbf3d5 100%)' : `linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, ${secondary} 100%)`};
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .frame-outer {
          width: 100%;
          height: 100%;
          border: 6px solid ${primary};
          padding: 4mm;
          position: relative;
        }
        .frame-inner {
          width: 100%;
          height: 100%;
          border: 2px solid ${isWathab ? '#d4af37' : accent};
          padding: 12mm 18mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
          position: relative;
        }
        .emblem {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: ${primary};
          color: #fff;
          border: 3px solid #d4af37;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 18px;
          margin: 0 auto 6px;
        }
        .org { color: ${primary}; font-weight: 800; font-size: 16px; }
        .title { font-size: 38px; font-weight: 900; color: ${isWathab ? '#92400e' : '#0f172a'}; margin: 4px 0; }
        .divider { width: 180px; height: 3px; background: ${isWathab ? '#d4af37' : accent}; margin: 0 auto 10px; }
        .intro { font-size: 16px; color: #475569; font-weight: 700; }
        .student-name { font-size: 36px; font-weight: 900; color: ${primary}; margin: 6px 0 2px; }
        .student-grade { font-size: 14px; color: #64748b; font-weight: 700; }
        .pages-text { font-size: 16px; color: #334155; font-weight: 700; margin-top: 10px; }
        .rank-pill {
          display: inline-block;
          margin: 10px auto;
          padding: 10px 44px;
          border-radius: 999px;
          background: ${isWathab ? '#162b31' : primary};
          color: ${isWathab ? '#fef08a' : '#ffffff'};
          border: 3px solid #d4af37;
          font-size: 26px;
          font-weight: 900;
        }
        .phrase { font-size: 15px; color: #334155; font-weight: 700; max-width: 720px; margin: 6px auto; line-height: 1.7; }
        .footer-grid {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-top: 12px;
          font-size: 13px;
        }
        .seal {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          border: 2px dashed ${primary};
          color: ${primary};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 11px;
        }
        .bottom-note { font-size: 11px; color: #64748b; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="frame-outer">
          <div class="frame-inner">
            <div>
              <div class="emblem">وثبة</div>
              <div class="org">${cert.issuerOrganization || libraryName}</div>
              <h1 class="title">شهادة إنجاز قرائي</h1>
              <div class="divider"></div>
            </div>

            <div>
              <div class="intro">تشهد إدارة المكتبة بكل فخر واعتزاز بأن الطالب المتميز:</div>
              <div class="student-name">${cert.studentNameSnapshot}</div>
              <div class="student-grade">${cert.studentGradeSnapshot || ''}</div>
              <div class="pages-text">
                قد أتمَّ بنجاح قراءة واعتماد (${cert.pagesCompletedSnapshot.toLocaleString('ar-SA')} صفحة) واستحق عن جدارة لقب:
              </div>
              <div class="rank-pill">${isWathab ? `★ ${cert.rankTitleSnapshot} ★` : cert.rankTitleSnapshot}</div>
              <p class="phrase">${cert.motivationalPhrase}</p>
            </div>

            <div>
              <div class="footer-grid">
                <div style="text-align: right;">
                  <div style="font-weight: 800; color: #0f172a;">تاريخ الإصدار: ${hijri}</div>
                  <div style="color: #475569;">الموافق: ${greg}</div>
                  <div style="font-family: monospace; font-weight: 800; color: #334155;">رقم الشهادة: ${cert.certificateNumber}</div>
                </div>
                <div class="seal">
                  <span>ختم الاعتماد</span>
                  <span>مكتبة وثبة</span>
                </div>
                <div style="text-align: left;">
                  <div style="font-weight: 800; color: #0f172a;">${cert.signatoryTitle}</div>
                  <div style="font-weight: 900; font-size: 16px; color: ${primary};">${cert.signatoryName}</div>
                  <div style="color: #64748b; font-size: 11px;">${cert.isReissue ? `نسخة معاد إصدارها (#${cert.version})` : 'إصدار إلكتروني موثق'}</div>
                </div>
              </div>
              <div class="bottom-note">${cert.footerNote}</div>
            </div>
          </div>
        </div>
      </div>
      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
