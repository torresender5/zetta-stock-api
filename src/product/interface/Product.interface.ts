export interface Product {
  id: number;
  name: string;
  description?: string;
  code: string;
  price: number;
  stock: number;
  sku: string;
  type: string;
  category: string;
}
export interface CreateProduct {
  name: string;
  description?: string;
  code: string;
  price: number;
  stock: number;
  sku: string;
  type: string;
  category: string;
}
