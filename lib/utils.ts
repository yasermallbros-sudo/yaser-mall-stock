import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: number | string) {
  return new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD", minimumFractionDigits: 2 }).format(Number(value));
}
