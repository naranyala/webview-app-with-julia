import { jsPDF } from 'jspdf';
import { figureLabel, imageMime } from './note-pdf-render-utils.js';

const HEADING_SIZES = { 1: 16, 2: 14, 3: 13, 4: 12 };

export function renderJspdf(blocks) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const state = {
    margin: 52,
    maxWidth: 0,
    pageHeight: doc.internal.pageSize.getHeight(),
    y: 72
  };
  state.maxWidth = doc.internal.pageSize.getWidth() - state.margin * 2;

  const ensure = (height) => {
    if (state.y + height > state.pageHeight - state.margin) {
      doc.addPage();
      state.y = state.margin;
    }
  };

  const styleFor = (span, size) => {
    if (span.c) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      return 10;
    }
    let style = 'normal';
    if (span.b && span.i) style = 'bolditalic';
    else if (span.b) style = 'bold';
    else if (span.i) style = 'italic';
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    return size;
  };

  const codeBg = (text, x, size) => {
    doc.setFillColor(242, 243, 245);
    doc.rect(
      x - 1,
      state.y - size + 2,
      doc.getTextWidth(text) + 2,
      size + 2,
      'F'
    );
  };

  // Word-level mixed-style paragraph. state.y is the current baseline on
  // entry and moves past the last line on exit.
  const richPara = (spans, options = {}) => {
    const { x = 0, size = 11, color = [55, 56, 62], lineHeight = 17 } = options;
    const lineStart = state.margin + x;
    const maxX = state.margin + state.maxWidth;
    let cx = lineStart;
    doc.setTextColor(color[0], color[1], color[2]);
    const newLine = () => {
      state.y += lineHeight;
      if (state.y > state.pageHeight - state.margin) {
        doc.addPage();
        state.y = state.margin;
      }
      cx = lineStart;
    };
    const drawToken = (token, span) => {
      const active = styleFor(span, size);
      let rest = token;
      while (rest) {
        const avail = maxX - cx;
        const width = doc.getTextWidth(rest);
        if (width <= avail || cx === lineStart) {
          if (span.c) codeBg(rest, cx, active);
          doc.text(rest, cx, state.y);
          cx += width;
          rest = '';
        } else {
          let take = 0;
          while (
            take < rest.length &&
            doc.getTextWidth(rest.slice(0, take + 1)) <= avail
          )
            take += 1;
          if (take === 0) {
            newLine();
            continue;
          }
          const part = rest.slice(0, take);
          if (span.c) codeBg(part, cx, active);
          doc.text(part, cx, state.y);
          cx += doc.getTextWidth(part);
          rest = rest.slice(take);
          if (rest) newLine();
        }
      }
    };
    for (const span of spans) {
      for (const token of span.t.split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          styleFor(span, size);
          if (cx === lineStart) continue;
          if (cx + doc.getTextWidth(' ') > maxX) {
            newLine();
            continue;
          }
          cx += doc.getTextWidth(' ');
          continue;
        }
        drawToken(token, span);
      }
    }
    state.y += lineHeight;
  };

  const plainPara = (text) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(55, 56, 62);
    const lines = doc.splitTextToSize(text, state.maxWidth);
    ensure(lines.length * 17);
    for (const line of lines) {
      if (state.y > state.pageHeight - state.margin) {
        doc.addPage();
        state.y = state.margin;
      }
      doc.text(line, state.margin, state.y);
      state.y += 17;
    }
  };

  const isPlain = (spans) =>
    spans.length === 1 && !spans[0].b && !spans[0].i && !spans[0].c;

  const codeBlock = (text) => {
    const size = 9;
    const lineHeight = 13;
    const pad = 6;
    doc.setFont('courier', 'normal');
    doc.setFontSize(size);
    const lines = [];
    for (const raw of String(text).split('\n')) {
      if (doc.getTextWidth(raw) <= state.maxWidth) {
        lines.push(raw);
        continue;
      }
      let rest = raw;
      while (rest && doc.getTextWidth(rest) > state.maxWidth) {
        let take = rest.length;
        while (
          take > 0 &&
          doc.getTextWidth(rest.slice(0, take)) > state.maxWidth
        )
          take -= 1;
        take = Math.max(take, 1);
        lines.push(rest.slice(0, take));
        rest = rest.slice(take);
      }
      lines.push(rest);
    }
    for (const line of lines) {
      if (state.y + lineHeight > state.pageHeight - state.margin) {
        doc.addPage();
        state.y = state.margin;
      }
      doc.setFillColor(242, 243, 245);
      doc.rect(state.margin, state.y, state.maxWidth, lineHeight, 'F');
      doc.setTextColor(40, 41, 46);
      doc.text(line || ' ', state.margin + pad, state.y + 10);
      state.y += lineHeight;
    }
    state.y += 6;
  };

  for (const block of blocks) {
    if (block.type === 'pageBreak') {
      if (state.y > state.margin + 1) {
        doc.addPage();
        state.y = state.margin;
      }
      continue;
    }
    if (block.type === 'rule') {
      state.y += 14;
      doc.setDrawColor(220, 221, 224);
      doc.line(state.margin, state.y, state.margin + state.maxWidth, state.y);
      state.y += 14;
      continue;
    }
    if (block.type === 'title') {
      doc.setTextColor(35, 36, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(25);
      const lines = doc.splitTextToSize(block.text, state.maxWidth);
      ensure(lines.length * 30);
      for (const line of lines) {
        doc.text(line, state.margin, state.y);
        state.y += 30;
      }
      state.y += 6;
      continue;
    }
    if (block.type === 'heading') {
      const size = HEADING_SIZES[block.level] || 16;
      state.y += 8;
      doc.setTextColor(35, 36, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(block.text, state.maxWidth);
      ensure(lines.length * (size + 6));
      for (const line of lines) {
        doc.text(line, state.margin, state.y);
        state.y += size + 6;
      }
      state.y += 4;
      continue;
    }
    if (block.type === 'kicker') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 112, 120);
      ensure(14);
      doc.text(block.text, state.margin, state.y);
      state.y += 14;
      continue;
    }
    if (block.type === 'label') {
      state.y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(138, 109, 47);
      ensure(16);
      doc.text(block.text, state.margin, state.y);
      state.y += 16;
      continue;
    }
    if (block.type === 'code') {
      codeBlock(block.text);
      continue;
    }
    if (block.type === 'para') {
      if (isPlain(block.spans)) plainPara(block.spans[0].t);
      else richPara(block.spans, {});
      state.y += 2;
      continue;
    }
    if (block.type === 'figure') {
      ensure(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(138, 109, 47);
      doc.text(figureLabel(block), state.margin, state.y);
      state.y += 14;
      const mime = imageMime(block.figure?.dataUrl);
      let embedded = false;
      if (mime === 'png' || mime === 'jpeg') {
        try {
          const props = doc.getImageProperties(block.figure.dataUrl);
          const height = (state.maxWidth * props.height) / props.width;
          ensure(height);
          doc.addImage(
            block.figure.dataUrl,
            mime === 'png' ? 'PNG' : 'JPEG',
            state.margin,
            state.y,
            state.maxWidth,
            height
          );
          state.y += height + 6;
          embedded = true;
        } catch {
          // Corrupt uploads fall through to the placeholder box.
        }
      }
      if (!embedded) {
        ensure(56);
        doc.setFillColor(242, 243, 245);
        doc.rect(state.margin, state.y, state.maxWidth, 56, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(110, 112, 120);
        doc.text(
          'Vector preview lives in the reader.',
          state.margin + 6,
          state.y + 24
        );
        doc.text(
          'Upload PNG or JPEG to embed raster art.',
          state.margin + 6,
          state.y + 38
        );
        state.y += 62;
      }
      if (block.caption) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(110, 112, 120);
        const lines = doc.splitTextToSize(block.caption, state.maxWidth);
        ensure(lines.length * 13);
        for (const line of lines) {
          doc.text(line, state.margin, state.y);
          state.y += 13;
        }
        state.y += 2;
      }
      continue;
    }
    if (block.type === 'list') {
      block.items.forEach((spans, itemIndex) => {
        const prefix = block.ordered ? `${itemIndex + 1}.` : '•';
        ensure(17);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(55, 56, 62);
        doc.text(prefix, state.margin, state.y);
        richPara(spans, { x: 16 });
      });
      state.y += 2;
      continue;
    }
    if (block.type === 'quote') {
      const pagesBefore = doc.getNumberOfPages();
      const top = state.y;
      richPara(block.spans, { x: 10, color: [85, 86, 94] });
      if (doc.getNumberOfPages() === pagesBefore) {
        doc.setDrawColor(136, 136, 136);
        doc.line(state.margin + 2, top - 11, state.margin + 2, state.y - 6);
      }
      state.y += 2;
      continue;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(55, 56, 62);
    const lines = doc.splitTextToSize(block.text, state.maxWidth);
    ensure(lines.length * 17);
    for (const line of lines) {
      if (state.y > state.pageHeight - state.margin) {
        doc.addPage();
        state.y = state.margin;
      }
      doc.text(line, state.margin, state.y);
      state.y += 17;
    }
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
