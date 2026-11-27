import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { normalizeEscapedNewlines } from './questionUtils.js';

const OPTION_COLUMNS = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'];
const REQUIRED_COLUMNS = ['question', 'option_a', 'option_b', 'correct_option'];

/**
 * Parse a CSV string into UnMocked question format
 */
export function parseCSVString(csvString) {
    const result = Papa.parse(csvString.trim(), {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
    });

    const normalized = normalizeRows(result.data);
    const allErrors = [
        ...result.errors.map(e => `${e.message}${e.row !== undefined ? ` (Row ${e.row + 2})` : ''}`),
        ...normalized.errors
    ];

    return {
        questions: normalized.questions,
        errors: allErrors
    };
}

/**
 * Parse an XLSX/XLS file (ArrayBuffer) into UnMocked question format
 */
export function parseExcelBuffer(buffer) {
    try {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        // Normalize headers to lowercase + underscored
        const normalized = rows.map(row => {
            const obj = {};
            for (const [key, value] of Object.entries(row)) {
                obj[key.trim().toLowerCase().replace(/\s+/g, '_')] = value;
            }
            return obj;
        });

        return normalizeRows(normalized);
    } catch (err) {
        return { questions: [], errors: [`Failed to parse Excel file: ${err.message}`] };
    }
}

/**
 * Normalize parsed rows into UnMocked question objects
 */
function normalizeRows(rows) {
    const questions = [];
    const errors = [];

    rows.forEach((row, i) => {
        const lineNum = i + 2; // +2 for header row + 0-index

        // Check required fields
        const missingFields = REQUIRED_COLUMNS.filter(col => !row[col]?.toString().trim());
        if (missingFields.length > 0) {
            errors.push(`Row ${lineNum}: Missing required fields: ${missingFields.join(', ')}`);
            return;
        }

        // Build options array
        const options = OPTION_COLUMNS
            .map(col => row[col]?.toString().split('\\n').join('\n').trim())
            .filter(Boolean);

        if (options.length < 2) {
            errors.push(`Row ${lineNum}: At least 2 options required`);
            return;
        }

        // Resolve correct answer
        const correctKey = row.correct_option?.toString().trim().toUpperCase();
        const correctIndex = correctKey.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3, E=4
        if (correctIndex < 0 || correctIndex >= options.length) {
            errors.push(`Row ${lineNum}: Invalid correct_option "${row.correct_option}". Expected A-${String.fromCharCode(64 + options.length)}`);
            return;
        }

        questions.push({
            text: row.question.toString().split('\\n').join('\n').trim(),
            options,
            correctAnswer: correctIndex,
            explanation: row.explanation?.toString().split('\\n').join('\n').trim() || '',
            subject: row.subject?.toString().trim() || 'General',
            topic: row.topic?.toString().trim() || '',
            subtopic: row.subtopic?.toString().trim() || '',
            difficulty: (row.difficulty?.toString().trim().toLowerCase()) || 'medium',
            questionType: row.question_type?.toString().trim() || 'MCQ',
            examType: row.exam_type?.toString().trim() || '',
        });
    });

    return { questions, errors };
}

/**
 * Export questions array to CSV string
 */
export function questionsToCSV(questions) {
    const rows = questions.map(q => {
        const opts = q.options || [];
        const correctLetter = String.fromCharCode(65 + (q.correctAnswer || 0));
        return {
            question: q.text || q.question || '',
            option_a: opts[0] || '',
            option_b: opts[1] || '',
            option_c: opts[2] || '',
            option_d: opts[3] || '',
            option_e: opts[4] || '',
            correct_option: correctLetter,
            explanation: q.explanation || '',
            subject: q.subject || '',
            topic: q.topic || '',
            subtopic: q.subtopic || '',
            difficulty: q.difficulty || 'medium',
            question_type: q.questionType || q.question_type || 'MCQ',
            exam_type: q.examType || q.exam_type || '',
        };
    });

    return Papa.unparse(rows);
}

/**
 * Detect file type and parse accordingly
 */
export async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
        const text = await file.text();
        return parseCSVString(text);
    }

    if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        return parseExcelBuffer(buffer);
    }

    if (ext === 'json') {
        const text = await file.text();
        try {
            const parsed = JSON.parse(text);
            const arr = Array.isArray(parsed) ? parsed : parsed.questions || [parsed];
            const normalized = arr.map(q => {
                const textVal = q.text || q.question || '';
                const explanationVal = q.explanation || '';
                const opts = Array.isArray(q.options)
                    ? q.options
                    : Object.values(q.options || {});
                return {
                    ...q,
                    text: textVal.toString().split('\\n').join('\n').trim(),
                    options: opts.map(o => (o || '').toString().split('\\n').join('\n').trim()),
                    explanation: explanationVal.toString().split('\\n').join('\n').trim(),
                };
            });
            return { questions: normalized, errors: [] };
        } catch (e) {
            return { questions: [], errors: [`Invalid JSON: ${e.message}`] };
        }
    }

    return { questions: [], errors: [`Unsupported file format: .${ext}. Use .csv, .xlsx, or .json`] };
}

/**
 * Automatically format syllogisms / multi-statement questions with proper newlines
 */
export function formatSyllogismQuestion(text) {
    if (!text) return text;
    const normalized = normalizeEscapedNewlines(text).replace(/<br\s*\/?>/gi, '\n');
    
    // Quick check: does it contain statements and conclusions?
    const lowerText = normalized.toLowerCase();
    const hasStatements = lowerText.includes('statement');
    const hasConclusions = lowerText.includes('conclusion');
    
    if (!hasStatements || !hasConclusions) {
        return normalized;
    }
    
    // Find matching headers and their indexes
    const statementsMatch = normalized.match(/Statement(s)?\s*:/i);
    const conclusionsMatch = normalized.match(/Conclusion(s)?\s*:/i);
    
    if (!statementsMatch || !conclusionsMatch) return normalized;
    
    const statementsIndex = statementsMatch.index;
    const conclusionsIndex = conclusionsMatch.index;
    
    if (conclusionsIndex < statementsIndex) return normalized;
    
    const preText = normalized.substring(0, statementsIndex).trim();
    const statementsPart = normalized.substring(statementsIndex + statementsMatch[0].length, conclusionsIndex).trim();
    const conclusionsPart = normalized.substring(conclusionsIndex + conclusionsMatch[0].length).trim();
    
    // Helper to parse a text block into list of trimmed items
    const parseBlock = (blockText) => {
        const lines = blockText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) return lines;

        const rawList = blockText.split(/\.\s+(?=(?:\d+[\.\)]|\(\d+\)|(?:X|IX|IV|V?I{1,3})[\.\)]|[A-Z]))/);
        const list = [];
        for (let i = 0; i < rawList.length; i++) {
            let item = rawList[i].trim();
            if (!item) continue;
            
            // A standalone label is a digit, single letter, or valid Roman numeral (I..X)
            const isLabel = /^(?:\d+|[a-z]|X|IX|IV|V?I{1,3})$/i.test(item);
            if (isLabel && i < rawList.length - 1) {
                rawList[i + 1] = item + '. ' + rawList[i + 1];
            } else {
                list.push(item);
            }
        }
        return list;
    };
    
    const statementsList = parseBlock(statementsPart);
    const rawConclusionsList = parseBlock(conclusionsPart);
    const finalConclusionsList = [];
    let postText = '';
    
    rawConclusionsList.forEach((c) => {
        const hasIndicator = /^(\d+[\.\)]|\(\d+\)|(?:X|IX|IV|V?I{1,3})[\.\)]|\((?:X|IX|IV|V?I{1,3})\))\s+/i.test(c);
        if (hasIndicator && !postText) {
            finalConclusionsList.push(c);
        } else {
            if (postText) {
                postText += ' ' + c;
            } else {
                postText = c;
            }
        }
    });
    
    if (finalConclusionsList.length === 0) {
        finalConclusionsList.push(...rawConclusionsList);
        postText = '';
    }
    
    // Format statements with standard numbering (1., 2., etc.)
    const formattedStatements = statementsList.map((stmt, idx) => {
        let cleanStmt = stmt.replace(/^(\d+[\.\)]|\(\d+\)|(?:X|IX|IV|V?I{1,3})[\.\)]|\((?:X|IX|IV|V?I{1,3})\))\s+/i, '').trim();
        if (cleanStmt.length > 0) {
            cleanStmt = cleanStmt.charAt(0).toUpperCase() + cleanStmt.slice(1);
            if (!cleanStmt.endsWith('.') && !cleanStmt.endsWith(';')) {
                cleanStmt += '.';
            }
        }
        return `${idx + 1}. ${cleanStmt}`;
    }).filter(s => s.length > 3);
    
    // Format conclusions with Roman numerals (I., II., etc.)
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    const formattedConclusions = finalConclusionsList.map((conclusion, idx) => {
        let cleanConclusion = conclusion.replace(/^(\d+[\.\)]|\(\d+\)|(?:X|IX|IV|V?I{1,3})[\.\)]|\((?:X|IX|IV|V?I{1,3})\))\s+/i, '').trim();
        if (cleanConclusion.length > 0) {
            cleanConclusion = cleanConclusion.charAt(0).toUpperCase() + cleanConclusion.slice(1);
            if (!cleanConclusion.endsWith('.') && !cleanConclusion.endsWith(';')) {
                cleanConclusion += '.';
            }
        }
        const label = romanNumerals[idx] || (idx + 1).toString();
        return `${label}. ${cleanConclusion}`;
    }).filter(c => c.length > 3);
    
    if (formattedStatements.length === 0 || formattedConclusions.length === 0) {
        return normalized; // Fallback if parsing failed completely
    }
    
    let result = '';
    if (preText) {
        result += preText + '\n\n';
    }
    result += statementsMatch[0].trim() + '\n' + formattedStatements.join('\n');
    result += '\n\n' + conclusionsMatch[0].trim() + '\n' + formattedConclusions.join('\n');
    if (postText) {
        result += '\n\n' + postText;
    }
    
    return result;
}

export function parseQuestionText(text) {
    if (!text) return { type: 'plain', text: '' };

    const cleanText = normalizeEscapedNewlines(text).replace(/<br\s*\/?>/gi, '\n');
    const lowerText = cleanText.toLowerCase();
    
    // 1. Check if it's a Syllogism / Statements & Conclusions question
    const hasStatements = lowerText.includes('statement');
    const hasConclusions = lowerText.includes('conclusion');
    if (hasStatements && hasConclusions) {
        const statementsMatch = cleanText.match(/Statement(s)?\s*:/i);
        const conclusionsMatch = cleanText.match(/Conclusion(s)?\s*:/i);
        if (statementsMatch && conclusionsMatch) {
            const statementsIndex = statementsMatch.index;
            const conclusionsIndex = conclusionsMatch.index;
            if (conclusionsIndex > statementsIndex) {
                const direction = cleanText.substring(0, statementsIndex).trim();
                const statementsPart = cleanText.substring(statementsIndex + statementsMatch[0].length, conclusionsIndex).trim();
                const conclusionsPart = cleanText.substring(conclusionsIndex + conclusionsMatch[0].length).trim();

                const itemPrefixRegex = /^(\d{1,2}[\.\)]|\(\d{1,2}\)|(?:X|IX|IV|V?I{1,3})[\.\)]|\((?:X|IX|IV|V?I{1,3})\))\s+/i;
                const splitInlineIfNeeded = (part) => {
                    const byLine = part.split('\n').map(s => s.trim()).filter(Boolean);
                    const splitLine = (line) => {
                        const inlineSplit = line
                            .split(/\s+(?=(?:\d{1,2}[\.\)]|\(\d{1,2}\)|(?:X|IX|IV|V?I{1,3})[\.\)]|\((?:X|IX|IV|V?I{1,3})\))\s+)/)
                            .map(s => s.trim())
                            .filter(Boolean);
                        return inlineSplit.length > 1 ? inlineSplit : [line];
                    };
                    const expanded = byLine.flatMap(splitLine);
                    if (expanded.length > 1 || (expanded.length === 1 && itemPrefixRegex.test(expanded[0]))) {
                        return expanded;
                    }
                    // Fallback: split sentences on single un-numbered line
                    return part.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
                };

                const statements = splitInlineIfNeeded(statementsPart)
                    .map(s => s.replace(itemPrefixRegex, '').trim())
                    .filter(Boolean);
                const rawConclusions = splitInlineIfNeeded(conclusionsPart);

                const conclusions = [];
                const promptLines = [];
                rawConclusions.forEach(rawItem => {
                    const hasExplicitMarker = itemPrefixRegex.test(rawItem);
                    const stripped = rawItem.replace(itemPrefixRegex, '').trim();
                    if (!stripped) return;
                    const lowerItem = stripped.toLowerCase();
                    if (!hasExplicitMarker && conclusions.length > 0 && (
                        lowerItem.includes('option') ||
                        lowerItem.includes('correct') ||
                        lowerItem.includes('?') ||
                        lowerItem.includes('choose') ||
                        lowerItem.includes('follow') ||
                        lowerItem.includes('select')
                    )) {
                        promptLines.push(stripped);
                    } else {
                        conclusions.push(stripped);
                    }
                });
                
                if (statements.length > 0 && conclusions.length > 0) {
                    return {
                        type: 'syllogism',
                        direction,
                        statements,
                        conclusions,
                        prompt: promptLines.join('\n')
                    };
                }
            }
        }
    }

    // 2. Check if it's an English error detection question (contains slashed segments like "Part A / Part B / Part C")
    const slashCount = (cleanText.match(/\//g) || []).length;
    const looksLikeMathOrRelations = /(\$|\\\(|\\div|\\times|\bmeans\b)/i.test(cleanText);
    if (
        slashCount >= 2 &&
        !looksLikeMathOrRelations &&
        (lowerText.includes('error') || lowerText.includes('grammatical') || lowerText.includes('spot') || lowerText.includes('segment'))
    ) {
        const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
        let direction = '';
        let sentence = '';
        let prompt = '';
        
        lines.forEach(line => {
            if (!sentence && (line.match(/\//g) || []).length >= 2) {
                sentence = line;
            } else if (sentence) {
                prompt = (prompt ? prompt + '\n' : '') + line;
            } else {
                direction = (direction ? direction + '\n' : '') + line;
            }
        });

        if (sentence) {
            const segments = sentence
                .split(/\s*\/\s*/)
                .map(seg => seg.replace(/^\([a-eA-E0-9]+\)\s*/, '').replace(/\s*\([a-eA-E0-9]+\)$/, '').trim())
                .filter(Boolean);
            if (segments.length >= 2) {
                return {
                    type: 'english-error',
                    direction,
                    sentence,
                    segments,
                    prompt
                };
            }
        }
    }

    // 3. Check if it has multiline statements or conditions (e.g. UPSC multi-statement, IBPS math/reasoning)
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
    const labeledLineRegex = /^((?:X|IX|IV|V?I{1,3})\.|\(\d{1,2}\)|\d{1,2}[\.\)]|\([a-eA-E]\)|[A-E]\.)\s+(.*)$/;
    const labeledCount = lines.filter(line => labeledLineRegex.test(line)).length;
    if (labeledCount >= 2) {
        const parsedLines = [];
        let direction = '';
        let prompt = '';
        
        lines.forEach(line => {
            const match = line.match(labeledLineRegex);
            if (match && !prompt) {
                parsedLines.push({ label: match[1], content: match[2] });
            } else {
                if (parsedLines.length > 0) {
                    const lowerLine = line.toLowerCase();
                    if (
                        prompt ||
                        lowerLine.includes('option') ||
                        lowerLine.includes('correct') ||
                        lowerLine.includes('?') ||
                        lowerLine.includes('choose') ||
                        lowerLine.includes('which of') ||
                        lowerLine.includes('select') ||
                        lowerLine.includes('find ')
                    ) {
                        prompt = (prompt ? prompt + '\n' : '') + line;
                    } else {
                        parsedLines[parsedLines.length - 1].content += '\n' + line;
                    }
                } else {
                    direction = (direction ? direction + '\n' : '') + line;
                }
            }
        });
        
        if (parsedLines.length >= 2) {
            return {
                type: 'multiline-statements',
                direction,
                statements: parsedLines,
                prompt
            };
        }
    }

    // 4. Default: Plain text
    return {
        type: 'plain',
        text: cleanText
    };
}

