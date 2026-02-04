import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import pako from 'pako';

export function decompressJson(base64Data: string) {
    if (!base64Data) return null;
    try {
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const decompressed = pako.ungzip(bytes, { to: 'string' });
        return JSON.parse(decompressed);
    } catch (e) {
        console.error("Decompression failed", e);
        return null;
    }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUniqueId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
