// Shared utilities for parsing AI-generated PSV question sets, formatting rich text/LaTeX safely, and typesetting MathJax.

const SAFE_HTML_TAG_REGEX = /<\/?(strong|b|em|i|u|br|p|ul|ol|li|sup|sub|code|pre|table|thead|tbody|tr|th|td)(\s[^<>]*)?\/?>/gi;
const ROW_PREFIX_REGEX = /^(?:Q|PQ|DQ|P|D)\s*\|/;
const HEADER_LINE_REGEX = /^(?:Row_Type|Passage_ID|Text_Content|Question_Text)\s*\|[^\n]*(?:###)?[ \t]*$/i;

/**
 * Normalize raw text pasted from an LLM or received from OpenRouter.
 * Strips outer markdown code fences, conversational preamble/epilogue, and echoed headers.
 */
export function stripCodeFencesAndNoise(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Extract content from markdown code fences if they contain PSV data
  const fenceRegex = /```(?:[a-zA-Z0-9_-]*)[ \t]*\n([\s\S]*?)```/g;
  const fencedBlocks = [];
  let match;
  while ((match = fenceRegex.exec(text)) !== null) {
    const block = match[1].trim();
    if (block.includes('|') && (ROW_PREFIX_REGEX.test(block) || /^(?:Row_Type|Passage_ID|Question_Text|Text_Content)\s*\|/im.test(block))) {
      fencedBlocks.push(block);
    }
  }
  if (fencedBlocks.length > 0) {
    text = fencedBlocks.join('\n');
  } else {
    // Strip stray opening/closing fences at very start/end
    text = text
      .replace(/^```[a-zA-Z0-9_-]*[ \t]*\n?/, '')
      .replace(/\n?```[ \t]*$/, '')
      .trim();
  }

  const lines = text.split('\n');

  // Drop leading conversational preamble before first header or PSV row
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (
      HEADER_LINE_REGEX.test(trimmed) ||
      ROW_PREFIX_REGEX.test(trimmed) ||
      (trimmed.split('|').length >= 4)
    ) {
      startIdx = i;
      break;
    }
    startIdx = i + 1;
  }

  const bodyLines = lines
    .slice(startIdx)
    .filter((line) => !HEADER_LINE_REGEX.test(line.trim()));

  return bodyLines.join('\n').trim();
}

/**
 * Split PSV content into logical rows.
 * Treats ### as a row delimiter when at end-of-line/EOF or right before a new row prefix,
 * preserving any markdown ### headings that might appear inside model answers or passages.
 * Also splits when ### was accidentally omitted before a new Q|/PQ|/DQ|/P|/D| line.
 */
export function splitPsvRows(cleanedText) {
  if (!cleanedText) return [];

  const ROW_SENTINEL = '\u0000__UNMOCKED_ROW_END__\u0000';
  // Replace ### row terminators (not ####, and not markdown "### Heading" unless followed by a row prefix)
  const marked = cleanedText.replace(
    /(?<!#)###[ \t]*(?=\n|$|(?:Q|PQ|DQ|P|D)\s*\|)/g,
    ROW_SENTINEL
  );

  const initialChunks = marked
    .split(ROW_SENTINEL)
    .map((c) => c.trim())
    .filter(Boolean);

  const rows = [];
  for (const chunk of initialChunks) {
    // Discard trailing conversational text that has no pipe delimiter and no row prefix
    if (!chunk.includes('|') && !ROW_PREFIX_REGEX.test(chunk)) {
      continue;
    }

    // Fallback: if ### was omitted between rows, split at lines beginning with a valid Row_Type|
    const lines = chunk.split('\n');
    let buffer = '';
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (
        buffer &&
        ROW_PREFIX_REGEX.test(trimmedLine) &&
        (buffer.match(/\|/g) || []).length >= 2
      ) {
        const flushed = buffer.trim();
        if (flushed && !HEADER_LINE_REGEX.test(flushed)) {
          rows.push(flushed);
        }
        buffer = line;
      } else {
        buffer = buffer ? `${buffer}\n${line}` : line;
      }
    }

    const finalFlushed = buffer.trim();
    if (
      finalFlushed &&
      !HEADER_LINE_REGEX.test(finalFlushed) &&
      (finalFlushed.includes('|') || ROW_PREFIX_REGEX.test(finalFlushed))
    ) {
      rows.push(finalFlushed);
    }
  }

  return rows;
}

/**
 * Trim trailing empty pipe-separated cells (e.g. P|p1|text|||||| -> ['P', 'p1', 'text']).
 */
function trimTrailingEmptyCols(cols, minKeep = 3) {
  const copy = [...cols];
  while (copy.length > minKeep && copy[copy.length - 1].trim() === '') {
    copy.pop();
  }
  return copy;
}

/**
 * Parse and lightly repair DI chart JSON from a D row.
 */
export function parseChartJson(rawJson, dId, rowNum) {
  let candidate = (rawJson || '').trim();
  // Strip wrapping inline backticks if present
  if (candidate.startsWith('`') && candidate.endsWith('`')) {
    candidate = candidate.slice(1, -1).trim();
  }

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`Row ${rowNum}: Missing JSON object for DI chart "${dId}".`);
  }
  candidate = candidate.slice(firstBrace, lastBrace + 1);

  const tryParse = (str) => {
    const parsed = JSON.parse(str);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('DI chart data must be a JSON object');
    }
    return parsed;
  };

  let chartObj;
  try {
    chartObj = tryParse(candidate);
  } catch (firstErr) {
    // Attempt gentle repair for common LLM JSON quirks: smart quotes, trailing commas, raw newlines
    const repaired = candidate
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\r\n]+/g, ' ');
    try {
      chartObj = tryParse(repaired);
    } catch (secondErr) {
      throw new Error(`Row ${rowNum}: Invalid JSON for DI chart "${dId}" (${firstErr.message}).`);
    }
  }

  const chartType = (chartObj.type || 'bar').toLowerCase();
  if (chartType === 'mixed') {
    if (!Array.isArray(chartObj.charts) || chartObj.charts.length === 0) {
      throw new Error(`Row ${rowNum}: Mixed DI chart "${dId}" must include a non-empty "charts" array.`);
    }
  } else if (!Array.isArray(chartObj.categories) || !Array.isArray(chartObj.series)) {
    throw new Error(`Row ${rowNum}: DI chart "${dId}" must contain "categories" and "series" arrays.`);
  }

  return chartObj;
}

/**
 * Normalize Correct_Option values (e.g. "A", "a", "Option B", "(C)", "D.", "1") into "A".."E".
 */
export function normalizeAnswerLetter(rawAnswer, options = [], optionsCount = 4) {
  if (rawAnswer === undefined || rawAnswer === null) return null;
  const trimmed = String(rawAnswer).trim();
  if (!trimmed) return null;

  const validLetters = ['A', 'B', 'C', 'D', 'E'].slice(0, optionsCount);

  const letterMatch = trimmed.match(/^(?:option|opt|answer|ans)?[\s:.-]*[\(\[]?\s*([A-E])\s*[\)\].:]?$/i);
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase();
    return validLetters.includes(letter) ? letter : null;
  }

  const numMatch = trimmed.match(/^(?:option|opt)?[\s:.-]*([1-5])$/i);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < validLetters.length) {
      return validLetters[idx];
    }
  }

  // Fallback: exact text match against one of the options
  const lowerVal = trimmed.toLowerCase();
  const matchedIdx = options.findIndex((o) => o && o.trim().toLowerCase() === lowerVal);
  if (matchedIdx !== -1 && matchedIdx < validLetters.length) {
    return validLetters[matchedIdx];
  }

  return null;
}

/**
 * Parse raw PSV AI output into structured questions for Mock Tests.
 * Supports MCQ (4 or 5 options) and Descriptive (optionsCount = 0), plus P/PQ passages and D/DQ DI charts.
 */
export function parsePsvQuestions(rawString, optionsCount = 4) {
  const cleaned = stripCodeFencesAndNoise(rawString);
  if (!cleaned) return [];

  const rawRows = splitPsvRows(cleaned);
  if (rawRows.length === 0) return [];

  const passagesMap = {};
  const chartsMap = {};
  const passageGroupKeys = {};
  const chartGroupKeys = {};
  let groupSeq = 0;
  let lastPassageId = null;
  let lastChartId = null;
  const parsedQs = [];

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const cols = row.split('|');
    const rowType = cols[0].trim().toUpperCase();

    if (rowType === 'P') {
      const trimmedCols = trimTrailingEmptyCols(cols, 3);
      let pId = (trimmedCols[1] || '').trim();
      let pText = trimmedCols.slice(2).join('|').trim();

      // Tolerate missing Passage_ID column if P|Passage text was emitted
      if (!pText && pId && pId.length > 25 && trimmedCols.length === 2) {
        pText = pId;
        pId = `__anon_p_${++groupSeq}`;
      }

      if (!pId || !pText) {
        throw new Error(`Row ${rowNum}: Passage row (P) must follow P|[Passage_ID]|[Passage Text]###.`);
      }

      const gKey = `p_${++groupSeq}`;
      passagesMap[pId] = pText;
      passagesMap[pId.toLowerCase()] = pText;
      passageGroupKeys[pId] = gKey;
      passageGroupKeys[pId.toLowerCase()] = gKey;
      lastPassageId = pId;
      return;
    }

    if (rowType === 'D') {
      const trimmedCols = trimTrailingEmptyCols(cols, 3);
      const dId = (trimmedCols[1] || '').trim();
      const rawJson = trimmedCols.slice(2).join('|').trim();

      if (!dId || !rawJson) {
        throw new Error(`Row ${rowNum}: DI Chart row (D) must follow D|[DI_Set_ID]|{...json...}###.`);
      }

      const chartObj = parseChartJson(rawJson, dId, rowNum);
      const gKey = `d_${++groupSeq}`;
      chartsMap[dId] = chartObj;
      chartsMap[dId.toLowerCase()] = chartObj;
      chartGroupKeys[dId] = gKey;
      chartGroupKeys[dId.toLowerCase()] = gKey;
      lastChartId = dId;
      return;
    }

    // Handle Descriptive Questions (optionsCount === 0)
    if (optionsCount === 0) {
      if (rowType === 'Q' || rowType === 'PQ' || rowType === 'DQ') {
        let pId = (cols[1] || '').trim();
        let text = '';
        let keywords = '';
        let modelAnswer = '';

        // Tolerate Q|Question_Text|Keywords|Model_Answer (missing empty Passage_ID)
        if (rowType === 'Q' && cols.length === 4 && pId) {
          text = pId;
          pId = '';
          keywords = (cols[2] || '').trim();
          modelAnswer = (cols[3] || '').trim();
        } else {
          if (cols.length < 4) {
            throw new Error(`Row ${rowNum}: Descriptive row is missing required pipes. Expected Q||[Question]|[Keywords]|[Model_Answer]###.`);
          }
          text = (cols[2] || '').trim();
          keywords = (cols[3] || '').trim();
          modelAnswer = cols.slice(4).join('|').trim();
        }

        if (!text) {
          throw new Error(`Row ${rowNum}: Descriptive question text is empty.`);
        }
        if (!keywords) {
          throw new Error(`Row ${rowNum}: Descriptive row is missing Expected_Keywords.`);
        }

        const qObj = {
          id: Math.random().toString(36).substr(2, 9),
          text,
          options: [],
          answer: keywords,
          explanation: modelAnswer,
          passage: rowType === 'PQ' ? (passagesMap[pId] || passagesMap[pId.toLowerCase()] || null) : null,
        };
        if (rowType === 'PQ' && pId) {
          qObj.groupKey = passageGroupKeys[pId] || passageGroupKeys[pId.toLowerCase()];
        }
        parsedQs.push(qObj);
        return;
      }

      // Legacy fallback without Row_Type
      if (cols.length < 3) {
        throw new Error(`Row ${rowNum}: Descriptive row has too few columns (${cols.length}).`);
      }
      parsedQs.push({
        id: Math.random().toString(36).substr(2, 9),
        text: cols[0].trim(),
        options: [],
        answer: cols[1].trim(),
        explanation: cols.slice(2).join('|').trim(),
        passage: null,
      });
      return;
    }

    // Handle Multiple Choice Questions (optionsCount > 0)
    if (rowType === 'Q' || rowType === 'PQ' || rowType === 'DQ') {
      let pId = (cols[1] || '').trim();
      let text = '';
      let options = [];
      let rawAnswer = '';
      let explanation = '';

      // Case 1: AI accidentally omitted the empty Passage_ID column in Q|Text|OptA..D|Ans|Exp
      const isMissingPassageCol =
        rowType === 'Q' &&
        pId !== '' &&
        cols.length >= 3 + optionsCount &&
        cols.length <= 4 + optionsCount &&
        normalizeAnswerLetter(cols[2 + optionsCount], cols.slice(2, 2 + optionsCount), optionsCount) !== null;

      if (isMissingPassageCol) {
        text = pId;
        pId = '';
        options = cols.slice(2, 2 + optionsCount).map((o) => o.trim());
        rawAnswer = cols[2 + optionsCount];
        explanation = cols.slice(3 + optionsCount).join('|').trim();
      } else {
        const trimmedCols = trimTrailingEmptyCols(cols, 5 + optionsCount);
        const ansIndex = 3 + optionsCount;

        if (
          trimmedCols.length >= 4 + optionsCount &&
          normalizeAnswerLetter(
            trimmedCols[ansIndex],
            trimmedCols.slice(3, ansIndex),
            optionsCount
          ) !== null
        ) {
          // Exact standard structure (also cleanly handles extra | inside Explanation)
          text = (trimmedCols[2] || '').trim();
          options = trimmedCols.slice(3, ansIndex).map((o) => o.trim());
          rawAnswer = trimmedCols[ansIndex];
          explanation = trimmedCols.slice(ansIndex + 1).join('|').trim();
        } else if (
          trimmedCols.length > 5 + optionsCount &&
          normalizeAnswerLetter(
            trimmedCols[trimmedCols.length - 2],
            trimmedCols.slice(trimmedCols.length - 2 - optionsCount, trimmedCols.length - 2),
            optionsCount
          ) !== null
        ) {
          // Extra | occurred inside Question_Text; reconstruct Question_Text
          const optStart = trimmedCols.length - 2 - optionsCount;
          text = trimmedCols.slice(2, optStart).join('|').trim();
          options = trimmedCols.slice(optStart, trimmedCols.length - 2).map((o) => o.trim());
          rawAnswer = trimmedCols[trimmedCols.length - 2];
          explanation = trimmedCols[trimmedCols.length - 1].trim();
        } else {
          // Try standard positional extraction so we can give a precise validation message
          const expectedMin = 4 + optionsCount;
          if (trimmedCols.length < expectedMin) {
            throw new Error(
              `Row ${rowNum} (${rowType}): Missing columns. Expected ${optionsCount} options + answer (found ${trimmedCols.length} pipe fields). Preview: "${row.substring(0, 60)}..."`
            );
          }
          text = (trimmedCols[2] || '').trim();
          options = trimmedCols.slice(3, ansIndex).map((o) => o.trim());
          rawAnswer = trimmedCols[ansIndex];
          explanation = trimmedCols.slice(ansIndex + 1).join('|').trim();
        }
      }

      if (!text) {
        throw new Error(`Row ${rowNum} (${rowType}): Question text is empty.`);
      }
      if (options.length !== optionsCount || options.some((o) => !o)) {
        throw new Error(
          `Row ${rowNum} (${rowType}): Expected ${optionsCount} non-empty options, found ${options.filter(Boolean).length}. Preview: "${text.substring(0, 50)}..."`
        );
      }

      const normalizedAnswer = normalizeAnswerLetter(rawAnswer, options, optionsCount);
      if (!normalizedAnswer) {
        throw new Error(
          `Row ${rowNum} (${rowType}): Invalid Correct_Option "${rawAnswer || ''}". Expected A-${String.fromCharCode(64 + optionsCount)}.`
        );
      }

      let passage = null;
      let groupKey = null;
      if (rowType === 'PQ') {
        const lookupId = pId || lastPassageId;
        const resolved = lookupId ? (passagesMap[lookupId] || passagesMap[lookupId.toLowerCase()]) : null;
        if (!resolved) {
          if (pId && pId.length > 40) {
            passage = pId;
            groupKey = `inline_${pId.slice(0, 24)}`;
          } else {
            throw new Error(
              `Row ${rowNum} (PQ): References Passage_ID "${pId}", but no matching P|${pId}|... row was found.`
            );
          }
        } else {
          passage = resolved;
          groupKey = passageGroupKeys[lookupId] || passageGroupKeys[lookupId.toLowerCase()];
        }
      }

      let chartData = null;
      if (rowType === 'DQ') {
        const lookupId = pId || lastChartId;
        const resolvedChart = lookupId ? (chartsMap[lookupId] || chartsMap[lookupId.toLowerCase()]) : null;
        if (!resolvedChart) {
          throw new Error(
            `Row ${rowNum} (DQ): References DI_Set_ID "${pId}", but no matching D|${pId}|... row was found.`
          );
        }
        chartData = resolvedChart;
        groupKey = chartGroupKeys[lookupId] || chartGroupKeys[lookupId.toLowerCase()];
      }

      const qObj = {
        id: Math.random().toString(36).substr(2, 9),
        text,
        options,
        answer: normalizedAnswer,
        explanation,
        passage,
      };
      if (chartData) qObj.chartData = chartData;
      if (groupKey) qObj.groupKey = groupKey;
      parsedQs.push(qObj);
      return;
    }

    // Legacy fallback without Row_Type (e.g. Question|OptA|OptB|OptC|OptD|A|Exp)
    const legacyMinCols = optionsCount + 2;
    if (cols.length < legacyMinCols) {
      throw new Error(
        `Row ${rowNum} is missing pipes (found ${cols.length} columns). Make sure rows start with Q||, PQ|, DQ|, P|, or D| and end with ###. Preview: "${row.substring(0, 60)}..."`
      );
    }

    let text = cols[0].trim();
    let passage = null;
    if (text.toLowerCase().startsWith('passage:')) {
      const parts = text.split(/Question:/i);
      if (parts.length > 1) {
        passage = parts[0].substring(8).trim();
        text = parts.slice(1).join('Question:').trim();
      }
    }

    const options = cols.slice(1, 1 + optionsCount).map((o) => o.trim());
    const rawAnswer = cols[1 + optionsCount];
    const explanation = cols.slice(2 + optionsCount).join('|').trim();
    const normalizedAnswer = normalizeAnswerLetter(rawAnswer, options, optionsCount);

    if (!text || options.some((o) => !o) || !normalizedAnswer) {
      throw new Error(
        `Row ${rowNum} has invalid format or missing Row_Type prefix (Q||). Preview: "${row.substring(0, 60)}..."`
      );
    }

    parsedQs.push({
      id: Math.random().toString(36).substr(2, 9),
      text,
      options,
      answer: normalizedAnswer,
      explanation,
      passage,
    });
  });

  return parsedQs;
}

/**
 * Parse Quiz Duel PSV rows (always 4 options, standalone Q rows).
 */
export function parseQuizDuelPsv(rawString) {
  const qs = parsePsvQuestions(rawString, 4);
  return qs.map((q, idx) => ({
    id: `qd-${idx + 1}`,
    text: q.text,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
  }));
}

/**
 * Shuffle questions while preserving contiguous Passage (PQ) and DI Chart (DQ) blocks together.
 */
export function shuffleQuestionBlocks(questions) {
  if (!Array.isArray(questions) || questions.length <= 1) return questions || [];

  const blocks = [];
  let currentKey = null;
  let currentBlock = [];

  questions.forEach((q) => {
    const key = q.groupKey || (q.passage ? `p_${q.passage}` : null);
    if (key) {
      if (currentKey !== key) {
        if (currentBlock.length > 0) blocks.push(currentBlock);
        currentBlock = [q];
        currentKey = key;
      } else {
        currentBlock.push(q);
      }
    } else {
      if (currentBlock.length > 0) blocks.push(currentBlock);
      currentBlock = [q];
      currentKey = null;
    }
  });
  if (currentBlock.length > 0) blocks.push(currentBlock);

  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  }

  return blocks.flat();
}

/**
 * Normalize escaped newlines (\n) outside LaTeX commands like \neq, \nu, \nabla, \notin.
 */
export function normalizeEscapedNewlines(text) {
  if (!text && text !== 0) return '';
  let str = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Protect LaTeX blocks first so commands like \neq, \nu, \nabla, \notin, \nRightarrow are never corrupted
  const mathTokens = [];
  const protectMath = (input) =>
    input
      .replace(/\$\$[\s\S]*?\$\$/g, (m) => {
        mathTokens.push(m);
        return `\u0001MATH${mathTokens.length - 1}\u0001`;
      })
      .replace(/\\\[[\s\S]*?\\\]/g, (m) => {
        mathTokens.push(m);
        return `\u0001MATH${mathTokens.length - 1}\u0001`;
      })
      .replace(/\\\([\s\S]*?\\\)/g, (m) => {
        mathTokens.push(m);
        return `\u0001MATH${mathTokens.length - 1}\u0001`;
      })
      .replace(/\$(?!\s)(?:\\.|[^$\\\n])+?(?<!\s)\$/g, (m) => {
        // Avoid treating currency pairs like "$50 and $100" as math
        const inner = m.slice(1, -1);
        if (/^\d[\d,.]*(?:\s+[a-zA-Z]+)+/.test(inner) && !/[=^_\\<>+\-*/]/.test(inner)) {
          return m;
        }
        mathTokens.push(m);
        return `\u0001MATH${mathTokens.length - 1}\u0001`;
      });

  str = protectMath(str);
  // Outside math, convert literal \n unless it begins a known LaTeX command
  str = str.replace(
    /\\n(?!(?:eq|u|abla|otin|i|ewline|mid|less|gtr|parallel|cong|sim|exists|subseteq|supseteq|triangle|rightarrow|leftarrow|Rightarrow|Leftarrow|Leftrightarrow)\b)/g,
    '\n'
  );
  // Restore math blocks
  str = str.replace(/\u0001MATH(\d+)\u0001/g, (_, i) => mathTokens[Number(i)]);
  return str;
}

function escapeHtmlChars(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format text safely into HTML while preserving LaTeX/MathJax delimiters, safe formatting tags,
 * markdown bold/inline-code, newlines, and raw inequality symbols (<, >).
 */
export function formatRichTextHtml(text) {
  if (!text && text !== 0) return '';
  let str = normalizeEscapedNewlines(text);

  const mathTokens = [];
  const stashMath = (match) => {
    // Escape <, >, & inside math so HTML parser doesn't swallow "$A < B > C$" as an HTML tag
    const escaped = escapeHtmlChars(match);
    mathTokens.push(escaped);
    return `\u0001MATH${mathTokens.length - 1}\u0001`;
  };

  str = str
    .replace(/\$\$[\s\S]*?\$\$/g, stashMath)
    .replace(/\\\[[\s\S]*?\\\]/g, stashMath)
    .replace(/\\\([\s\S]*?\\\)/g, stashMath)
    .replace(/\$(?!\s)(?:\\.|[^$\\\n])+?(?<!\s)\$/g, (m) => {
      const inner = m.slice(1, -1);
      if (/^\d[\d,.]*(?:\s+[a-zA-Z]+)+/.test(inner) && !/[=^_\\<>+\-*/]/.test(inner)) {
        return m;
      }
      return stashMath(m);
    });

  // Avoid doubling <br/>\n into <br/><br/>
  str = str.replace(/<br\s*\/?>\n/gi, '\n');

  // Preserve safe formatting HTML tags (strip any inline event handlers)
  const htmlTokens = [];
  str = str.replace(SAFE_HTML_TAG_REGEX, (tag) => {
    const cleanTag = tag.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    htmlTokens.push(cleanTag);
    return `\u0002HTML${htmlTokens.length - 1}\u0002`;
  });

  // Escape any remaining raw <, >, & (e.g. A < B > C in inequalities or x < 5)
  str = escapeHtmlChars(str);

  // Markdown bold and inline code (single-line match prevents runaway bold on unclosed **)
  str = str
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Newlines to <br/>
  str = str.replace(/\n/g, '<br/>');

  // Restore safe HTML and math
  str = str
    .replace(/\u0002HTML(\d+)\u0002/g, (_, i) => htmlTokens[Number(i)])
    .replace(/\u0001MATH(\d+)\u0001/g, (_, i) => mathTokens[Number(i)]);

  return str;
}

/**
 * Reliably typeset MathJax on the given elements (or document), handling async script load
 * and clearing stale MathJax tracking before re-typesetting.
 */
export function typesetMath(elements = null) {
  let cancelled = false;
  let attempts = 0;

  const runTypeset = () => {
    if (cancelled) return;
    const mj = window.MathJax;
    if (!mj || !mj.typesetPromise) {
      if (attempts < 25) {
        attempts++;
        setTimeout(runTypeset, 150);
      }
      return;
    }

    const targets = elements
      ? (Array.isArray(elements) ? elements.filter(Boolean) : [elements])
      : undefined;
    if (targets && targets.length === 0) return;

    const execute = () => {
      if (cancelled) return;
      try {
        if (mj.typesetClear) {
          mj.typesetClear(targets);
        }
        mj.typesetPromise(targets).catch((err) => console.error('MathJax typeset error:', err));
      } catch (err) {
        console.error('MathJax error:', err);
      }
    };

    if (mj.startup && mj.startup.promise) {
      mj.startup.promise.then(execute).catch(execute);
    } else {
      execute();
    }
  };

  // Defer one microtask/frame so React DOM updates have flushed
  const frameId = requestAnimationFrame(runTypeset);
  return () => {
    cancelled = true;
    cancelAnimationFrame(frameId);
  };
}
