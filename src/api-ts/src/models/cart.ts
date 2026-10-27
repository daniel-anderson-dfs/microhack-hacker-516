export interface CartItem {
  productId: number;
  name: string;
  sku: string;
  imgName: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface Cart {
  items: CartItem[];
  itemCount: number;
  totalCents: number;
}
