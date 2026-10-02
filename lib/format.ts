const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export const formatIdr = (n: number | string | null | undefined): string => idr.format(Number(n ?? 0));
