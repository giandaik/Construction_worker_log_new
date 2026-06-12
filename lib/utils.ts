import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const GREEK_ACCENTED_CAPITALS: Record<string, string> = {
  "Ά": "Α",
  "Έ": "Ε",
  "Ή": "Η",
  "Ί": "Ι",
  "Ό": "Ο",
  "Ύ": "Υ",
  "Ώ": "Ω",
}

// Greek all-caps text takes no accents, but String.prototype.toUpperCase and
// CSS text-transform both keep them. Use this for any uppercased Greek text.
export function toGreekUpperCase(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFC")
    .replace(/[ΆΈΉΊΌΎΏ]/g, (letter) => GREEK_ACCENTED_CAPITALS[letter])
    .replace(/([ΪΫ])́/g, "$1")
}

