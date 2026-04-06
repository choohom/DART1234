/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  Trash2, 
  FileText, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Download,
  Package,
  Settings2,
  RefreshCw
} from 'lucide-react';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { 
  Document, 
  Packer, 
  Paragraph, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  HeadingLevel,
  TextRun,
  VerticalAlign,
  BorderStyle,
  ImageRun,
  Footer,
  Header,
} from 'docx';
import { saveAs } from 'file-saver';
import { cn } from '@/src/lib/utils';
import { Material, AssessmentItem, GOOGLE_SHEET_ID } from './types';

// Add type for jsPDF with autotable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function App() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  
  // Assessment List
  const [items, setItems] = useState<AssessmentItem[]>([]);

  // Fetch data from Google Sheet
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length <= 1) {
            setError('ไม่พบข้อมูลใน Google Sheet หรือไฟล์ว่างเปล่า');
            setLoading(false);
            return;
          }

          const dataRows = results.data.slice(1);

          const mappedData: Material[] = dataRows
            .filter((row: any) => row[2])
            .map((row: any) => {
              const id = String(row[1] || '').trim();
              const name = String(row[2] || '').trim();
              const unit = String(row[3] || 'หน่วย').trim();
              
              const parsePrice = (val: any) => {
                if (!val) return 0;
                return parseFloat(String(val).replace(/,/g, '').replace(/฿/g, '').trim()) || 0;
              };

              const priceDamaged = parsePrice(row[4]);
              const priceReusable = parsePrice(row[5]);
              
              return { id, name, unit, priceDamaged, priceReusable };
            });
          
          if (mappedData.length === 0) {
            setError('ไม่สามารถดึงข้อมูลพัสดุได้ กรุณาตรวจสอบรูปแบบข้อมูลใน Sheet');
          } else {
            setMaterials(mappedData);
          }
          setLoading(false);
        },
        error: (err: any) => {
          console.error('Parsing error:', err);
          setError('ไม่สามารถประมวลผลข้อมูล CSV ได้');
          setLoading(false);
        }
      });
    } catch (err) {
      console.error('Fetch error:', err);
      setError('ไม่สามารถเชื่อมต่อกับ Google Sheet ได้ กรุณาตรวจสอบการแชร์ไฟล์');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredMaterials = useMemo(() => {
    if (!searchQuery) return [];
    return materials.filter(m => 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.id.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [materials, searchQuery]);

  const handleStatusSelect = (selectedStatus: 'damaged' | 'reusable') => {
    if (!selectedMaterial) return;
    
    const currentPrice = selectedStatus === 'damaged' ? selectedMaterial.priceDamaged : selectedMaterial.priceReusable;
    
    const newItem: AssessmentItem = {
      material: selectedMaterial,
      quantity,
      status: selectedStatus,
      totalPrice: currentPrice * quantity
    };
    
    setItems([...items, newItem]);
    resetForm();
  };

  const resetForm = () => {
    setSelectedMaterial(null);
    setSearchQuery('');
    setQuantity(1);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

  const exportWord = async () => {
    // Helper to fetch image and convert to ArrayBuffer
    const fetchImage = async (url: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await blob.arrayBuffer();
      } catch (error) {
        console.error("Error fetching logo:", error);
        return null;
      }
    };

    const logoBuffer = await fetchImage("https://img1.pic.in.th/images/PEA-02-Thai-Logo.md.jpg");

    // Helper to group items by material name
    const groupItems = (itemsList: AssessmentItem[]) => {
      const grouped: { [key: string]: AssessmentItem } = {};
      itemsList.forEach(item => {
        const key = item.material.name;
        if (grouped[key]) {
          grouped[key] = {
            ...grouped[key],
            quantity: grouped[key].quantity + item.quantity,
            totalPrice: grouped[key].totalPrice + item.totalPrice
          };
        } else {
          grouped[key] = { ...item };
        }
      });
      return Object.values(grouped);
    };

    const damagedItems = groupItems(items.filter(i => i.status === 'damaged'));
    const reusableItems = groupItems(items.filter(i => i.status === 'reusable'));
    
    const totalItems = damagedItems.length + reusableItems.length;
    
    const damagedCount = damagedItems.length;
    const damagedTotal = damagedItems.reduce((sum, i) => sum + i.totalPrice, 0);
    
    const reusableCount = reusableItems.length;
    const reusableTotal = reusableItems.reduce((sum, i) => sum + i.totalPrice, 0);

    const createTableHeader = () => new TableRow({
      children: [
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "รายการ", alignment: AlignmentType.CENTER, style: "bold" })] }),
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "ชื่อพัสดุ", alignment: AlignmentType.CENTER, style: "bold" })] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "จำนวน", alignment: AlignmentType.CENTER, style: "bold" })] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "หน่วย", alignment: AlignmentType.CENTER, style: "bold" })] }),
        new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "ราคา", alignment: AlignmentType.CENTER, style: "bold" })] }),
      ],
    });

    const damagedTableRows = damagedItems.map((item, index) => (
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: (index + 1).toString(), alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: item.material.name })] }),
          new TableCell({ children: [new Paragraph({ text: item.quantity.toString(), alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: item.material.unit, alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), alignment: AlignmentType.RIGHT })] }),
        ],
      })
    ));

    const reusableTableRows = reusableItems.map((item, index) => (
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: (index + 1).toString(), alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: item.material.name })] }),
          new TableCell({ children: [new Paragraph({ text: item.quantity.toString(), alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: item.material.unit, alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: [new Paragraph({ text: item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), alignment: AlignmentType.RIGHT })] }),
        ],
      })
    ));

    const createEmptyRows = (count: number) => {
      const rows = [];
      for (let i = 0; i < count; i++) {
        rows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: "" })] }),
            new TableCell({ children: [new Paragraph({ text: "" })] }),
            new TableCell({ children: [new Paragraph({ text: "" })] }),
            new TableCell({ children: [new Paragraph({ text: "" })] }),
            new TableCell({ children: [new Paragraph({ text: "" })] }),
          ],
        }));
      }
      return rows;
    };

    const damagedTableRowsWithEmpty = [...damagedTableRows, ...createEmptyRows(Math.max(0, 5 - damagedItems.length))];
    const reusableTableRowsWithEmpty = [...reusableTableRows, ...createEmptyRows(Math.max(0, 5 - reusableItems.length))];

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "TH Sarabun New",
              size: 32, // 16pt
            },
          },
        },
      },
      sections: [{
        properties: {
          titlePage: true,
          page: {
            margin: {
              top: 1417, // 2.5 cm
              bottom: 1417,
              left: 1701, // 3 cm
              right: 1134, // 2 cm
            },
          },
        },
        headers: {
          first: new Header({ children: [] }),
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun("- 2 -")],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        footers: {
          first: new Footer({ children: [] }),
          default: new Footer({
            children: [
              new Paragraph({
                text: "หน่วยงาน",
              }),
              new Paragraph({
                text: "โทร. ...........................................................",
              }),
            ],
          }),
        },
        children: [
          // Logo
          ...(logoBuffer ? [
            new Paragraph({
              children: [
                new ImageRun({
                  data: logoBuffer,
                  type: "jpg",
                  transformation: {
                    width: 157,
                    height: 132,
                  },
                }),
              ],
              alignment: AlignmentType.LEFT,
              spacing: { after: 100 },
            })
          ] : []),
          
          // Header Table for From/To and No/Date
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: "จาก ......................................................................" })] }),
                  new TableCell({ children: [new Paragraph({ text: "ถึง ......................................................................", alignment: AlignmentType.CENTER })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: "เลขที่ ....................................................................." })] }),
                  new TableCell({ children: [new Paragraph({ text: "วันที่ .....................................................................", alignment: AlignmentType.CENTER })] }),
                ],
              }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: "เรื่อง   การประเมินค่าเสียหายที่เกิดขึ้นกับระบบจำหน่าย" })],
            spacing: { before: 200 },
          }),
          new Paragraph({ text: "เรียน ......................................................................" }),
          new Paragraph({
            children: [
              new TextRun({ text: "ตามที่ได้ดำเนินการตรวจสอบและประเมินราคาค่าเสียหายเพื่อเรียกร้องจากผู้กระทำละเมิด โดยมีรายละเอียด ดังนี้" }),
            ],
            indent: { firstLine: 1417 }, // 2.5 cm
            spacing: { before: 200 },
            alignment: AlignmentType.THAI_DISTRIBUTE,
          }),
          new Paragraph({ text: "1. เหตุเกิดเมื่อ ...........................................................................................................................", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "2. สถานที่เกิดเหตุ .....................................................................................................................", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "3. หมายเลขทะเบียน ................................................................................................................", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "4. ชื่อผู้ขับขี่ ..............................................................................................................................", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "   บัตรประชาชนเลขที่ ......................................................................................................", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "5. ที่อยู่ตามบัตร ........................................................................................................................", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "   ........................................................................................................... เบอร์โทรศัพท์ ....................................", alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "6. ชื่อ/บริษัท เจ้าของรถยนต์ ..................................... เบอร์โทรศัพท์ ....................................", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "7. ชื่อ/บริษัท ประกันภัย ............................................ เบอร์โทรศัพท์ ....................................", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "8. ผู้ลงนามในหนังสือรับสภาพหนี้", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "   [  ] ผู้ขับขี่    [  ] เจ้าของรถยนต์    [  ] ไม่ยินยอม", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "9. การแจ้งความร้องทุกข์กับเจ้าหน้าที่ตำรวจ", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "   [  ] แจ้งเป็นหลักฐาน    [  ] แจ้งความเป็นคดี เนื่องจาก ...........................................", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "10. กรณีรถยนต์เกี่ยวสายสื่อสารทำให้เกิดความเสียหายกับระบบจำหน่าย", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({ text: "    ชื่อ/บริษัท เจ้าของสายสื่อสาร ............................................ ความสูง ...........................", indent: { left: 1417 }, alignment: AlignmentType.THAI_DISTRIBUTE }),
          new Paragraph({
            children: [
              new TextRun({ text: `11. รายการอุปกรณ์ที่ได้รับความเสียหาย ${totalItems} รายการ คิดเป็นค่าเสียหาย จำนวนเงินทั้งสิ้น ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท โดยมีรายละเอียดดังนี้` }),
            ],
            spacing: { before: 400 },
            indent: { firstLine: 1417 }, // 2.5 cm for first line only
            alignment: AlignmentType.THAI_DISTRIBUTE,
            pageBreakBefore: true,
          }),
          new Paragraph({
            text: `11.1 รื้อถอน - ติดตั้งใหม่ ${damagedCount} รายการ เป็นจำนวนเงินทั้งสิ้น ${damagedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
            indent: { left: 1701 },
            spacing: { before: 200, after: 100 },
            alignment: AlignmentType.THAI_DISTRIBUTE,
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.CENTER,
            rows: [createTableHeader(), ...damagedTableRowsWithEmpty],
          }),
          new Paragraph({
            text: `11.2 แผนกซ่อมแซม ${reusableCount} รายการ เป็นจำนวนเงินทั้งสิ้น ${reusableTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
            indent: { left: 1701 },
            spacing: { before: 400, after: 100 },
            alignment: AlignmentType.THAI_DISTRIBUTE,
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.CENTER,
            rows: [createTableHeader(), ...reusableTableRowsWithEmpty],
          }),
          new Paragraph({
            text: `จึงเรียนมาเพื่อพิจารณาอนุมัติให้ดำเนินการเบิกอุปกรณ์ไปซ่อมแซมตามรายการดังกล่าว พร้อมทั้งเป็นการเรียกเก็บเงินค่าเสียหายจากผู้กระทำละเมิด เป็นจำนวนเงินทั้งสิ้น ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
            indent: { firstLine: 1417 }, // 2.5 cm
            spacing: { before: 600 },
            alignment: AlignmentType.THAI_DISTRIBUTE,
          }),
          new Paragraph({
            text: "(...........................................................)",
            alignment: AlignmentType.CENTER,
            spacing: { before: 1000 },
            indent: { left: 4000 },
          }),
          new Paragraph({
            text: "ตำแหน่ง",
            alignment: AlignmentType.CENTER,
            indent: { left: 4000 },
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "ค่าละเมิด1234_PI InnoTech.docx");
  };

  const exportPDF = async () => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    
    // Helper to convert ArrayBuffer to Base64 without stack overflow
    const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    };

    // Helper to fetch font and add to jsPDF
    const addThaiFont = async () => {
      try {
        // Using jsdelivr from the main google/fonts repository for better stability
        const regularFontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Regular.ttf';
        const boldFontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Bold.ttf';
        
        const [regularRes, boldRes] = await Promise.all([
          fetch(regularFontUrl),
          fetch(boldFontUrl)
        ]);
        
        if (!regularRes.ok) throw new Error(`Failed to fetch Regular font from jsdelivr: ${regularRes.status} ${regularRes.statusText}`);
        if (!boldRes.ok) throw new Error(`Failed to fetch Bold font from jsdelivr: ${boldRes.status} ${boldRes.statusText}`);

        const [regularBuffer, boldBuffer] = await Promise.all([
          regularRes.arrayBuffer(),
          boldRes.arrayBuffer()
        ]);
        
        const regularBase64 = arrayBufferToBase64(regularBuffer);
        const boldBase64 = arrayBufferToBase64(boldBuffer);
        
        doc.addFileToVFS('Sarabun-Regular.ttf', regularBase64);
        doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
        
        doc.addFileToVFS('Sarabun-Bold.ttf', boldBase64);
        doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
        
        doc.setFont('Sarabun', 'normal');
        return true;
      } catch (error) {
        console.error("Error loading Thai font:", error);
        return false;
      }
    };

    const hasFont = await addThaiFont();
    if (!hasFont) {
      alert("ไม่สามารถโหลดฟอนต์ภาษาไทยได้ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    // Helper to fetch image and convert to base64
    const fetchImageBase64 = async (url: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error("Error fetching logo:", error);
        return null;
      }
    };

    const logoBase64 = await fetchImageBase64("https://img1.pic.in.th/images/PEA-02-Thai-Logo.md.jpg");

    // Helper to group items by material name
    const groupItems = (itemsList: AssessmentItem[]) => {
      const grouped: { [key: string]: AssessmentItem } = {};
      itemsList.forEach(item => {
        const key = item.material.name;
        if (grouped[key]) {
          grouped[key] = {
            ...grouped[key],
            quantity: grouped[key].quantity + item.quantity,
            totalPrice: grouped[key].totalPrice + item.totalPrice
          };
        } else {
          grouped[key] = { ...item };
        }
      });
      return Object.values(grouped);
    };

    const damagedItems = groupItems(items.filter(i => i.status === 'damaged'));
    const reusableItems = groupItems(items.filter(i => i.status === 'reusable'));
    
    const totalItems = damagedItems.length + reusableItems.length;
    const damagedTotal = damagedItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const reusableTotal = reusableItems.reduce((sum, i) => sum + i.totalPrice, 0);

    // Page 1
    let currentY = 20;

    // Logo
    if (logoBase64) {
      doc.addImage(logoBase64, 'JPEG', 25, currentY, 30, 25);
      currentY += 30;
    }

    // Header Table
    doc.setFontSize(14);
    const lineHeight = 7;
    
    doc.text("จาก ......................................................................", 25, currentY);
    doc.text("ถึง ......................................................................", 105, currentY, { align: "center" });
    currentY += lineHeight + 3;
    doc.text("เลขที่ .....................................................................", 25, currentY);
    doc.text("วันที่ .....................................................................", 105, currentY, { align: "center" });
    currentY += lineHeight + 8;

    // Subject
    doc.setFont('Sarabun', 'normal');
    doc.text("เรื่อง   การประเมินค่าเสียหายที่เกิดขึ้นกับระบบจำหน่าย", 25, currentY);
    currentY += lineHeight + 3;
    doc.text("เรียน ......................................................................", 25, currentY);
    currentY += lineHeight + 5;

    // Content
    const content = "ตามที่ได้ดำเนินการตรวจสอบและประเมินราคาค่าเสียหายเพื่อเรียกร้องจากผู้กระทำละเมิด โดยมีรายละเอียด ดังนี้";
    const splitContent = doc.splitTextToSize(content, 160);
    doc.text(splitContent, 40, currentY);
    currentY += (splitContent.length * lineHeight) + 5;

    // Points 1-10
    const points = [
      "1. เหตุเกิดเมื่อ ...........................................................................................................................",
      "2. สถานที่เกิดเหตุ .....................................................................................................................",
      "3. หมายเลขทะเบียน ................................................................................................................",
      "4. ชื่อผู้ขับขี่ ..............................................................................................................................",
      "   บัตรประชาชนเลขที่ ......................................................................................................",
      "5. ที่อยู่ตามบัตร ........................................................................................................................",
      "   ........................................................................................................... เบอร์โทรศัพท์ ....................................",
      "6. ชื่อ/บริษัท เจ้าของรถยนต์ ..................................... เบอร์โทรศัพท์ ....................................",
      "7. ชื่อ/บริษัท ประกันภัย ............................................ เบอร์โทรศัพท์ ....................................",
      "8. ผู้ลงนามในหนังสือรับสภาพหนี้",
      "   [  ] ผู้ขับขี่    [  ] เจ้าของรถยนต์    [  ] ไม่ยินยอม",
      "9. การแจ้งความร้องทุกข์กับเจ้าหน้าที่ตำรวจ",
      "   [  ] แจ้งเป็นหลักฐาน    [  ] แจ้งความเป็นคดี เนื่องจาก ...........................................",
      "10. กรณีรถยนต์เกี่ยวสายสื่อสารทำให้เกิดความเสียหายกับระบบจำหน่าย",
      "    ชื่อ/บริษัท เจ้าของสายสื่อสาร ............................................ ความสูง ..........................."
    ];

    points.forEach(point => {
      const splitPoint = doc.splitTextToSize(point, 150);
      doc.text(splitPoint, 40, currentY);
      currentY += (splitPoint.length * lineHeight);
    });

    // Page 2
    doc.addPage();
    currentY = 20;
    
    // Page Number
    doc.setFontSize(12);
    doc.text("- 2 -", 105, 15, { align: "center" });

    // Item 11
    doc.setFontSize(14);
    const item11 = `11. รายการอุปกรณ์ที่ได้รับความเสียหาย ${totalItems} รายการ คิดเป็นค่าเสียหาย จำนวนเงินทั้งสิ้น ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท โดยมีรายละเอียดดังนี้`;
    const splitItem11 = doc.splitTextToSize(item11, 160);
    doc.text(splitItem11, 40, currentY);
    currentY += (splitItem11.length * lineHeight) + 10;

    // 11.1 Table
    doc.text(`11.1 รื้อถอน - ติดตั้งใหม่ ${damagedItems.length} รายการ เป็นจำนวนเงินทั้งสิ้น ${damagedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`, 45, currentY);
    currentY += lineHeight + 3;

    const tableHeaders = [['รายการ', 'ชื่อพัสดุ', 'จำนวน', 'หน่วย', 'ราคา']];
    
    const damagedData = damagedItems.map((item, index) => [
      index + 1,
      item.material.name,
      item.quantity,
      item.material.unit,
      item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ]);
    
    // Add empty rows to make it at least 5
    while (damagedData.length < 5) {
      damagedData.push(['', '', '', '', '']);
    }

    autoTable(doc, {
      startY: currentY,
      head: tableHeaders,
      body: damagedData,
      theme: 'grid',
      styles: { font: 'Sarabun', fontSize: 10 },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], font: 'Sarabun', fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { halign: 'left', cellWidth: 80 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 35 },
      },
      margin: { left: 25 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 11.2 Table
    doc.text(`11.2 แผนกซ่อมแซม ${reusableItems.length} รายการ เป็นจำนวนเงินทั้งสิ้น ${reusableTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`, 45, currentY);
    currentY += lineHeight + 3;

    const reusableData = reusableItems.map((item, index) => [
      index + 1,
      item.material.name,
      item.quantity,
      item.material.unit,
      item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ]);

    while (reusableData.length < 5) {
      reusableData.push(['', '', '', '', '']);
    }

    autoTable(doc, {
      startY: currentY,
      head: tableHeaders,
      body: reusableData,
      theme: 'grid',
      styles: { font: 'Sarabun', fontSize: 10 },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], font: 'Sarabun', fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { halign: 'left', cellWidth: 80 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 35 },
      },
      margin: { left: 25 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Closing
    const closing = `จึงเรียนมาเพื่อพิจารณาอนุมัติให้ดำเนินการเบิกอุปกรณ์ไปซ่อมแซมตามรายการดังกล่าว พร้อมทั้งเป็นการเรียกเก็บเงินค่าเสียหายจากผู้กระทำละเมิด เป็นจำนวนเงินทั้งสิ้น ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
    const splitClosing = doc.splitTextToSize(closing, 160);
    doc.text(splitClosing, 40, currentY);
    currentY += (splitClosing.length * lineHeight) + 20;

    // Signature
    doc.text("(...........................................................)", 140, currentY, { align: "center" });
    currentY += 10;
    doc.text("ตำแหน่ง", 140, currentY, { align: "center" });

    // Footer
    doc.setFontSize(10);
    doc.text("หน่วยงาน", 25, 280);
    doc.text("โทร. ...........................................................", 25, 285);

    doc.save("ค่าละเมิด1234_PI InnoTech.pdf");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">กำลังโหลดข้อมูลพัสดุ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100">
              <Settings2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
                ค่าละเมิด1234
              </h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium">
                ราคาพัสดุแบบสำเร็จรูป สำหรับการประเมินค่าเสียหายที่เกิดกับระบบจำหน่ายและระบบสายส่ง : กฟต.3
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Assessment</p>
              <p className="text-xl font-black text-blue-600">฿{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-2xl flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <p className="font-semibold">{error}</p>
            </div>
            <button 
              onClick={fetchData}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Single Page Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 space-y-8">
              {/* Step 1: Search */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <h2 className="font-bold">STEP 1 : พิมพ์ชื่อพัสดุหรือรหัสพัสดุ กฟภ.</h2>
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                      type="text"
                      placeholder="พิมพ์ชื่อหรือรหัสพัสดุ..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!e.target.value) setSelectedMaterial(null);
                      }}
                    />
                  </div>

                  {selectedMaterial ? (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-blue-900">{selectedMaterial.name}</p>
                        <p className="text-sm text-blue-700">
                          รหัส: {selectedMaterial.id} | 
                          ชำรุด: ฿{selectedMaterial.priceDamaged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 
                          นำกลับมาใช้ใหม่: ฿{selectedMaterial.priceReusable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedMaterial(null);
                          setSearchQuery('');
                        }}
                        className="p-2 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                      {filteredMaterials.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedMaterial(m);
                            setSearchQuery(m.name);
                          }}
                          className="w-full text-left p-3 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-xl transition-all flex items-center justify-between group"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{m.name}</p>
                            <p className="text-xs text-slate-500">รหัส: {m.id}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 & 3: Quantity and Status */}
              <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100 transition-opacity", !selectedMaterial && "opacity-50 pointer-events-none")}>
                {/* Quantity */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-600">
                    <h2 className="font-bold">STEP 2 : ระบุจำนวน ({selectedMaterial?.unit || '-'})</h2>
                  </div>
                  <div className="space-y-4">
                    <input 
                      type="number"
                      min="1"
                      disabled={!selectedMaterial}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-2xl font-bold text-center"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 5, 10].map(n => (
                        <button 
                          key={n}
                          disabled={!selectedMaterial}
                          onClick={() => setQuantity(n)}
                          className="py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all text-sm font-medium"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-600">
                    <h2 className="font-bold">STEP 3 : เลือกสถานะเพื่อบันทึก</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      disabled={!selectedMaterial}
                      onClick={() => handleStatusSelect('damaged')}
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 bg-white text-slate-600 hover:bg-red-50 hover:border-red-500 hover:text-red-700 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 text-slate-300 group-hover:text-red-500 transition-colors" />
                        <span className="font-bold">ชำรุด</span>
                      </div>
                      <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded">฿{((selectedMaterial?.priceDamaged || 0) * quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </button>
                    <button
                      disabled={!selectedMaterial}
                      onClick={() => handleStatusSelect('reusable')}
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 bg-white text-slate-600 hover:bg-green-50 hover:border-green-500 hover:text-green-700 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-6 h-6 text-slate-300 group-hover:text-green-500 transition-colors" />
                        <span className="font-bold">นำกลับมาใช้ใหม่</span>
                      </div>
                      <span className="text-xs font-bold bg-green-100 text-green-600 px-2 py-1 rounded">฿{((selectedMaterial?.priceReusable || 0) * quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </button>
                  </div>
                </div>
              </div>

              {!selectedMaterial && (
                <div className="text-center py-4 text-slate-400 text-sm italic">
                  * กรุณาเลือกพัสดุในขั้นตอนที่ 1 ก่อนระบุจำนวนและสถานะ
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Assessment Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full max-h-[700px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  รายการประเมิน
                </h2>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                  {items.length} รายการ
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Package className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm italic">ยังไม่มีรายการประเมิน</p>
                  </div>
                ) : (
                  items.map((item, index) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={index}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 group relative"
                    >
                      <button 
                        onClick={() => removeItem(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-sm text-slate-900 line-clamp-1">{item.material.name}</p>
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                          item.status === 'damaged' ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        )}>
                          {item.status === 'damaged' ? 'ชำรุด' : 'นำกลับมาใช้ใหม่'}
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <p className="text-xs text-slate-500">
                          {item.quantity} {item.material.unit} x ฿{(item.status === 'damaged' ? item.material.priceDamaged : item.material.priceReusable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="font-bold text-blue-600">฿{item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">รวมทั้งหมด</span>
                  <span className="text-2xl font-black text-slate-900">฿{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-600">
                    <h2 className="font-bold">STEP 4 : ออกรายการประเมินค่าเสียหาย</h2>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      disabled={items.length === 0}
                      onClick={exportWord}
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#EF0107] text-white font-bold rounded-xl hover:bg-[#DB0007] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-100"
                    >
                      <Download className="w-5 h-5" />
                      Export Word
                    </button>
                    <button 
                      disabled={items.length === 0}
                      onClick={exportPDF}
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-100"
                    >
                      <FileText className="w-5 h-5" />
                      Export PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-12 text-center space-y-2">
        <p className="text-slate-400 text-xs font-medium">
          © 2026 ค่าละเมิด1234 - <span className="text-blue-500/80">PI InnoTech</span>
        </p>
        <p className="text-slate-300 text-[9px] font-bold tracking-[0.25em] uppercase">
          PROVINCIAL ELECTRICITY AUTHORITY
        </p>
      </footer>

      {/* Mobile Bottom Bar for Total */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between z-20">
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-bold">Total Assessment</p>
          <p className="text-xl font-black text-blue-600">฿{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="flex gap-2">
          <button 
            disabled={items.length === 0}
            onClick={exportWord}
            className="bg-[#EF0107] text-white px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-[#DB0007] transition-colors"
          >
            <Download className="w-4 h-4" />
            Word
          </button>
          <button 
            disabled={items.length === 0}
            onClick={exportPDF}
            className="bg-slate-800 text-white px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-900 transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}
