// Claude replies in Markdown; Telegram's HTML mode is the forgiving way to render it.
// Bold, inline code, links, headings (as bold), fenced code and tables (as <pre>) are converted; the rest stays plain text.

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FENCE = /^\s*```/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;

function inline(text: string): string {
  return text
    .split(/(`[^`\n]+`)/g)
    .map((part) =>
      /^`[^`]+`$/.test(part)
        ? `<code>${escape(part.slice(1, -1))}</code>`
        : escape(part)
            .replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>')
            .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s"]+)\)/g, '<a href="$2">$1</a>'),
    )
    .join('');
}

export function toTelegramHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) {
      const body: string[] = [];
      while (++i < lines.length && !FENCE.test(lines[i])) body.push(lines[i]);
      out.push(`<pre>${escape(body.join('\n'))}</pre>`);
    } else if (TABLE_ROW.test(line)) {
      const rows = [line];
      while (i + 1 < lines.length && TABLE_ROW.test(lines[i + 1])) rows.push(lines[++i]);
      out.push(`<pre>${escape(rows.join('\n'))}</pre>`);
    } else {
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      out.push(
        heading
          ? `<b>${inline(heading[1].replace(/\*\*/g, ''))}</b>`
          : inline(line.replace(/^(\s*)[-*]\s+(?!\[)/, '$1• ')),
      );
    }
  }
  return out.join('\n');
}

/** Splits Markdown into Telegram-sized pieces at line breaks, closing and reopening code fences across pieces. */
export function chunkMarkdown(md: string, limit = 3500): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let size = 0;
  let inFence = false;

  const flush = () => {
    if (!current.length) return;
    if (inFence) current.push('```');
    chunks.push(current.join('\n'));
    current = inFence ? ['```'] : [];
    size = current.length * 4;
  };

  for (const rawLine of md.split('\n')) {
    const pieces = rawLine.length > limit ? rawLine.match(new RegExp(`[\\s\\S]{1,${limit}}`, 'g'))! : [rawLine];
    for (const line of pieces) {
      if (size + line.length + 1 > limit) flush();
      current.push(line);
      size += line.length + 1;
      if (FENCE.test(line)) inFence = !inFence;
    }
  }
  if (current.length) chunks.push(current.join('\n'));
  return chunks.filter((c) => c.trim());
}
