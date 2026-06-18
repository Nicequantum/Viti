const VIN_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeVin(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-HJ-NPR-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/Q/g, '0')
    .slice(0, 17);
}

export function isValidVin(vin: string): boolean {
  return VIN_CHARS.test(normalizeVin(vin));
}

export function formatVinInput(raw: string): string {
  return normalizeVin(raw);
}