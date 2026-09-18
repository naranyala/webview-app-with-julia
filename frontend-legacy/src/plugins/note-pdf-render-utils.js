export function imageMime(dataUrl) {
  if (typeof dataUrl !== 'string') return '';
  if (dataUrl.startsWith('data:image/png;base64,')) return 'png';
  if (dataUrl.startsWith('data:image/jpeg;base64,')) return 'jpeg';
  return '';
}

export function figureLabel(block) {
  if (block.figure && block.number > 0) return `Figure ${block.number}`;
  return `Unknown figure: ${block.id || 'fig-?'}`;
}
