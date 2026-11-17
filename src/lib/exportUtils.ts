import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// تصدير جدول إلى ملف Excel XLSX مع توجيه RTL
export function exportToExcel(data: any[], fileName: string, sheetName = 'بيانات المكتبة') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // ضبط اتجاه الورقة لليمين
  if (!wb.Workbook) wb.Workbook = {};
  if (!wb.Workbook.Views) wb.Workbook.Views = [{}];
  
  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// دالة الطباعة المباشرة لتقرير بتنسيق أنيق
export function printDirectReport(title: string, htmlContent: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>${title} | مكتبة وثبة الذكية</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Cairo', sans-serif;
          direction: rtl;
          padding: 24px;
          color: #1e293b;
          background: #ffffff;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #047857;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .logo-title {
          font-size: 24px;
          font-weight: 700;
          color: #047857;
        }
        .subtitle {
          font-size: 14px;
          color: #64748b;
          margin-top: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
          font-size: 13px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          text-align: right;
        }
        th {
          background-color: #f1f5f9;
          font-weight: 700;
          color: #0f172a;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 12px;
        }
        @media print {
          @page { margin: 1.5cm; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-title">مكتبة وثبة الذكية</div>
        <div class="subtitle">فريق وثبة - تقرير رسمي معتمد</div>
        <h2 style="margin-top: 12px; font-size: 18px; color: #334155;">${title}</h2>
        <div style="font-size: 12px; color: #64748b;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</div>
      </div>
      <div class="content">
        ${htmlContent}
      </div>
      <div class="footer">
        تم استخراج هذا التقرير آلياً من منصة «مكتبة وثبة الذكية» • جميع العمليات محفوظة وموثقة
      </div>
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}
