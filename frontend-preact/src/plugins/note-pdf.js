import { jsPDF } from 'jspdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import { parseMarkdown } from './note-markdown.js';

pdfMake.vfs = pdfFonts.vfs || pdfFonts;

export const NOTE_PDF_EXPORTERS = Object.freeze([
  { id: 'jspdf', label: 'jsPDF', detail: 'imperative page drawing' },
  { id: 'pdf-lib', label: 'pdf-lib', detail: 'low-level PDF objects' },
  { id: 'pdfmake', label: 'pdfmake', detail: 'declarative doc definition' }
]);

export const DEFAULT_NOTE_PDF_EXPORTER = 'jspdf';

export function pdfFileName(title) {
  const safe =
    (title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'chain-note';
  return `${safe}.pdf`;
}

export function chainPdfFileName(date) {
  const stamp = date || new Date().toLocaleDateString();
  return pdfFileName(`chain-notes ${stamp}`);
}

function normalizeNote(note) {
  return {
    title: note.title || 'New AI chat',
    question: note.question || '',
    answer: note.answer || '',
    date:
      note.date ||
      (typeof Date !== 'undefined'
        ? new Date().toLocaleDateString()
        : '1970-01-01')
  };
}

function richBlocks(text) {
  const source = String(text || '');
  if (!source) return [{ type: 'body', text: '—' }];
  const blocks = [];
  for (const parsed of parseMarkdown(source)) {
    if (parsed.type === 'para') {
      blocks.push({ type: 'para', spans: parsed.spans });
    } else {
      blocks.push(parsed);
    }
  }
  return blocks.length > 0 ? blocks : [{ type: 'body', text: '—' }];
}

function qaBlocks(question, answer) {
  return [
    { type: 'label', text: 'Question' },
    ...richBlocks(question),
    { type: 'label', text: 'Answer' },
    ...richBlocks(answer)
  ];
}

function noteBlocks(note) {
  const entry = normalizeNote(note);
  return [
    { type: 'title', text: entry.title },
    { type: 'kicker', text: `CHAIN NOTES  /  ${entry.date}` },
    { type: 'rule' },
    ...qaBlocks(entry.question, entry.answer)
  ];
}

function chainBlocks(entries, meta = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const date = meta.date || new Date().toLocaleDateString();
  const blocks = [
    { type: 'title', text: meta.title || 'Chain Notes' },
    {
      type: 'kicker',
      text: `${list.length} exchange${list.length === 1 ? '' : 's'}  /  ${date}`
    },
    { type: 'rule' }
  ];
  list.forEach((raw, index) => {
    const entry = normalizeNote(raw);
    if (index > 0) blocks.push({ type: 'pageBreak' });
    blocks.push({ type: 'heading', text: entry.title });
    blocks.push(...qaBlocks(entry.question, entry.answer));
  });
  return blocks;
}

const HEADING_SIZES = { 1: 16, 2: 14, 3: 13, 4: 12 };

function renderJspdf(blocks) {
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

  // Fast path for plain paragraphs: one text operator per line keeps
  // output small and matches the pre-markdown layout exactly.
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

// pdf-lib standard fonts only cover WinAnsi; replace anything outside it
// instead of throwing on user-pasted content.
function latin1(text) {
  return Array.from(String(text), (char) =>
    char.codePointAt(0) > 255 ? '?' : char
  ).join('');
}

function imageMime(dataUrl) {
  if (typeof dataUrl !== 'string') return '';
  if (dataUrl.startsWith('data:image/png;base64,')) return 'png';
  if (dataUrl.startsWith('data:image/jpeg;base64,')) return 'jpeg';
  return '';
}

function dataUrlToBytes(dataUrl) {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function figureLabel(block) {
  if (block.figure && block.number > 0) return `Figure ${block.number}`;
  return `Unknown figure: ${block.id || 'fig-?'}`;
}

async function renderPdfLib(blocks) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const boldOblique = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 52;
  const maxWidth = pageWidth - margin * 2;
  const state = { y: 72 };
  let page = doc.addPage([pageWidth, pageHeight]);

  const dark = rgb(35 / 255, 36 / 255, 40 / 255);
  const muted = rgb(110 / 255, 112 / 255, 120 / 255);
  const body = rgb(55 / 255, 56 / 255, 62 / 255);
  const accent = rgb(138 / 255, 109 / 255, 47 / 255);
  const codeInk = rgb(40 / 255, 41 / 255, 46 / 255);
  const codeFill = rgb(242 / 255, 243 / 255, 245 / 255);

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
  };

  const styleFor = (span, size) => {
    if (span.c) return { font: mono, size: 10 };
    if (span.b && span.i) return { font: boldOblique, size };
    if (span.b) return { font: bold, size };
    if (span.i) return { font: oblique, size };
    return { font: regular, size };
  };

  // Word-level mixed-style paragraph. state.y is the top edge on entry and
  // moves past the last line on exit.
  const richPara = (spans, options = {}) => {
    const { x = 0, size = 11, color = body, lineHeight = 17 } = options;
    const lineStart = margin + x;
    const maxX = margin + maxWidth;
    let cx = lineStart;
    const newLine = () => {
      state.y += lineHeight;
      if (state.y + lineHeight > pageHeight - margin) {
        newPage();
        state.y = margin;
      }
      cx = lineStart;
    };
    if (state.y + lineHeight > pageHeight - margin) {
      newPage();
      state.y = margin;
    }
    const drawToken = (token, span) => {
      const { font, size: active } = styleFor(span, size);
      let rest = latin1(token);
      while (rest) {
        const avail = maxX - cx;
        const width = font.widthOfTextAtSize(rest, active);
        if (width <= avail || cx === lineStart) {
          if (span.c) {
            page.drawRectangle({
              x: cx - 1,
              y: pageHeight - state.y - lineHeight + 3,
              width: width + 2,
              height: lineHeight - 2,
              color: codeFill
            });
          }
          page.drawText(rest || ' ', {
            x: cx,
            y: pageHeight - state.y - lineHeight + (lineHeight - active) / 2,
            size: active,
            font,
            color
          });
          cx += width;
          rest = '';
        } else {
          let take = 0;
          while (
            take < rest.length &&
            font.widthOfTextAtSize(rest.slice(0, take + 1), active) <= avail
          )
            take += 1;
          if (take === 0) {
            newLine();
            continue;
          }
          const part = rest.slice(0, take);
          if (span.c) {
            page.drawRectangle({
              x: cx - 1,
              y: pageHeight - state.y - lineHeight + 3,
              width: font.widthOfTextAtSize(part, active) + 2,
              height: lineHeight - 2,
              color: codeFill
            });
          }
          page.drawText(part, {
            x: cx,
            y: pageHeight - state.y - lineHeight + (lineHeight - active) / 2,
            size: active,
            font,
            color
          });
          cx += font.widthOfTextAtSize(part, active);
          rest = rest.slice(take);
          if (rest) newLine();
        }
      }
    };
    for (const span of spans) {
      for (const token of span.t.split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          const { font, size: active } = styleFor(span, size);
          if (cx === lineStart) continue;
          if (cx + font.widthOfTextAtSize(' ', active) > maxX) {
            newLine();
            continue;
          }
          cx += font.widthOfTextAtSize(' ', active);
          continue;
        }
        drawToken(token, span);
      }
    }
    state.y += lineHeight;
  };

  const codeBlock = (text) => {
    const size = 9;
    const lineHeight = 13;
    const pad = 6;
    const lines = [];
    for (const raw of latin1(text).split('\n')) {
      if (mono.widthOfTextAtSize(raw, size) <= maxWidth) {
        lines.push(raw);
        continue;
      }
      let rest = raw;
      while (rest && mono.widthOfTextAtSize(rest, size) > maxWidth) {
        let take = rest.length;
        while (
          take > 0 &&
          mono.widthOfTextAtSize(rest.slice(0, take), size) > maxWidth
        )
          take -= 1;
        take = Math.max(take, 1);
        lines.push(rest.slice(0, take));
        rest = rest.slice(take);
      }
      lines.push(rest);
    }
    for (const line of lines) {
      if (state.y + lineHeight > pageHeight - margin) {
        newPage();
        state.y = margin;
      }
      page.drawRectangle({
        x: margin,
        y: pageHeight - state.y - lineHeight,
        width: maxWidth,
        height: lineHeight,
        color: codeFill
      });
      page.drawText(line || ' ', {
        x: margin + pad,
        y: pageHeight - state.y - lineHeight + 2,
        size,
        font: mono,
        color: codeInk
      });
      state.y += lineHeight;
    }
    state.y += 6;
  };

  const plainLines = (value, font, size) => {
    const lines = [];
    for (const paragraph of latin1(value).split('\n')) {
      if (!paragraph) {
        lines.push('');
        continue;
      }
      let current = '';
      for (const word of paragraph.split(/\s+/)) {
        const next = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      lines.push(current);
    }
    return lines;
  };

  const drawPlain = (value, { font, size, lineHeight, color }) => {
    for (const line of plainLines(value, font, size)) {
      if (state.y + lineHeight > pageHeight - margin) {
        newPage();
        state.y = margin;
      }
      page.drawText(line || ' ', {
        x: margin,
        y: pageHeight - state.y - lineHeight + (lineHeight - size) / 2,
        size,
        font,
        color
      });
      state.y += lineHeight;
    }
  };

  for (const block of blocks) {
    if (block.type === 'pageBreak') {
      if (state.y > margin + 1) {
        newPage();
        state.y = margin;
      }
      continue;
    }
    if (block.type === 'rule') {
      state.y += 14;
      page.drawLine({
        start: { x: margin, y: pageHeight - state.y },
        end: { x: pageWidth - margin, y: pageHeight - state.y },
        thickness: 1,
        color: rgb(220 / 255, 221 / 255, 224 / 255)
      });
      state.y += 14;
      continue;
    }
    if (block.type === 'title') {
      drawPlain(block.text, {
        font: bold,
        size: 25,
        lineHeight: 30,
        color: dark
      });
      state.y += 6;
      continue;
    }
    if (block.type === 'heading') {
      const size = HEADING_SIZES[block.level] || 16;
      state.y += 8;
      drawPlain(block.text, {
        font: bold,
        size,
        lineHeight: size + 6,
        color: dark
      });
      state.y += 4;
      continue;
    }
    if (block.type === 'kicker') {
      drawPlain(block.text, {
        font: regular,
        size: 9,
        lineHeight: 14,
        color: muted
      });
      continue;
    }
    if (block.type === 'label') {
      state.y += 8;
      drawPlain(block.text, {
        font: bold,
        size: 10,
        lineHeight: 16,
        color: accent
      });
      continue;
    }
    if (block.type === 'code') {
      codeBlock(block.text);
      continue;
    }
    if (block.type === 'para') {
      if (
        block.spans.length === 1 &&
        !block.spans[0].b &&
        !block.spans[0].i &&
        !block.spans[0].c
      ) {
        drawPlain(block.spans[0].t, {
          font: regular,
          size: 11,
          lineHeight: 17,
          color: body
        });
      } else {
        richPara(block.spans, {});
      }
      state.y += 2;
      continue;
    }
    if (block.type === 'figure') {
      drawPlain(figureLabel(block), {
        font: bold,
        size: 9,
        lineHeight: 13,
        color: accent
      });
      const mime = imageMime(block.figure?.dataUrl);
      let embedded = false;
      if (mime === 'png' || mime === 'jpeg') {
        try {
          const raw = dataUrlToBytes(block.figure.dataUrl);
          const image =
            mime === 'png' ? await doc.embedPng(raw) : await doc.embedJpg(raw);
          const height = (maxWidth * image.height) / image.width;
          if (state.y + height > pageHeight - margin) {
            newPage();
            state.y = margin;
          }
          page.drawImage(image, {
            x: margin,
            y: pageHeight - state.y - height,
            width: maxWidth,
            height
          });
          state.y += height + 6;
          embedded = true;
        } catch {
          // Corrupt uploads fall through to the placeholder box.
        }
      }
      if (!embedded) {
        if (state.y + 56 > pageHeight - margin) {
          newPage();
          state.y = margin;
        }
        page.drawRectangle({
          x: margin,
          y: pageHeight - state.y - 56,
          width: maxWidth,
          height: 56,
          color: codeFill
        });
        page.drawText('Vector preview lives in the reader.', {
          x: margin + 6,
          y: pageHeight - state.y - 24,
          size: 9,
          font: regular,
          color: muted
        });
        page.drawText('Upload PNG or JPEG to embed raster art.', {
          x: margin + 6,
          y: pageHeight - state.y - 38,
          size: 9,
          font: regular,
          color: muted
        });
        state.y += 62;
      }
      if (block.caption) {
        drawPlain(block.caption, {
          font: oblique,
          size: 9,
          lineHeight: 13,
          color: muted
        });
        state.y += 2;
      }
      continue;
    }
    if (block.type === 'list') {
      block.items.forEach((spans, itemIndex) => {
        if (state.y + 17 > pageHeight - margin) {
          newPage();
          state.y = margin;
        }
        const prefix = block.ordered ? `${itemIndex + 1}.` : '•';
        page.drawText(prefix, {
          x: margin,
          y: pageHeight - state.y - 17 + 3,
          size: 11,
          font: bold,
          color: body
        });
        richPara(spans, { x: 16 });
      });
      state.y += 2;
      continue;
    }
    if (block.type === 'quote') {
      const pageBefore = doc.getPageCount();
      const top = state.y;
      richPara(block.spans, { x: 10, color: muted });
      if (doc.getPageCount() === pageBefore) {
        page.drawLine({
          start: { x: margin + 2, y: pageHeight - top },
          end: { x: margin + 2, y: pageHeight - state.y + 4 },
          thickness: 2,
          color: muted
        });
      }
      state.y += 2;
      continue;
    }
    drawPlain(block.text, {
      font: regular,
      size: 11,
      lineHeight: 17,
      color: body
    });
  }

  return await doc.save();
}

const PDFMAKE_HEADING_SIZES = { 1: 16, 2: 14, 3: 13, 4: 12 };

function pdfmakeSpans(spans) {
  return spans.map((span) => {
    if (span.c) {
      return { text: span.t, fontSize: 10, background: '#f2f3f5' };
    }
    const node = { text: span.t };
    if (span.b) node.bold = true;
    if (span.i) node.italics = true;
    return node;
  });
}

async function renderPdfmake(blocks) {
  const content = [];
  for (const block of blocks) {
    if (block.type === 'pageBreak') {
      content.push({ text: '', pageBreak: 'after' });
    } else if (block.type === 'title') {
      content.push({
        text: block.text,
        fontSize: 25,
        bold: true,
        color: '#232428'
      });
    } else if (block.type === 'heading') {
      content.push({
        text: block.text,
        fontSize: PDFMAKE_HEADING_SIZES[block.level] || 16,
        bold: true,
        color: '#232428',
        margin: [0, 8, 0, 4]
      });
    } else if (block.type === 'figure') {
      content.push({
        text: figureLabel(block),
        fontSize: 9,
        bold: true,
        color: '#8a6d2f',
        margin: [0, 4, 0, 2]
      });
      const mime = imageMime(block.figure?.dataUrl);
      if (
        (mime === 'png' || mime === 'jpeg') &&
        block.figure &&
        block.figure.dataUrl
      ) {
        content.push({ image: block.figure.dataUrl, width: 490 });
      } else {
        content.push({
          text: 'Vector preview lives in the reader. Upload PNG or JPEG to embed raster art.',
          fontSize: 9,
          italics: true,
          color: '#6e7078',
          background: '#f2f3f5',
          margin: [0, 2, 0, 2]
        });
      }
      if (block.caption) {
        content.push({
          text: block.caption,
          fontSize: 9,
          italics: true,
          color: '#6e7078',
          margin: [0, 2, 0, 4]
        });
      }
    } else if (block.type === 'para') {
      content.push({
        text: pdfmakeSpans(block.spans),
        fontSize: 11,
        color: '#37383e',
        margin: [0, 0, 0, 2]
      });
    } else if (block.type === 'code') {
      content.push({
        text: block.text || ' ',
        fontSize: 9,
        background: '#f2f3f5',
        preserveLeadingSpaces: true,
        margin: [0, 4, 0, 8]
      });
    } else if (block.type === 'list') {
      const items = block.items.map((spans) => ({
        text: pdfmakeSpans(spans),
        fontSize: 11
      }));
      content.push(
        block.ordered
          ? { ol: items, margin: [0, 0, 0, 2] }
          : { ul: items, margin: [0, 0, 0, 2] }
      );
    } else if (block.type === 'quote') {
      content.push({
        text: pdfmakeSpans(block.spans),
        fontSize: 11,
        italics: true,
        color: '#55565e',
        margin: [10, 0, 0, 2]
      });
    } else if (block.type === 'kicker') {
      content.push({
        text: block.text,
        fontSize: 9,
        color: '#6e7078',
        margin: [0, 6, 0, 0]
      });
    } else if (block.type === 'rule') {
      content.push({
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 10,
            x2: 515,
            y2: 10,
            lineWidth: 1,
            lineColor: '#dcdde0'
          }
        ]
      });
    } else if (block.type === 'label') {
      content.push({ text: block.text, style: 'sectionLabel' });
    } else {
      content.push({ text: block.text, fontSize: 11, color: '#37383e' });
    }
  }
  const definition = {
    content,
    defaultStyle: { font: 'Roboto' },
    styles: {
      sectionLabel: {
        fontSize: 10,
        bold: true,
        color: '#8a6d2f',
        margin: [0, 8, 0, 2]
      }
    }
  };
  const buffer = await pdfMake.createPdf(definition).getBuffer();
  return new Uint8Array(buffer);
}

export async function renderBlocks(exporterId, blocks) {
  switch (exporterId) {
    case 'pdf-lib':
      return renderPdfLib(blocks);
    case 'pdfmake':
      return renderPdfmake(blocks);
    default:
      return renderJspdf(blocks);
  }
}

export async function generateNotePdfBytes(exporterId, note) {
  return renderBlocks(exporterId, noteBlocks(note));
}

export async function generateChainPdfBytes(exporterId, entries, meta = {}) {
  return renderBlocks(exporterId, chainBlocks(entries, meta));
}

export function pdfBytesToBase64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < view.length; index += chunk) {
    binary += String.fromCharCode.apply(
      null,
      view.subarray(index, index + chunk)
    );
  }
  return btoa(binary);
}

export function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadNoteAsPdf(exporterId, note) {
  const bytes = await generateNotePdfBytes(exporterId, note);
  downloadBytes(bytes, pdfFileName(note.title));
  return bytes;
}

export async function downloadChainAsPdf(exporterId, entries, filename) {
  const bytes = await generateChainPdfBytes(exporterId, entries);
  downloadBytes(bytes, filename || chainPdfFileName());
  return bytes;
}
