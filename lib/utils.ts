/** Shared utilities for Lunia.ai */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function maskPersonalInfo(text: string): string {
  return text
    .replace(/\d{6}-\d{7}/g, "XXXXXX-XXXXXXX")
    .replace(/010-\d{4}-\d{4}/g, "010-XXXX-XXXX")
    .replace(/\b\d{2,3}-\d{3,4}-\d{4}\b/g, "XXX-XXXX-XXXX");
}
