// Faster drop-in replacement for csv-reader 1.0.0's readCsv.
// Single-pass scanner: fields are built with slice() over segments between
// special characters (comma, LF, CR, quote), never char-by-char, and the hot
// paths avoid regex, per-field object allocation and string concatenation.
// Error semantics (codes, order, line/row bookkeeping, ragged-row handling)
// match the reference reader exactly, as specified for this competition.

export function run(input) {
  const s = String(input.text);
  const header = input.header === true;
  const n = s.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = n > 0 && s.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  // Shared field result: fv = value, fe = 0 comma / 1 line break / 2 end,
  // fa = characters kept by the current unquoted read (for quote_junk).
  let fv = '';
  let fe = 2;
  let fa = 0;

  // Reads unquoted characters starting at pos, prefixed by `init`, up to the
  // next comma or line break. A CR not followed by LF is dropped (stray_cr).
  function readUnquoted(init) {
    let val = init;
    let added = 0;
    let seg = pos;
    for (;;) {
      while (pos < n) {
        const c = s.charCodeAt(pos);
        if (c === 44 || c === 10 || c === 13) break;
        pos++;
      }
      if (pos >= n) {
        fv = val + s.slice(seg, n);
        fe = 2;
        fa = added + (n - seg);
        return;
      }
      const c = s.charCodeAt(pos);
      if (c === 44) {
        fv = val + s.slice(seg, pos);
        fe = 0;
        fa = added + (pos - seg);
        pos++;
        return;
      }
      if (c === 10) {
        fv = val + s.slice(seg, pos);
        fe = 1;
        fa = added + (pos - seg);
        pos++;
        line++;
        return;
      }
      // c === 13
      if (pos + 1 < n && s.charCodeAt(pos + 1) === 10) {
        fv = val + s.slice(seg, pos);
        fe = 1;
        fa = added + (pos - seg);
        pos += 2;
        line++;
        return;
      }
      // Lone CR: dropped, one stray_cr error, segment ends here.
      val += s.slice(seg, pos);
      added += pos - seg;
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      pos++;
      seg = pos;
    }
  }

  // Handles what follows a quoted field's closing quote: a comma, a line
  // break, the end of the text, or junk appended as it stands.
  function finishQuoted(val) {
    if (pos >= n) {
      fv = val;
      fe = 2;
      return;
    }
    const c = s.charCodeAt(pos);
    if (c === 44) {
      fv = val;
      fe = 0;
      pos++;
      return;
    }
    if (c === 10) {
      fv = val;
      fe = 1;
      pos++;
      line++;
      return;
    }
    if (c === 13 && pos + 1 < n && s.charCodeAt(pos + 1) === 10) {
      fv = val;
      fe = 1;
      pos += 2;
      line++;
      return;
    }
    readUnquoted(val);
    if (fa > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos++;
    let val = '';
    let seg = pos;
    let closed = false;
    while (pos < n) {
      let c = -1;
      while (pos < n) {
        c = s.charCodeAt(pos);
        if (c === 34 || c === 13 || c === 10) break;
        pos++;
      }
      if (pos >= n) break;
      if (c === 34) {
        if (pos + 1 < n && s.charCodeAt(pos + 1) === 34) {
          // Doubled quote: one literal quote.
          val += s.slice(seg, pos) + '"';
          pos += 2;
          seg = pos;
          continue;
        }
        val += s.slice(seg, pos);
        pos++;
        closed = true;
        break;
      }
      if (c === 13) {
        // CRLF and a lone CR inside quotes are each read as one LF.
        val += s.slice(seg, pos) + '\n';
        line++;
        pos += pos + 1 < n && s.charCodeAt(pos + 1) === 10 ? 2 : 1;
        seg = pos;
        continue;
      }
      // c === 10: the LF stays inside the current segment; only count it.
      line++;
      pos++;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after
      // it is read again as an unquoted field.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      readUnquoted('"');
      return;
    }
    finishQuoted(val);
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = s.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && pos + 1 < n && s.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    let fields = null;
    let lastQuoted = false;
    // Fast path: a whole record on one physical line with no quote and no CR
    // except a CRLF terminator holds only plain unquoted fields and cannot
    // raise a field error, so it splits in native code.
    const nl = s.indexOf('\n', pos);
    const hasLF = nl !== -1;
    let cEnd = hasLF ? nl : n;
    if (hasLF && cEnd > pos && s.charCodeAt(cEnd - 1) === 13) cEnd--;
    if (cEnd > pos) {
      const content = s.slice(pos, cEnd);
      if (content.indexOf('"') === -1 && content.indexOf('\r') === -1) {
        fields = content.split(',');
        pos = hasLF ? nl + 1 : n;
        if (hasLF) line++;
      }
    }
    if (fields === null) {
      fields = [];
      for (;;) {
        if (pos < n && s.charCodeAt(pos) === 34) {
          lastQuoted = true;
          readQuoted();
        } else {
          lastQuoted = false;
          readUnquoted('');
        }
        fields.push(fv);
        if (fe !== 0) break;
      }
    }

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
