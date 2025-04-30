import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

// Ensure the plugin is properly integrated with jsPDF

// Add type definition for jsPDF with autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    internal: {
      events: PubSub;
      scaleFactor: number;
      pageSize: {
        width: number;
        getWidth: () => number;
        height: number;
        getHeight: () => number;
      };
      pages: number[];
      getEncryptor(objectId: number): (data: string) => string;
      // Removed to match the original type definition
    };
  }
}

interface PubSub {
  // Minimal PubSub interface - can be expanded if needed
  subscribe: (event: string, callback: Function) => void;
  publish: (event: string, data: any) => void;
}

interface Column {
  header: string;
  dataKey: string;
  styles?: object;
}

interface PdfOptions {
  title: string;
  fileName: string;
  orientation?: 'portrait' | 'landscape';
  subtitle?: string;
  footerText?: string;
}

export const generatePDF = (
  columns: Column[], 
  data: any[], 
  options: PdfOptions
) => {
  const { title, fileName, orientation = 'portrait', subtitle, footerText } = options;
  
  // Create PDF document
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });
  
  // Set font
  doc.setFont('helvetica', 'normal');
  
  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 20);
  
  // Add subtitle if provided
  if (subtitle) {
    doc.setFontSize(12);
    doc.text(subtitle, 14, 30);
  }
  
  // Add date
  doc.setFontSize(10);
  doc.text(`Generated on: ${format(new Date(), 'MMM dd, yyyy hh:mm a')}`, 14, subtitle ? 40 : 30);
  
  // Convert data for autoTable
  const tableData = data.map(item => {
    const row: Record<string, any> = {};
    columns.forEach(col => {
      row[col.dataKey] = item[col.dataKey];
    });
    return Object.values(row);
  });
  
  // Generate table
doc.autoTable({
    head: [columns.map(col => col.header)],
    body: tableData,
    startY: subtitle ? 45 : 35,
    styles: { 
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [67, 115, 88],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 247, 243],
    },
  });
  
  // Add footer if provided
  if (footerText) {
    const pageCount = doc.internal.pages.length;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(footerText, 14, doc.internal.pageSize.height - 10);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }
  }
  
  // Save PDF
  doc.save(`${fileName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// Helper function to format currency
export const formatCurrency = (amount: number | string) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(numAmount);
};
