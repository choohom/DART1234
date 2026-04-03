export interface Material {
  id: string;
  name: string;
  unit: string;
  priceDamaged: number;
  priceReusable: number;
}

export interface AssessmentItem {
  material: Material;
  quantity: number;
  status: 'damaged' | 'reusable';
  totalPrice: number;
}

export const GOOGLE_SHEET_ID = '1BucWhfksqE1Rs_c_t2NWMY15Sx9h__7qv79I51b1U2k';
