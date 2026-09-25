"use client";

export type CartAddon = { name: string; price: number };
export type CartLine = {
  itemId: number;
  name: string;
  sizeName: string | null;
  sizeId: number | null;
  unitPrice: number;
  qty: number;
  addons: CartAddon[];
  addonIds: number[];
  lineTotal: number;
};
export type Cart = {
  storeId: number;
  storeName: string;
  deliveryFeeFils: number;
  items: CartLine[];
  discountCode?: string;
};

const KEY = "luqma_cart_v1";

export function readCart(): Cart | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Cart) : null;
  } catch {
    return null;
  }
}

export function writeCart(cart: Cart | null) {
  if (typeof window === "undefined") return;
  if (!cart) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("luqma:cart"));
}

export function cartTotal(cart: Cart | null) {
  return (cart?.items || []).reduce((s, l) => s + l.lineTotal, 0);
}

export function cartCount(cart: Cart | null) {
  return (cart?.items || []).reduce((s, l) => s + l.qty, 0);
}
