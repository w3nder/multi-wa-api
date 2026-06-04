export function toUserJid(value: string): string {
  if (value.includes('@')) return value
  return `${value.replace(/[^0-9]/g, '')}@s.whatsapp.net`
}
