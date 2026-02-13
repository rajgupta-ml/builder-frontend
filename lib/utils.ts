import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import pako from 'pako';

export function decompressJson(data: any) {
    if (!data) return null;

    try {
        let bytes: Uint8Array;

        // Handle case where data is an object like {0: 31, 1: 139, ...}
        if (typeof data === 'object' && !Array.isArray(data) && !(data instanceof Uint8Array)) {
            const values = Object.values(data);
             // Verify if it looks like byte data
             if (values.length > 0 && typeof values[0] === 'number') {
                 bytes = new Uint8Array(values as number[]);
             } else {
                 throw new Error("Invalid object format for decompression");
             }
        } else if (data instanceof Uint8Array) {
             bytes = data;
        } else if (typeof data === 'string') {
             try {
                const binaryString = atob(data);
                const len = binaryString.length;
                bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
             } catch {
                // assume it's already a binary string
                const len = data.length;
                bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = data.charCodeAt(i);
                }
             }
        } else {
             throw new Error("Unsupported data type for decompression");
        }

        const decompressed = pako.ungzip(bytes, { to: 'string' });
        return JSON.parse(decompressed);
    } catch (e) {
        console.error("Decompression failed", e);
        return null; // Return null instead of throwing to prevent crashing UI
    }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUniqueId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
