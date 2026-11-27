import React from 'react';
import { parseQuestionText } from '../utils/csvParser';
import { formatRichTextHtml } from '../utils/questionUtils';
import './QuestionRenderer.css';

const QuestionRenderer = ({ text, theme = 'dark' }) => {
    const parsed = parseQuestionText(text);
    const themeClass = theme === 'light' ? 'q-theme-light' : '';

    if (parsed.type === 'syllogism') {
        const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        return (
            <div className={`q-renderer q-syllogism animate-fade-in ${themeClass}`}>
                {parsed.direction && (
                    <p
                        className="q-direction math-inline-force"
                        dangerouslySetInnerHTML={{ __html: formatRichTextHtml(parsed.direction) }}
                    />
                )}
                
                <div className="q-syllogism-layout">
                    <div className="q-syllogism-card glass">
                        <span className="q-card-title">📝 Statements</span>
                        <ul className="q-statement-list">
                            {parsed.statements.map((stmt, idx) => (
                                <li key={idx} className="q-item">
                                    <span className="q-marker">{idx + 1}.</span>
                                    <span
                                        className="q-content math-inline-force"
                                        dangerouslySetInnerHTML={{ __html: formatRichTextHtml(stmt) }}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="q-syllogism-card glass">
                        <span className="q-card-title">🎯 Conclusions</span>
                        <ul className="q-conclusion-list">
                            {parsed.conclusions.map((conc, idx) => (
                                <li key={idx} className="q-item">
                                    <span className="q-marker roman">{romanNumerals[idx] || (idx + 1)}.</span>
                                    <span
                                        className="q-content math-inline-force"
                                        dangerouslySetInnerHTML={{ __html: formatRichTextHtml(conc) }}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {parsed.prompt && (
                    <p
                        className="q-prompt math-inline-force"
                        dangerouslySetInnerHTML={{ __html: formatRichTextHtml(parsed.prompt) }}
                    />
                )}
            </div>
        );
    }

    if (parsed.type === 'english-error' && Array.isArray(parsed.segments)) {
        return (
            <div className={`q-renderer q-english-error animate-fade-in ${themeClass}`}>
                {parsed.direction && (
                    <p
                        className="q-direction math-inline-force"
                        dangerouslySetInnerHTML={{ __html: formatRichTextHtml(parsed.direction) }}
                    />
                )}
                <div className="q-sentence-box glass">
                    <div className="q-capsules-grid">
                        {parsed.segments.map((seg, idx) => (
                            <div key={idx} className="q-capsule-item">
                                <div className="q-capsule">
                                    <span
                                        className="q-capsule-text math-inline-force"
                                        dangerouslySetInnerHTML={{ __html: formatRichTextHtml(seg) }}
                                    />
                                </div>
                                <span className="q-capsule-letter">{String.fromCharCode(65 + idx)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                {parsed.prompt && (
                    <p
                        className="q-prompt math-inline-force"
                        dangerouslySetInnerHTML={{ __html: formatRichTextHtml(parsed.prompt) }}
                    />
                )}
            </div>
        );
    }

    if (parsed.type === 'multiline-statements') {
        return (
            <div className={`q-renderer q-multiline animate-fade-in ${themeClass}`}>
                {parsed.direction && (
                    <p
                        className="q-direction math-inline-force"
                        dangerouslySetInnerHTML={{ __html: formatRichTextHtml(parsed.direction) }}
                    />
                )}
                
                <div className="q-statements-grid">
                    {parsed.statements.map((stmt, idx) => (
                        <div key={idx} className="q-stmt-row glass">
                            <span className="q-stmt-label">{stmt.label}</span>
                            <span
                                className="q-stmt-content math-inline-force"
                                dangerouslySetInnerHTML={{ __html: formatRichTextHtml(stmt.content) }}
                            />
                        </div>
                    ))}
                </div>

                {parsed.prompt && (
                    <p
                        className="q-prompt math-inline-force"
                        dangerouslySetInnerHTML={{ __html: formatRichTextHtml(parsed.prompt) }}
                    />
                )}
            </div>
        );
    }

    // Default plain text rendering (maintaining format with newlines, bold, and LaTeX)
    const plainLines = (parsed.text || '').split('\n');
    return (
        <div className={`q-renderer q-plain animate-fade-in ${themeClass}`}>
            {plainLines.map((line, idx) => {
                if (!line.trim()) return <div key={idx} className="q-spacer" />;
                
                // Check if line starts with a list indicator
                const listMatch = line.match(/^(\d{1,2}\.|\*|-|\u2022|\([0-9a-zA-Z]{1,3}\))\s+(.*)/);
                if (listMatch) {
                    return (
                        <div key={idx} className="q-plain-list-item">
                            <span className="q-bullet">{listMatch[1]}</span>
                            <span
                                className="q-bullet-text math-inline-force"
                                dangerouslySetInnerHTML={{ __html: formatRichTextHtml(listMatch[2]) }}
                            />
                        </div>
                    );
                }
                return (
                    <p
                        key={idx}
                        className="q-plain-paragraph math-inline-force"
                        dangerouslySetInnerHTML={{ __html: formatRichTextHtml(line) }}
                    />
                );
            })}
        </div>
    );
};

export default QuestionRenderer;
