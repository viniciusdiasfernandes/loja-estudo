export function parsePriceToCents(text: string): number | null {
    const normalized = text.trim().replace(',', '.')

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
        return null
    }

    return Math.round(Number(normalized) * 100)
}