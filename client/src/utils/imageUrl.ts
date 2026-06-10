export function getProxiedImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) {
    return `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  if (url.startsWith('/')) {
    return `${window.location.origin}${url}`;
  }
  return url;
}
