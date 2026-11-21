// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
// Same answers on every input, faster: records without a quote or a stray CR
// are split with indexOf/slice instead of one character at a time; only records
// that hold a quote or a stray CR take the exact slow path below.
//
// Semantics (mirroring csv-reader 1.0.0 exactly):
// - a U+FEFF at the very start is dropped;
// - a record ends at LF or CRLF, a line left with no characters is no record;
// - outside quotes a CR not followed by LF is dropped (stray_cr);
// - a field that opens with a quote runs to the next quote that is not doubled,
//   "" inside it is one quote, each CRLF or lone CR inside it is read as LF;
//   what follows its closing quote up to the next comma or line break is appended
//   as it stands (quote_junk, when the field ends); a quote that never closes is
//   a literal character and the text after it is read again as unquoted
//   (unterminated_quote);
// - a quote inside an unquoted field is a literal character; fields stay strings,
//   never trimmed or converted;
// - columns is the first record when header is true, else null; rows holds the
//   records after it (every record when header is false), each padded with ""
//   (short_row, with fields: its field count) or cut (long_row, with extra: the
//   cut fields) to the first record's width;
// - each error is {code, line, row}, in the order met, a record's short_row or
//   long_row when it ends: line the 1-based line its record starts on, counting
//   every LF, CRLF and lone CR inside quotes, row its record's index in rows,
//   null for the header.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // Reads unquoted characters onto `value` up to the next comma or line break: a CR
  // not followed by LF is dropped (stray_cr). Returns the field and how it ended.
  // Chunk-based: slices whole runs between delimiters instead of one char at a time.
  function readUnquoted(value) {
    const startLen = value.length;
    while (pos < n) {
      const cComma = text.indexOf(',', pos);
      const cLf = text.indexOf('\n', pos);
      const cCr = text.indexOf('\r', pos);
      let m = -1;
      let kind = 0; // 0 comma, 1 lf, 2 cr
      if (cComma !== -1) { m = cComma; kind = 0; }
      if (cLf !== -1 && (m === -1 || cLf < m)) { m = cLf; kind = 1; }
      if (cCr !== -1 && (m === -1 || cCr < m)) { m = cCr; kind = 2; }
      if (m === -1) {
        value += text.slice(pos, n);
        pos = n;
        return { value, ended: END, added: value.length - startLen };
      }
      if (m > pos) value += text.slice(pos, m);
      if (kind === 0) {
        pos = m + 1;
        return { value, ended: COMMA, added: value.length - startLen };
      }
      if (kind === 1) {
        pos = m + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added: value.length - startLen };
      }
      // kind === 2: CR
      if (m + 1 < n && text.charCodeAt(m + 1) === 10) {
        pos = m + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added: value.length - startLen };
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      pos = m + 1;
    }
    return { value, ended: END, added: value.length - startLen };
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    let closed = false;
    while (pos < n) {
      const q = text.indexOf('"', pos);
      if (q === -1) break; // never closes: handled below
      if (q > pos) {
        // The run up to the quote: fold line breaks (CRLF and lone CR each one LF)
        // and count them, exactly as the reference does one char at a time.
        const chunk = text.slice(pos, q);
        const br = chunk.indexOf('\n');
        const cr = chunk.indexOf('\r');
        if (br === -1 && cr === -1) {
          value += chunk;
        } else {
          let count = 0;
          let s = 0;
          for (let i = 0; i < chunk.length; i++) {
            const c = chunk.charCodeAt(i);
            if (c === 13) {
              value += chunk.slice(s, i) + '\n';
              count += 1;
              if (i + 1 < chunk.length && chunk.charCodeAt(i + 1) === 10) { s = i + 2; i += 1; }
              else { s = i + 1; }
            } else if (c === 10) {
              value += chunk.slice(s, i) + '\n';
              count += 1;
              s = i + 1;
            }
          }
          value += chunk.slice(s);
          line += count;
        }
        pos = q;
      }
      if (q + 1 < n && text.charCodeAt(q + 1) === 34) {
        value += '"';
        pos = q + 2;
        continue;
      }
      pos = q + 1;
      closed = true;
      break;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after it is
      // read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquoted('"');
    }
    if (pos >= n) return { value, ended: END };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the next comma
    // or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk;
  }

  // Parses one record the slow way (it holds a quote or a stray CR before its
  // first line break). Returns the fields, or null when the record is skipped
  // (a line that held only stray CRs is left with no characters: no record).
  function readRecordSlow() {
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = pos < n && text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);
    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) return null;
    return fields;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: the record runs to the next LF (or the end) and holds no quote
    // and no stray CR, so its fields are plain slices between commas.
    const eol = text.indexOf('\n', pos);
    const segEnd = eol === -1 ? n : eol;
    const q = text.indexOf('"', pos);
    let fields;
    if (q !== -1 && q < segEnd) {
      fields = readRecordSlow();
    } else {
      const r = text.indexOf('\r', pos);
      if (r !== -1 && r < segEnd && !(eol !== -1 && r === segEnd - 1)) {
        // A stray CR (anything but the CR of a CRLF at the record's end).
        fields = readRecordSlow();
      } else {
        let end = segEnd;
        if (eol !== -1 && r === segEnd - 1) end -= 1; // drop the CR of a CRLF
        fields = [];
        let s = pos;
        while (true) {
          const c = text.indexOf(',', s);
          if (c === -1 || c >= end) {
            fields.push(text.slice(s, end));
            break;
          }
          fields.push(text.slice(s, c));
          s = c + 1;
        }
        pos = eol === -1 ? n : eol + 1;
        if (eol !== -1) line += 1;
      }
    }
    if (fields === null) continue;

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
