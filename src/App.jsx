import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';

// ============================================
// CONFIGURATION
// ============================================

const categoryStyles = {
  correctness: { 
    bg: '#E6F7F1', 
    text: '#0F5132', 
    bar: '#17B26A', 
    light: '#F2FBF6', 
    gradient: 'from-emerald-400 to-green-500', 
    icon: '✓', 
    label: 'Grammar & Spelling' 
  },
  clarity: { 
    bg: '#E8F4FF', 
    text: '#1F4B67', 
    bar: '#2DB2D3', 
    light: '#F3F8FF', 
    gradient: 'from-cyan-400 to-sky-500', 
    icon: '◎', 
    label: 'Clarity' 
  },
  engagement: { 
    bg: '#F3F1FF', 
    text: '#3F3CBB', 
    bar: '#7C7CF2', 
    light: '#F8F6FF', 
    gradient: 'from-indigo-400 to-violet-500', 
    icon: '★', 
    label: 'Impact & Engagement' 
  },
  delivery: { 
    bg: '#FFF4E5', 
    text: '#B25E09', 
    bar: '#F6A83F', 
    light: '#FFF8EE', 
    gradient: 'from-amber-400 to-orange-500', 
    icon: '▸', 
    label: 'Professional Delivery' 
  },
  keyword: { 
    bg: '#E6FAF4', 
    text: '#1B6E57', 
    bar: '#18B981', 
    light: '#F1FDF8', 
    gradient: 'from-teal-400 to-emerald-500', 
    icon: '+', 
    label: 'Keywords & ATS' 
  }
};


// Generate conversational script for each change
const generateScript = (change, index, total, score) => {
  const style = categoryStyles[change.type];
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const categoryIntros = {
    correctness: [
      "I noticed a small grammar issue that we should fix.",
      "There's a spelling or grammar thing here that could look unprofessional.",
      "Quick fix here - it's a simple correction but makes a big difference."
    ],
    clarity: [
      "This part could be clearer for the recruiter.",
      "Let's make this easier to understand at a glance.",
      "The meaning here is a bit ambiguous - let's sharpen it up."
    ],
    engagement: [
      "This is where we can really make you stand out!",
      "Let's add some punch to this section.",
      "Recruiters love seeing concrete results - let's highlight that."
    ],
    delivery: [
      "The tone here could be more professional.",
      "Let's polish this for better presentation.",
      "Small tweak to make this sound more executive-level."
    ],
    keyword: [
      "This is a big one for getting past the ATS systems!",
      "The job description specifically mentions this - we need it in your CV.",
      "Adding this keyword could significantly boost your match score."
    ]
  };

  const buildFallbackNarrativeIntro = () => {
    const previousLabel = isFirst ? 'where we start the story' : (change.prevTitle || 'the last tweak we made');
    const nextLabel = isLast ? 'finish strong' : (change.nextTitle || 'the next improvement waiting for us');
    const currentFocus = change.title ? change.title.toLowerCase() : 'this next refinement';
    return `${isFirst ? "Let's kick off" : 'Building on'} ${previousLabel}, we shift into ${currentFocus} so your CV flows naturally—${isLast ? 'this ties the journey together.' : `setting up a smooth handoff to ${nextLabel}.`}`;
  };

  const impacts = [
    `This change alone could improve your match score by about ${Math.round(100/total)}%.`,
    `Recruiters will definitely notice this improvement.`,
    `This aligns your CV much better with what they're looking for.`,
    `Small change, big impact on readability.`,
    `This makes your experience much more relevant to the role.`
  ];

  const categoryIntro = categoryIntros[change.type][index % categoryIntros[change.type].length];
  
  const mainExplanation = change.description;
  
  const impact = impacts[index % impacts.length];

  const narrativeIntro = (change.narrativeIntro || '').trim() || buildFallbackNarrativeIntro();
  
  const outro = isLast
    ? `And that's all ${total} improvements! Apply these changes and you'll have a much stronger CV for this role.`
    : `Great, let's move on to the next one.`;

  return {
    narrativeIntro,
    categoryIntro,
    mainExplanation,
    impact,
    outro,
    fullScript: `${narrativeIntro} ${mainExplanation}`.trim()
  };
};

// Generate narrative intros that connect slides together
const generateStorytellingIntros = async (changes = [], apiKey, onLog) => {
  if (!apiKey || !Array.isArray(changes) || changes.length === 0) return [];

  const formatChange = (change, idx) => `Change ${idx + 1} (id: ${change.id || `s-${idx}`}):
- Title: ${change.title || 'Untitled'}
- Category: ${change.type || 'unknown'}
- Description: ${change.description || ''}
- Original: ${change.original || ''}
- Replacement: ${change.replacement || ''}`;

  const changeList = changes.map(formatChange).join('\n\n');

  const prompt = `You are a concise storytelling coach who connects resume improvements into a single narrative.

Given the ordered list of changes below, write a short opening sentence for EACH change that:
- The first slide must begin with a warm, natural general introduction and alos provide a sets context for the overall story before referencing any specific fix.
- Briefly recalls what we just fixed (or notes it's the first change)
- Explains why this change matters right now
- Uses plain, friendly language (under 35 words per sentence)

Return ONLY valid JSON in this exact shape:
{"intros":[{"id":"<change id>","intro":"<short connecting sentence>"}]}

CHANGES (in order):
${changeList}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 1200,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const content = data.choices?.[0]?.message?.content || '';

    onLog?.({
      stage: 'story',
      provider: 'openai',
      model: 'gpt-5.2',
      prompt,
      response: content,
      status: 'success'
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in storytelling response');
    const parsed = JSON.parse(jsonMatch[0]);
    const intros = parsed.intros || parsed.narratives || parsed.items || [];
    return Array.isArray(intros) ? intros : [];
  } catch (error) {
    onLog?.({
      stage: 'story',
      provider: 'openai',
      model: 'gpt-5.2',
      prompt,
      response: error.message,
      status: 'error'
    });
    console.error('Storytelling intro generation error:', error);
    return [];
  }
};

const mergeNarrativesIntoChanges = (changes = [], narrativeEntries = []) => {
  const narrativeMap = new Map();

  narrativeEntries.forEach((entry, idx) => {
    if (!entry) return;
    const introText = (entry.intro || entry.narrative || entry.text || '').trim();
    if (!introText) return;

    const possibleIndex = typeof entry.index === 'number'
      ? entry.index
      : (typeof entry.order === 'number' ? entry.order - 1 : null);

    if (entry.id) narrativeMap.set(entry.id, introText);
    if (entry.changeId) narrativeMap.set(entry.changeId, introText);
    if (possibleIndex !== null && possibleIndex >= 0) narrativeMap.set(possibleIndex, introText);
    narrativeMap.set(idx, introText);
  });

  return changes.map((change, idx) => {
    const prevChange = changes[idx - 1];
    const nextChange = changes[idx + 1];
    const narrativeIntro = narrativeMap.get(change.id) 
      || narrativeMap.get(idx) 
      || narrativeMap.get(idx + 1) 
      || '';

    return {
      ...change,
      prevTitle: prevChange?.title,
      nextTitle: nextChange?.title,
      narrativeIntro: narrativeIntro || undefined
    };
  });
};

// ============================================
// API INTEGRATION
// ============================================

const extractKeywords = async (jobDescription, apiKey, apiProvider = 'anthropic', onLog) => {
  const prompt = `Given the following job description, identify the most important keywords and phrases that would increase a candidate's chances during the interview process.

Focus on:
- Technical skills and tools
- Methodologies and frameworks
- Industry-specific terminology
- Soft skills explicitly mentioned
- Required qualifications and certifications

Return ONLY a JSON array of keywords, nothing else:

VALID EXAMPLE:
{"keywords":[list of extracted keywords]}

JOB DESCRIPTION:
${jobDescription}`;

  try {
    let content;
    const model = apiProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-5.2';

    if (apiProvider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      content = data.content?.[0]?.text || '';
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 1000,
          reasoning_effort: "low",
          response_format: { type: 'json_object' }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      content = data.choices?.[0]?.message?.content || '';
    }

    onLog?.({
      stage: 'keywords',
      provider: apiProvider,
      model,
      prompt,
      response: content,
      status: 'success'
    });

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in keyword response');
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    onLog?.({
      stage: 'keywords',
      provider: apiProvider,
      model: apiProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-5.2',
      prompt,
      response: error.message,
      status: 'error'
    });
    console.error('Keyword extraction error:', error);
    throw error;
  }
};

const keywordBoundaryRegex = (keyword) => {
  const cleaned = typeof keyword === 'string' ? keyword.trim() : '';
  if (!cleaned) return null;
  const escaped = cleaned
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  // Treat letters, numbers, +, and # as part of a keyword; everything else is a boundary.
  return new RegExp(`(^|[^A-Za-z0-9+#])(${escaped})([^A-Za-z0-9+#]|$)`, 'i');
};

const keywordMatchesText = (keyword, text) => {
  const regex = keywordBoundaryRegex(keyword);
  if (!regex) return false;
  const haystack = typeof text === 'string' ? text : '';
  return regex.test(haystack);
};

const validateKeywords = (keywords = [], jobDescription = '', cvText = '') => {
  const seen = new Set();

  return keywords
    .map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
    .filter(Boolean)
    .filter((keyword) => {
      const key = keyword.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((keyword) => {
      return {
        keyword,
        inJobDescription: keywordMatchesText(keyword, jobDescription),
        inCV: keywordMatchesText(keyword, cvText)
      };
    });
};

const analyzeCV = async (cvText, jobDescription, apiKey, apiProvider = 'anthropic', onLog, onProgress, providedKeywords = null) => {
  // Step 1: Extract keywords from job description (or use user-confirmed list)
  const rawKeywords = Array.isArray(providedKeywords) && providedKeywords.length > 0
    ? providedKeywords
    : await extractKeywords(jobDescription, apiKey, apiProvider, onLog);
  
  // Step 2: Validate keywords actually appear in the text
  const validatedKeywords = validateKeywords(rawKeywords, jobDescription, cvText);
  
  const keywordsInJob = validatedKeywords.filter(k => k.inJobDescription).map(k => k.keyword);
  const keywordsInCV = validatedKeywords.filter(k => k.inCV).map(k => k.keyword);
  const missingKeywords = validatedKeywords.filter(k => k.inJobDescription && !k.inCV).map(k => k.keyword);

  onProgress?.({
    stage: 'keywords',
    totalKeywords: keywordsInJob.length,
    matchedKeywords: keywordsInCV.length,
    matchedKeywordsList: keywordsInCV,
    missingKeywords,
    message: `Found ${keywordsInJob.length} validated keywords; ${missingKeywords.length} are missing from your CV.`
  });

  // Step 3: Build enhanced analysis prompt
  const systemPrompt = `You are an expert CV analyst focused on ethical, honest CV improvements. Your role is to help job seekers present their genuine qualifications more effectively—not to fabricate or exaggerate.

EXTRACTED KEYWORDS FROM JOB DESCRIPTION (validated):
${keywordsInJob.join(', ')}

KEYWORDS ALREADY IN CV:
${keywordsInCV.join(', ')}

KEYWORDS IN JOB BUT MISSING FROM CV:
${missingKeywords.join(', ')}

Given the job description, the current CV, and the extracted keywords (limited strictly to those that explicitly appear in either text), apply only the necessary changes to improve the CV's relevance, clarity, and competitiveness for the role.

MODIFICATION CATEGORIES (use ONLY these types):

1. "correctness" - Grammatical and stylistic corrections
   • Minimal edits to fix grammar, syntax, punctuation, and readability
   • No change in meaning or content

2. "keyword" - Keyword normalization and alignment
   • Replace or adjust equivalent terms to match job description terminology
   • Examples: "ML" → "Machine Learning", "GenAI" → "Generative AI"
   • NO introduction of new concepts not already present

3. "clarity" - Clarity, tone, and intent rephrasing
   • Rephrase vague or weakly worded sentences
   • Preserve all relevant keywords and intent
   • Improve professional tone for HR readability

4. "delivery" - Structural and signal-strength optimization
   • Reorder or refine bullet points for relevance and impact
   • Make implied outcomes clearer
   • Improve consistency and scannability
   • NO new information added

STRICT RULES:
- Do NOT add skills, experiences, metrics, or keywords not explicitly supported by the original CV
- Do NOT suggest adding missing keywords unless the CV already demonstrates that skill in different words
- The goal is honest optimization, not fabrication
- Help both job seekers AND HR find genuine matches

Return ONLY valid JSON:
{
  "score": <number 0-100 representing current CV-job alignment>,
  "keywordAnalysis": {
    "matched": <number of job keywords found in CV>,
    "total": <total validated job keywords>,
    "coverage": <percentage>
  },
  "suggestions": [
    {
      "id": "s-1",
      "type": "<correctness|keyword|clarity|delivery>",
      "title": "<short descriptive title>",
      "description": "<conversational explanation and the reason how it can contibute to the improvment, few necessary sentences, like a helpful career coach>",
      "original": "<exact text from CV - must be verbatim substring>",
      "replacement": "<improved text>",
      "importance": "<high|medium|low>",
      "rationale": "<brief explanation of why this change helps without being dishonest>"
    }
  ]
}

Ensure that proposed modifications do not conflict with one another. Only include independent, non-overlapping changes. Provide high-impact suggestions only. The "original" field MUST be an exact substring from the CV.`;

  const userMessage = `JOB DESCRIPTION:\n${jobDescription}\n\nCV:\n${cvText}`;
  const model = apiProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-5.2';
  const combinedPrompt = apiProvider === 'anthropic'
    ? `${systemPrompt}\n\n${userMessage}`
    : `System:\n${systemPrompt}\n\nUser:\n${userMessage}`;

  onProgress?.({
    stage: 'generating',
    message: 'Generating tailored corrections based on the validated keywords...'
  });

  try {
    let content;

    if (apiProvider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          messages: [{ role: 'user', content: `${systemPrompt}\n\n${userMessage}` }]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      content = data.content?.[0]?.text || '';
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_completion_tokens: 5000,
          reasoning_effort: "low",
          verbosity: "medium",
          response_format: { type: 'json_object' }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      content = data.choices?.[0]?.message?.content || '';
    }

    onLog?.({
      stage: 'analysis',
      provider: apiProvider,
      model,
      prompt: combinedPrompt,
      response: content,
      status: 'success'
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const result = JSON.parse(jsonMatch[0]);

    // Validate that original text actually exists in CV
    const validated = (result.suggestions || [])
      .map((s, idx) => {
        const start = cvText.indexOf(s.original);
        if (start === -1) {
          console.warn(`Suggestion "${s.title}" has original text not found in CV, skipping`);
          return null;
        }
        return {
          ...s,
          id: s.id || `s-${idx}`,
          startIndex: start,
          endIndex: start + s.original.length
        };
      })
      .filter(Boolean);

    onProgress?.({
      stage: 'done',
      message: 'Walkthrough ready with personalized corrections.'
    });

    return {
      score: result.score || 50,
      keywordAnalysis: result.keywordAnalysis || {
        matched: keywordsInCV.length,
        total: keywordsInJob.length,
        coverage: keywordsInJob.length > 0 
          ? Math.round((keywordsInCV.length / keywordsInJob.length) * 100) 
          : 0
      },
      validatedKeywords: {
        inJob: keywordsInJob,
        inCV: keywordsInCV,
        missing: missingKeywords
      },
      suggestions: validated
    };
  } catch (error) {
    onLog?.({
      stage: 'analysis',
      provider: apiProvider,
      model,
      prompt: combinedPrompt,
      response: error.message,
      status: 'error'
    });
    console.error('CV Analysis Error:', error);
    throw error;
  }
};

// Generate new modifications based on a user request (chat or voice prompt)
const generateUserRequestedChanges = async (
  cvText,
  jobDescription,
  currentDraft,
  userRequest,
  apiKey,
  apiProvider = 'anthropic',
  existingChanges = [],
  onLog
) => {
  const trimmedRequest = (userRequest || '').trim();
  if (!trimmedRequest) {
    throw new Error('Please provide a specific request for the modification chat.');
  }

  const existingTitles = existingChanges
    .map((change, idx) => `${idx + 1}. ${change.title || change.id || 'Untitled'} (${change.type || 'unknown'})`)
    .join('\n');

  const prompt = `You are a precise CV improvement assistant. The user provided a natural-language request for additional tweaks.

BASE CV (original, unedited):
${cvText}

CURRENT DRAFT (after applied/pending changes):
${currentDraft || cvText}

EXISTING RECOMMENDATIONS (avoid duplicates):
${existingTitles || 'None yet'}

USER REQUEST:
${trimmedRequest}

Create 1-3 NEW modifications that directly satisfy the user's request while staying honest to the CV. Follow these rules:
- Do NOT repeat existing modifications (match by meaning/title/replacement).
- No fabricated skills or achievements; only rephrase, clarify, or elevate what is already present.
- "original" MUST be an exact substring from CURRENT DRAFT if possible; fall back to BASE CV only if not present in the current draft.
- Keep suggestions independent and non-overlapping.
- Stick to the existing categories: correctness, keyword, clarity, delivery.

Return ONLY valid JSON:
{
  "score": <number 0-100 representing current CV-job alignment>,
  "keywordAnalysis": {
    "matched": <number of job keywords found in CV>,
    "total": <total validated job keywords>,
    "coverage": <percentage>
  },
  "suggestions": [
    {
      "id": "s-1",
      "type": "<correctness|keyword|clarity|delivery>",
      "title": "<short descriptive title>",
      "description": "<conversational explanation and the reason how it can contibute to the improvment, few necessary sentences, like a helpful career coach>",
      "original": "<exact text from CV - must be verbatim substring>",
      "replacement": "<improved text>",
      "importance": "<high|medium|low>",
      "rationale": "<brief explanation of why this change helps without being dishonest>"
    }
  ]
}`;

  try {
    const model = apiProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-5.2';
    let content = '';

    if (apiProvider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      content = data.content?.[0]?.text || '';
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 2000,
          reasoning_effort: 'medium',
          response_format: { type: 'json_object' }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      content = data.choices?.[0]?.message?.content || '';
    }

    onLog?.({
      stage: 'user-request',
      provider: apiProvider,
      model,
      prompt,
      response: content,
      status: 'success'
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in user-request response');

    const parsed = JSON.parse(jsonMatch[0]);
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    return {
      score: parsed.score,
      keywordAnalysis: parsed.keywordAnalysis,
      suggestions
    };
  } catch (error) {
    onLog?.({
      stage: 'user-request',
      provider: apiProvider,
      model: apiProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-5.2',
      prompt,
      response: error.message,
      status: 'error'
    });
    console.error('User-request modification error:', error);
    throw error;
  }
};

// Apply validated suggestions to the CV text to generate an improved draft
const applySuggestionsToCV = (cvText, suggestions = []) => {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return { text: cvText, applied: [] };
  }

  // Preserve relative order while generally moving earlier edits first
  const sorted = suggestions
    .map((s, idx) => ({ ...s, __order: idx }))
    .sort((a, b) => {
      const aPos = typeof a.startIndex === 'number' && a.startIndex >= 0 ? a.startIndex : Infinity;
      const bPos = typeof b.startIndex === 'number' && b.startIndex >= 0 ? b.startIndex : Infinity;
      if (aPos !== bPos) return aPos - bPos;
      return a.__order - b.__order;
    });

  let output = cvText;
  const applied = [];

  sorted.forEach((s) => {
    const target = typeof s.original === 'string' ? s.original : '';
    if (!target) return;

    const idx = output.indexOf(target);
    if (idx === -1) return;

    const replacementText = typeof s.replacement === 'string' ? s.replacement : target;
    output = `${output.slice(0, idx)}${replacementText}${output.slice(idx + target.length)}`;
    applied.push(s.id);
  });

  return { text: output, applied };
};

// Re-check which keywords remain missing after applying the replacements
const computeMissingKeywordsAfter = (keywordsInJob = [], updatedCV = '') => {
  const haystack = typeof updatedCV === 'string' ? updatedCV : '';
  return (keywordsInJob || [])
    .map((kw) => (typeof kw === 'string' ? kw : '').trim())
    .filter(Boolean)
    .filter((kw) => !keywordMatchesText(kw, haystack));
};

const MANUAL_DEBOUNCE_MS = 1500;

// Identify which validated keywords were newly introduced between two texts
const findNewKeywordsInDiff = (before = '', after = '', validatedKeywords = null) => {
  const inJob = validatedKeywords?.inJob || [];
  if (!Array.isArray(inJob) || inJob.length === 0) return [];

  const beforeLower = before.toLowerCase();
  const afterLower = after.toLowerCase();

  return inJob.filter((kw) => {
    const term = (kw || '').toLowerCase();
    if (!term) return false;
    return afterLower.includes(term) && !beforeLower.includes(term);
  });
};

// Build a manual change entry from a text diff
const buildManualChangeEntry = (before = '', after = '', changeId, validatedKeywords = null) => {
  if (before === after) return null;

  const minLength = Math.min(before.length, after.length);
  let start = 0;
  while (start < minLength && before[start] === after[start]) {
    start += 1;
  }

  let endBefore = before.length - 1;
  let endAfter = after.length - 1;
  while (endBefore >= start && endAfter >= start && before[endBefore] === after[endAfter]) {
    endBefore -= 1;
    endAfter -= 1;
  }

  const original = before.slice(start, endBefore + 1);
  const replacement = after.slice(start, endAfter + 1);

  // Skip empty replacements (pure deletions don't render well in the overlay)
  if (!replacement) return null;

  const addedKeywords = findNewKeywordsInDiff(before, after, validatedKeywords);
  const type = addedKeywords.length > 0 ? 'keyword' : 'clarity';
  const title = addedKeywords.length > 0
    ? `Added keyword${addedKeywords.length > 1 ? 's' : ''}`
    : 'Manual edit';
  const description = addedKeywords.length > 0
    ? `You manually added ${addedKeywords.length === 1 ? 'a keyword' : 'keywords'}: ${addedKeywords.join(', ')}.`
    : 'You manually edited this section directly in the draft.';

  const startIndex = Math.min(start, after.length);
  const endIndex = startIndex + replacement.length;

  return {
    id: changeId,
    type,
    title,
    description,
    original,
    replacement,
    importance: 'medium',
    rationale: 'Captured from manual edits in the editor.',
    startIndex,
    endIndex,
    manual: true,
    addedKeywords
  };
};

// Apply a change to a given text (used when toggling decisions)
const applyChangeToText = (text = '', change) => {
  if (!change) return text || '';
  const source = typeof text === 'string' ? text : '';
  const replacement = typeof change.replacement === 'string' ? change.replacement : '';
  const original = typeof change.original === 'string' ? change.original : '';
  const hint = typeof change.startIndex === 'number' ? Math.max(0, change.startIndex) : 0;

  if (original) {
    let idx = source.indexOf(original, hint);
    if (idx === -1) idx = source.indexOf(original);
    if (idx === -1) {
      // Possibly already applied
      return source;
    }
    return `${source.slice(0, idx)}${replacement || original}${source.slice(idx + original.length)}`;
  }

  if (replacement) {
    const alreadyHas = source.indexOf(replacement, hint) !== -1 || source.indexOf(replacement) !== -1;
    if (alreadyHas) return source;
    const safeHint = Math.min(hint, source.length);
    return `${source.slice(0, safeHint)}${replacement}${source.slice(safeHint)}`;
  }

  return source;
};

// Revert a change inside a text (swap replacement back to original)
const revertChangeInText = (text = '', change) => {
  if (!change) return text || '';
  const source = typeof text === 'string' ? text : '';
  const replacement = typeof change.replacement === 'string' ? change.replacement : '';
  const original = typeof change.original === 'string' ? change.original : '';
  const hint = typeof change.startIndex === 'number' ? Math.max(0, change.startIndex) : 0;

  if (replacement) {
    let idx = source.indexOf(replacement, hint);
    if (idx === -1) idx = source.indexOf(replacement);
    if (idx === -1) return source;
    return `${source.slice(0, idx)}${original || ''}${source.slice(idx + replacement.length)}`;
  }

  return source;
};

//export { analyzeCV, extractKeywords, validateKeywords };

// ============================================
// OPENAI TEXT-TO-SPEECH API
// ============================================
// Guidance string for OpenAI TTS voice, accent, and style.
const TTS_VOICE_GUIDANCE = `Accent/Affect: Warm, refined, and gently instructive, reminiscent of a friendly art instructor.

Tone: Calm, encouraging, and articulate, clearly describing each step with patience.

Pacing: Slow and deliberate, pausing often to allow the listener to follow instructions comfortably.

Emotion: Cheerful, supportive, and pleasantly enthusiastic; convey genuine enjoyment and appreciation of art.

Pronunciation: Clearly articulate artistic terminology (e.g., "brushstrokes," "landscape," "palette") with gentle emphasis.

Personality Affect: Friendly and approachable with a hint of sophistication; speak confidently and reassuringly, guiding users through each painting step patiently and warmly.
`;

const DEFAULT_AUDIO_CACHE_LIMIT = 8;
const PREFETCH_AUDIO_CACHE_LIMIT = 36;
const AUDIO_DB_NAME = 'cv-coach-tts-cache';
const AUDIO_DB_STORE = 'audio';
const PERSISTED_CACHE_LIMIT = 28;

const sharedAudioStore = {
  cache: new Map(),
  prefetchTasks: new Map(),
  order: [],
  persistenceDisabled: false,
  dbPromise: null
};

const supportsIndexedDb = () => typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const openAudioDb = () => {
  if (!supportsIndexedDb() || sharedAudioStore.persistenceDisabled) return Promise.resolve(null);
  if (sharedAudioStore.dbPromise) return sharedAudioStore.dbPromise;

  sharedAudioStore.dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(AUDIO_DB_NAME, 1);
      request.onerror = () => {
        sharedAudioStore.persistenceDisabled = true;
        resolve(null);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(AUDIO_DB_STORE)) {
          db.createObjectStore(AUDIO_DB_STORE);
        }
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
    } catch (err) {
      console.warn('IndexedDB unavailable for audio cache', err);
      sharedAudioStore.persistenceDisabled = true;
      resolve(null);
    }
  });

  return sharedAudioStore.dbPromise;
};

const persistAudioBlob = async (key, blob) => {
  if (!blob) return;
  const db = await openAudioDb();
  if (!db) return;
  try {
    const tx = db.transaction(AUDIO_DB_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_DB_STORE);
    store.put({ blob, updatedAt: Date.now() }, key);
  } catch (err) {
    console.warn('Could not persist audio blob', err);
  }
};

const loadAudioBlob = async (key) => {
  const db = await openAudioDb();
  if (!db) return null;
  try {
    const tx = db.transaction(AUDIO_DB_STORE, 'readonly');
    const store = tx.objectStore(AUDIO_DB_STORE);
    const result = await new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => resolve(null);
    });
    return result || null;
  } catch (err) {
    console.warn('Could not read persisted audio', err);
    return null;
  }
};

const deletePersistedAudio = async (key) => {
  const db = await openAudioDb();
  if (!db) return;
  try {
    const tx = db.transaction(AUDIO_DB_STORE, 'readwrite');
    tx.objectStore(AUDIO_DB_STORE).delete(key);
  } catch (err) {
    console.warn('Could not delete persisted audio', err);
  }
};

const generateSpeech = async (text, apiKey, voice = 'onyx', speed = 1.2, signal) => {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    signal,
    body: JSON.stringify({
      model: 'tts-1',
      instructions: TTS_VOICE_GUIDANCE,
      input: text,
      voice: voice, // alloy, echo, fable, onyx, nova, shimmer
      speed: speed, // 0.25 to 4.0
      response_format: 'wav'
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'TTS request failed' } }));
    throw new Error(error.error?.message || 'TTS request failed');
  }

  const audioBlob = await response.blob();
  return { audioUrl: URL.createObjectURL(audioBlob), audioBlob };
};

// ============================================
// AUDIO SYSTEM WITH OPENAI TTS
// ============================================

const useAudioSystem = (apiKey) => {
  const ctxRef = useRef(null);
  const audioRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef(null);
  const prefetchTasksRef = useRef(sharedAudioStore.prefetchTasks);
  const audioCacheRef = useRef(sharedAudioStore.cache);
  const cacheOrderRef = useRef(sharedAudioStore.order);
  const cacheLimitRef = useRef(Math.max(DEFAULT_AUDIO_CACHE_LIMIT, sharedAudioStore.order.length || 0));

  const makeCacheKey = useCallback((text, voice, speed) => `${voice}-${speed}-${text}`, []);
  const getSpeechKey = useCallback((text, voice = 'onyx', speed = 1.4) => makeCacheKey(text, voice, speed), [makeCacheKey]);

  const registerCacheUse = useCallback((key) => {
    if (!key) return;
    const order = cacheOrderRef.current;
    const existingIndex = order.indexOf(key);
    if (existingIndex !== -1) {
      order.splice(existingIndex, 1);
    }
    order.push(key);
  }, []);

  const evictOverflow = useCallback(() => {
    const order = cacheOrderRef.current;
    const limit = cacheLimitRef.current || DEFAULT_AUDIO_CACHE_LIMIT;
    while (order.length > limit) {
      const evictKey = order.shift();
      if (!evictKey) continue;
      const url = audioCacheRef.current.get(evictKey);
      if (url) {
        URL.revokeObjectURL(url);
      }
      audioCacheRef.current.delete(evictKey);
      deletePersistedAudio(evictKey);
    }
  }, []);

  const pruneCache = useCallback((allowedKeys = []) => {
    const allowedSet = new Set(allowedKeys);
    cacheOrderRef.current = cacheOrderRef.current.filter((key) => {
      const keep = allowedSet.size === 0 ? false : allowedSet.has(key);
      if (!keep) {
        const url = audioCacheRef.current.get(key);
        if (url) {
          URL.revokeObjectURL(url);
        }
        audioCacheRef.current.delete(key);
        deletePersistedAudio(key);
      }
      return keep;
    });
    evictOverflow();
  }, [evictOverflow]);

  const setCacheLimit = useCallback((nextLimit) => {
    const bounded = Math.max(
      DEFAULT_AUDIO_CACHE_LIMIT,
      Math.min(
        Math.min(PREFETCH_AUDIO_CACHE_LIMIT, PERSISTED_CACHE_LIMIT),
        nextLimit || DEFAULT_AUDIO_CACHE_LIMIT
      )
    );
    cacheLimitRef.current = bounded;
    evictOverflow();
  }, [evictOverflow]);

  const cancelPrefetches = useCallback((allowedKeys = []) => {
    const allowedSet = new Set(allowedKeys);
    prefetchTasksRef.current.forEach(({ controller }, key) => {
      if (!allowedSet.has(key)) {
        controller.abort();
        prefetchTasksRef.current.delete(key);
      }
    });
  }, []);

  const initCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback((freq, duration = 0.1, type = 'sine') => {
    try {
      const ctx = initCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }, [initCtx]);

  const playTransition = useCallback(() => {
    playTone(523, 0.08);
    setTimeout(() => playTone(659, 0.08), 80);
    setTimeout(() => playTone(784, 0.12), 160);
  }, [playTone]);

  const playHighlight = useCallback((category) => {
    const freqs = { correctness: 440, clarity: 523, engagement: 587, delivery: 659, keyword: 698 };
    playTone(freqs[category] || 523, 0.15, 'triangle');
  }, [playTone]);

  const clearCachedAudio = useCallback((options = {}) => {
    const { flushPersistent = false } = options;
    prefetchTasksRef.current.forEach(({ controller }) => controller.abort());
    prefetchTasksRef.current.clear();
    audioCacheRef.current.forEach((url, key) => {
      URL.revokeObjectURL(url);
      if (flushPersistent) deletePersistedAudio(key);
    });
    audioCacheRef.current.clear();
    cacheOrderRef.current = [];
  }, []);

  const prefetchSpeech = useCallback((text, voice = 'onyx', speed = 1.4) => {
    if (!apiKey || !text?.trim()) return null;

    const key = makeCacheKey(text, voice, speed);
    if (audioCacheRef.current.has(key)) {
      registerCacheUse(key);
      return audioCacheRef.current.get(key);
    }
    if (prefetchTasksRef.current.has(key)) return prefetchTasksRef.current.get(key).promise;

    const controller = new AbortController();

    const promise = (async () => {
      try {
        const persistedBlob = await loadAudioBlob(key);
        if (controller.signal.aborted) return null;

        if (persistedBlob) {
          const persistedUrl = URL.createObjectURL(persistedBlob);
          audioCacheRef.current.set(key, persistedUrl);
          registerCacheUse(key);
          evictOverflow();
          return persistedUrl;
        }

        const { audioUrl, audioBlob } = await generateSpeech(text, apiKey, voice, speed, controller.signal);
        if (controller.signal.aborted) {
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          return null;
        }

        if (audioUrl) {
          audioCacheRef.current.set(key, audioUrl);
          registerCacheUse(key);
          evictOverflow();
          persistAudioBlob(key, audioBlob).catch(() => {});
        }
        return audioUrl;
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('TTS prefetch error:', error);
        }
        return null;
      } finally {
        prefetchTasksRef.current.delete(key);
      }
    })();

    prefetchTasksRef.current.set(key, { controller, promise });
    return promise;
  }, [apiKey, evictOverflow, makeCacheKey, registerCacheUse]);

  const speak = useCallback(async (text, onEnd, voice = 'onyx', speed = 1.4) => {
    if (!apiKey) {
      console.warn('No API key provided for TTS');
      onEnd?.();
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const key = makeCacheKey(text, voice, speed);
    let audioUrl = audioCacheRef.current.get(key);
    let fetchedBlob = null;
    if (audioUrl) {
      registerCacheUse(key);
    }

    setIsLoading(!audioUrl);
    setIsSpeaking(false);

    try {
      if (!audioUrl && prefetchTasksRef.current.has(key)) {
        audioUrl = await prefetchTasksRef.current.get(key).promise;
      }

      if (!audioUrl) {
        const result = await generateSpeech(text, apiKey, voice, speed, abortControllerRef.current.signal);
        audioUrl = result?.audioUrl || null;
        fetchedBlob = result?.audioBlob || null;
      }
      
      if (abortControllerRef.current?.signal.aborted) {
        if (!audioCacheRef.current.has(key) && audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        return;
      }

      if (!audioCacheRef.current.has(key) && audioUrl) {
        audioCacheRef.current.set(key, audioUrl);
        registerCacheUse(key);
        evictOverflow();
        persistAudioBlob(key, fetchedBlob).catch(() => {});
      }

      const audio = new Audio(audioCacheRef.current.get(key));
      audioRef.current = audio;

      audio.onplay = () => {
        setIsLoading(false);
        setIsSpeaking(true);
      };

      const dropFromCache = () => {
        const cachedUrl = audioCacheRef.current.get(key);
        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl);
          audioCacheRef.current.delete(key);
        }
        deletePersistedAudio(key);
        const orderIdx = cacheOrderRef.current.indexOf(key);
        if (orderIdx !== -1) {
          cacheOrderRef.current.splice(orderIdx, 1);
        }
      };

      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
        onEnd?.();
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsLoading(false);
        setIsSpeaking(false);
        dropFromCache();
        audioRef.current = null;
        onEnd?.();
      };

      await audio.play();
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('TTS Error:', error);
      }
      setIsLoading(false);
      setIsSpeaking(false);
      onEnd?.();
    }
  }, [apiKey, evictOverflow, makeCacheKey, registerCacheUse]);

  const stop = useCallback((options = {}) => {
    const { flushCache = false } = options;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    
    if (flushCache) {
      clearCachedAudio({ flushPersistent: true });
    }

    setIsSpeaking(false);
    setIsLoading(false);
  }, [clearCachedAudio]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      cancelPrefetches([]);
    };
  }, [cancelPrefetches]);

  return { 
    playTone, 
    playTransition, 
    playHighlight, 
    speak, 
    prefetchSpeech, 
    cancelPrefetches, 
    pruneCache, 
    setCacheLimit,
    getSpeechKey,
    stop, 
    isSpeaking, 
    isLoading 
  };
};

// ============================================
// SPEECH-TO-TEXT (BROWSER)
// ============================================

const useSpeechToText = () => {
  const recognitionRef = useRef(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        finalText += event.results[i][0].transcript;
      }
      setTranscript(finalText.trim());
    };

    recognition.onerror = (evt) => {
      setError(evt.error || 'Speech recognition error');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsSupported(true);
  }, []);

  const startListening = useCallback(() => {
    setError('');
    if (!recognitionRef.current) return;
    setTranscript('');
    recognitionRef.current.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => setTranscript(''), []);

  return {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript
  };
};

// ============================================
// PRESENTATION SLIDE COMPONENT
// ============================================

const PresentationSlide = ({ 
  change, 
  index, 
  total, 
  score,
  isActive,
  phase,
  cvText
}) => {
  const style = categoryStyles[change.type];
  const script = useMemo(() => generateScript(change, index, total, score), [change, index, total, score]);

  return (
    <div className={`absolute inset-0 transition-all duration-700 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />
      <div className={`absolute -left-32 -top-24 w-72 h-72 rounded-full blur-3xl opacity-30 bg-gradient-to-br ${style.gradient}`} />
      <div className={`absolute -right-24 bottom-0 w-80 h-80 rounded-full blur-3xl opacity-20 bg-gradient-to-br ${style.gradient}`} />

      <div className="relative z-10 h-full w-full flex flex-col justify-between px-8 md:px-12 py-10">
        <div className="flex items-center gap-3 text-white/70">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur">
            <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${style.gradient} animate-pulse`} />
            <span className="text-xs font-semibold tracking-wide">{style.label}</span>
          </div>
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            Scene {index + 1} • CV Upgrade
          </span>
        </div>

        <div className="flex-1 grid md:grid-cols-5 gap-8 items-center">
          <div className="md:col-span-3 space-y-4 text-white">
            {script.narrativeIntro && (
              <p className={`text-sm text-white/60 italic transition-all duration-500 ${phase !== 'intro' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                {script.narrativeIntro}
              </p>
            )}
            <h2 className={`text-3xl sm:text-4xl font-bold leading-tight drop-shadow-xl transition-all duration-500 ${phase !== 'intro' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
              {change.title}
            </h2>
            <p className={`text-lg sm:text-xl text-white/80 leading-relaxed transition-all duration-500 ${['explanation', 'before-after', 'impact'].includes(phase) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
              {change.description}
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 backdrop-blur">
                {Math.round(100 / total)}% lift potential
              </span>
              {script.impact && (
                <span className={`px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 backdrop-blur transition ${phase === 'impact' ? 'opacity-100' : 'opacity-0'}`}>
                  {script.impact}
                </span>
              )}
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 transition-all duration-500 ${['before-after', 'impact'].includes(phase) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="flex items-center justify-between text-xs text-white/70 mb-2">
                <span className="uppercase tracking-[0.2em]">Before</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${style.gradient}`} />
                  <span className="text-white/50">needs polish</span>
                </div>
              </div>
              <div className="text-base text-white/80 line-through decoration-white/40">
                {change.original}
              </div>
            </div>

            <div className={`rounded-2xl border border-emerald-200/30 bg-emerald-500/10 backdrop-blur p-4 shadow-[0_10px_40px_rgba(16,185,129,0.18)] transition-all duration-500 ${phase === 'impact' ? 'opacity-100 translate-y-0 scale-[1.01]' : 'opacity-0 translate-y-4 scale-95'}`}>
              <div className="flex items-center justify-between text-xs text-white mb-2">
                <span className="uppercase tracking-[0.2em] text-emerald-100">After</span>
                <span className="text-emerald-100 font-semibold">Sharper delivery</span>
              </div>
              <div className="text-base sm:text-lg text-white font-semibold">
                {change.replacement}
              </div>
            </div>
          </div>
        </div>

        <div className={`flex items-center gap-3 text-white/70 transition-all duration-500 ${phase === 'impact' ? 'opacity-100' : 'opacity-0 translate-y-2'}`}>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold">Feels better already</span>
          </div>
          <div className="h-px w-16 bg-white/10" />
          <span className="text-xs uppercase tracking-[0.28em] text-white/40">Rolling</span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// INTRO SLIDE
// ============================================

const IntroSlide = ({ 
  isActive, 
  score, 
  totalChanges, 
  onStart,
  onViewRecommendations,
  isCinematic = true
}) => {
  const baseWrapper = `absolute inset-0 flex items-center justify-center transition-all duration-700 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;
  const playButtonClass = isCinematic
    ? 'px-7 py-4 bg-white text-slate-900 font-bold text-lg rounded-full shadow-xl shadow-emerald-500/30 transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-200 flex items-center gap-3'
    : 'px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-lg rounded-2xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 flex items-center gap-3 mx-auto';
  const skipButtonClass = isCinematic
    ? 'px-7 py-4 bg-white/5 text-white font-semibold text-lg rounded-full border border-white/10 hover:border-white/30 transition-all hover:-translate-y-0.5'
    : 'px-8 py-4 bg-white border border-emerald-200 hover:border-emerald-300 text-emerald-800 font-semibold text-lg rounded-2xl shadow-lg shadow-emerald-50 transition-all hover:-translate-y-0.5';

  return (
    <div className={`${baseWrapper} ${isCinematic ? 'bg-gradient-to-br from-black/70 via-slate-950 to-black' : 'bg-white'}`}>
      {isCinematic && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.2),transparent_35%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.2),transparent_32%)] opacity-70" />
        </>
      )}
      <div className={`relative text-center max-w-2xl px-8 ${isCinematic ? 'text-white' : 'text-slate-900'}`}>
        <div className={`mb-8 inline-flex items-center gap-3 px-4 py-2 rounded-full ${isCinematic ? 'bg-white/5 border border-white/10 backdrop-blur' : 'bg-emerald-50 border border-emerald-100'}`}>
          <div className={`h-9 w-9 rounded-full ${isCinematic ? 'bg-red-600 shadow-lg shadow-red-500/30 text-white' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'} flex items-center justify-center`}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
          <div className="text-left">
            <div className={`text-xs uppercase tracking-[0.24em] ${isCinematic ? 'text-white/60' : 'text-emerald-700'}`}>Instant walkthrough</div>
            <div className={`text-sm font-semibold ${isCinematic ? 'text-white' : 'text-slate-900'}`}>Press play to watch like a video</div>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${isCinematic ? 'bg-white/10 border border-white/10' : 'bg-white border border-emerald-100 text-emerald-700'}`}>
            {totalChanges} scenes
          </span>
        </div>

        <h1 className={`text-3xl sm:text-4xl font-bold mb-4 ${isCinematic ? 'drop-shadow' : ''}`}>
          Your CV breakdown is ready to stream
        </h1>
        <p className={`text-lg ${isCinematic ? 'text-white/80' : 'text-slate-600'} mb-10`}>
          I found <span className={`${isCinematic ? 'text-white' : 'text-emerald-700'} font-semibold`}>{totalChanges} key moments</span> that can lift your match score from <span className={`${isCinematic ? 'text-amber-300' : 'text-amber-600'} font-semibold`}>{score}%</span> to about <span className={`${isCinematic ? 'text-emerald-300' : 'text-emerald-700'} font-semibold`}>{Math.min(95, score + 40)}%</span>. Sit back—just hit play.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onStart}
            className={playButtonClass}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            {isCinematic ? 'Play walkthrough' : 'Start walkthrough'}
          </button>
          <button
            onClick={onViewRecommendations}
            className={skipButtonClass}
          >
            Skip to summary
          </button>
        </div>

        <p className={`${isCinematic ? 'text-white/60' : 'text-slate-500'} text-sm mt-4`}>
          Feels like a video—no steps to click through, just watch.
        </p>
      </div>
    </div>
  );
};

// ============================================
// CHATGPT-STYLE OUTRO SLIDE
// ============================================

const OutroSlide = ({ 
  isActive, 
  score, 
  newScore, 
  totalChanges, 
  onRestart, 
  onBack,
  onReplay,
  improvedCV,
  keywordSnapshot,
  onApplyAll,
  editorRef,
  editorValue,
  onEditorChange,
  changes,
  manualChanges = [],
  decisions,
  onDecisionChange,
  onSendUserRequest,
  isRequestingUserChange,
  userRequestError,
  onClearUserRequestError
}) => {
  const [message, setMessage] = useState('');
  const [showKeywords, setShowKeywords] = useState(false);
  const { isSupported, isListening, transcript, error: voiceError, startListening, stopListening, resetTranscript } = useSpeechToText();
  const combinedChanges = useMemo(() => [...changes, ...manualChanges], [changes, manualChanges]);

  useEffect(() => {
    if (isListening) {
      setMessage(transcript);
    }
  }, [isListening, transcript]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text) return;
    
    try {
      await onSendUserRequest?.(text);
      setMessage('');
      resetTranscript();
    } catch (err) {
      // Error is handled by parent
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListening = () => {
    if (!isSupported) return;
    if (isListening) stopListening();
    else {
      resetTranscript();
      setMessage('');
      startListening();
    }
  };

  if (!isActive) return null;

  const totalKeywords = keywordSnapshot?.total || 0;
  const missingAfter = keywordSnapshot?.after || 0;
  const missingAfterList = keywordSnapshot?.missingAfterList || [];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Compact Top Header - Fixed */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white shadow-sm">
        <div className="w-full px-3 py-2 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onReplay}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition"
              title="Rewatch the walkthrough"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 5V2L7 7l5 5V9c2.757 0 5 2.243 5 5a5 5 0 11-8.66-3.11l-1.42-1.42A7 7 0 1012 5z" />
              </svg>
              Play Walkthrough
            </button>
            {missingAfterList.length > 0 && (
              <button
                onClick={() => setShowKeywords(!showKeywords)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition"
              >
                <span className="font-medium">{missingAfterList.length} missing keywords</span>
                <svg className={`w-3 h-3 transition-transform ${showKeywords ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            <div className="text-xs text-gray-500">
              Keywords: <span className="font-semibold text-gray-900">{totalKeywords - missingAfter}/{totalKeywords}</span>
            </div>
            <button
              onClick={onApplyAll}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition"
            >
              Accept all
            </button>
          </div>
        </div>
        
        {/* Collapsible Keyword Banner */}
        {showKeywords && missingAfterList.length > 0 && (
          <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
            <div className="flex flex-wrap gap-1.5">
              {missingAfterList.map((kw) => (
                <span key={kw} className="px-2 py-0.5 bg-white border border-amber-200 text-amber-800 rounded text-xs">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - Maximum Space for Editor */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="h-full">
          {/* Full-Width Text Editor */}
          <CorrectionEditor
            value={editorValue ?? improvedCV ?? ''}
            onChange={(next) => onEditorChange?.(next)}
            editorRef={editorRef}
            changes={combinedChanges}
            decisions={decisions}
            onDecisionChange={onDecisionChange}
          />
        </div>
      </div>

      {/* Floating Bottom Input Bar - ChatGPT Style */}
      <div className="flex-shrink-0">
        <div className="w-full px-4 pb-4 pt-2 bg-white">
          <div className="max-w-3xl mx-auto">
            {/* Floating Input Container */}
            <div className="relative bg-white border border-gray-300 rounded-2xl shadow-xl hover:shadow-2xl transition-shadow">
              <div className="flex items-end gap-2 p-2">
                <div className="flex-1 min-h-[44px] flex items-center">
                  <textarea
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      onClearUserRequestError?.();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Request changes..."
                    className="w-full px-3 py-2 bg-transparent text-[15px] text-gray-900 placeholder-gray-400 outline-none resize-none"
                    rows={1}
                    style={{ 
                      minHeight: '24px', 
                      maxHeight: '200px',
                      lineHeight: '24px'
                    }}
                  />
                </div>

                {/* Action Buttons Group */}
                <div className="flex items-center gap-1">
                  {/* Voice Button */}
                  {isSupported && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                        isListening
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'hover:bg-gray-100 text-gray-500'
                      }`}
                      title={isListening ? 'Stop' : 'Voice'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                  )}

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isRequestingUserChange || !message.trim()}
                    className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                      message.trim() && !isRequestingUserChange
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Send"
                  >
                    {isRequestingUserChange ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Status Messages - Inside the floating container */}
              {(isListening || userRequestError || voiceError) && (
                <div className="px-4 pb-2 pt-0">
                  {isListening && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Listening...
                    </div>
                  )}
                  
                  {(userRequestError || voiceError) && !isListening && (
                    <div className="text-xs text-red-600">
                      {userRequestError || voiceError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Optional: Hint text below */}
            <div className="mt-2 text-center text-xs text-gray-400">
              Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">Enter</kbd> to send
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// VOICE SELECTOR COMPONENT
// ============================================

const VoiceSelector = ({ selectedVoice, onVoiceChange }) => {
  const voices = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral & balanced' },
    { id: 'echo', name: 'Echo', description: 'Warm & conversational' },
    { id: 'fable', name: 'Fable', description: 'Expressive & British' },
    { id: 'onyx', name: 'Onyx', description: 'Deep & authoritative' },
    { id: 'nova', name: 'Nova', description: 'Friendly & upbeat' },
    { id: 'shimmer', name: 'Shimmer', description: 'Clear & pleasant' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {voices.map((voice) => (
        <button
          key={voice.id}
          onClick={() => onVoiceChange(voice.id)}
          className={`px-3 py-2 rounded-lg text-sm transition-all border ${
            selectedVoice === voice.id
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-200 hover:text-emerald-700'
          }`}
          title={voice.description}
        >
          {voice.name}
        </button>
      ))}
    </div>
  );
};

// ============================================
// PROMPT/RESPONSE LOG CONSOLE
// ============================================

const LogConsole = ({ logs, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getStageLabel = (stage) => {
    if (stage === 'analysis') return 'CV Analysis';
    if (stage === 'keywords') return 'Keyword Extraction';
    if (stage === 'story') return 'Narrative Intros';
    if (stage === 'user-request') return 'User Request';
    return 'Log';
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 text-slate-900">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-lg shadow-emerald-50 flex items-center gap-2 hover:border-emerald-300 transition"
      >
        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
        </svg>
        <span className="text-sm font-semibold">Prompt Log</span>
        {logs.length > 0 && (
          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-emerald-800 bg-emerald-100 rounded-full">
            {logs.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-3 w-[90vw] sm:w-[480px] max-h-[70vh] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div>
              <div className="text-sm font-semibold">Prompt & Raw Response Log</div>
              <div className="text-xs text-slate-500">
                Captures the exact prompts sent to the model and the raw replies returned.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClear}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700"
                aria-label="Close log console"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh] bg-white">
            {logs.length === 0 ? (
              <div className="text-sm text-slate-500">No prompts captured yet. Run an analysis to populate the log.</div>
            ) : (
              [...logs].reverse().map((log) => (
                <div key={log.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        log.stage === 'analysis'
                          ? 'bg-emerald-100 text-emerald-700'
                          : log.stage === 'keywords'
                            ? 'bg-amber-100 text-amber-700'
                            : log.stage === 'user-request'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-700'
                      }`}>
                        {getStageLabel(log.stage)}
                      </span>
                      <span className="text-slate-500">
                        {log.provider}{log.model ? ` • ${log.model}` : ''}
                        {log.status === 'error' && ' • error'}
                      </span>
                    </div>
                    <span className="text-slate-400">
                      {new Date(log.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] uppercase font-semibold text-slate-500">Prompt</div>
                  <pre className="mt-1 bg-white border border-slate-200 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-words max-h-32 overflow-auto">
                    {log.prompt || '—'}
                  </pre>

                  <div className="mt-3 text-[11px] uppercase font-semibold text-slate-500">Raw Response</div>
                  <pre className="mt-1 bg-white border border-slate-200 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-words max-h-32 overflow-auto">
                    {log.response || '—'}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// KEYWORD REVIEW MODAL
// ============================================

const KeywordReviewModal = ({
  open,
  keywords = [],
  jobDescription = '',
  cvText = '',
  onClose,
  onConfirm,
  onKeywordsChange,
  isSubmitting = false
}) => {
  const [draftKeyword, setDraftKeyword] = useState('');

  const validated = useMemo(
    () => validateKeywords(keywords, jobDescription, cvText),
    [keywords, jobDescription, cvText]
  );

  const keywordsInJob = validated.filter((k) => k.inJobDescription).map((k) => k.keyword);
  const keywordsInCV = validated.filter((k) => k.inCV).map((k) => k.keyword);
  const missingInCV = validated.filter((k) => k.inJobDescription && !k.inCV).map((k) => k.keyword);
  const notInJob = validated.filter((k) => !k.inJobDescription).map((k) => k.keyword);

  if (!open) return null;

  const handleAddKeyword = () => {
    const candidate = draftKeyword.trim();
    if (!candidate) return;
    const exists = keywords.some((kw) => kw.toLowerCase() === candidate.toLowerCase());
    if (exists) {
      setDraftKeyword('');
      return;
    }
    onKeywordsChange?.([...keywords, candidate]);
    setDraftKeyword('');
  };

  const handleRemoveKeyword = (keyword) => {
    onKeywordsChange?.(keywords.filter((kw) => kw !== keyword));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500">Step 1 · Validate keywords</div>
            <div className="text-lg font-bold text-slate-900">Confirm the terms we'll optimize for</div>
            <p className="text-sm text-slate-600">
              Add missing terms from the job post or remove any noise before we draft your personalized changes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition"
            aria-label="Close keyword review"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/70">
              <div className="text-xs uppercase font-semibold text-emerald-700">Total keywords</div>
              <div className="text-2xl font-bold text-emerald-900 mt-1">{validated.length}</div>
              <div className="text-xs text-emerald-700 mt-1">Pulled from the job description</div>
            </div>
            <div className="p-4 rounded-2xl border border-sky-100 bg-sky-50/70">
              <div className="text-xs uppercase font-semibold text-sky-700">Already in your CV</div>
              <div className="text-2xl font-bold text-sky-900 mt-1">{keywordsInCV.length}</div>
              <div className="text-xs text-sky-700 mt-1">These are covered</div>
            </div>
            <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50/70">
              <div className="text-xs uppercase font-semibold text-amber-700">Missing from CV</div>
              <div className="text-2xl font-bold text-amber-900 mt-1">{missingInCV.length}</div>
              <div className="text-xs text-amber-700 mt-1">We'll prioritize these</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Add or edit keywords</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={draftKeyword}
                onChange={(e) => setDraftKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add an important keyword from the job post"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
              />
              <button
                onClick={handleAddKeyword}
                disabled={!draftKeyword.trim()}
                className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none transition"
              >
                Add keyword
              </button>
            </div>
            {notInJob.length > 0 && (
              <p className="text-xs text-amber-700 mt-2">
                {notInJob.length} term{notInJob.length === 1 ? '' : 's'} aren't in the job description; they'll be deprioritized.
              </p>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto p-4 rounded-2xl border border-slate-200 bg-white">
            {validated.length === 0 ? (
              <div className="text-sm text-slate-600">No keywords yet. Add the most important terms from the job post.</div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {validated.map((kw) => (
                  <div
                    key={kw.keyword}
                    className="flex items-start gap-3 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 shadow-sm min-w-[240px]"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900 break-words">{kw.keyword}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                        <span className={`px-2 py-0.5 rounded-lg border ${kw.inJobDescription ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                          {kw.inJobDescription ? 'In job post' : 'Not in job post'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg border ${kw.inCV ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                          {kw.inCV ? 'Already in CV' : 'Missing in CV'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveKeyword(kw.keyword)}
                      className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 transition"
                      aria-label={`Remove ${kw.keyword}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500">
              We'll use only the confirmed keywords to align your CV with the job description.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:border-slate-400 transition"
              >
                Back
              </button>
              <button
                onClick={() => onConfirm?.(validated.map((k) => k.keyword))}
                disabled={isSubmitting || validated.length === 0}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-200 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 transition"
              >
                Continue with these keywords
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================================
// CORRECTION EDITOR COMPONENT
// ============================================

const CorrectionEditor = ({
  value = '',
  onChange,
  editorRef,
  changes = [],
  decisions = {},
  onDecisionChange
}) => {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const spanRefs = useRef(new Map());
  const internalEditorRef = useRef(null);
  const resolvedEditorRef = editorRef || internalEditorRef;
  const [activeChangeId, setActiveChangeId] = useState(null);
  const { refs, floatingStyles, update } = useFloating({
    placement: 'bottom-start',
    middleware: [
      offset(8),
      flip({ padding: 12 }),
      shift({ padding: 12 })
    ],
    whileElementsMounted: autoUpdate
  });

  const safeValue = typeof value === 'string' ? value : '';

  const segments = useMemo(() => {
    if (!Array.isArray(changes) || changes.length === 0 || !safeValue) return [];

    const collected = [];
    const seenRanges = new Set();

    changes.forEach((change) => {
      const decision = decisions[change.id] || 'pending';
       const isResolved = decision === 'accepted' || decision === 'rejected' || decision === 'skipped';
       if (isResolved) return;
      const useReplacement = decision !== 'rejected' && decision !== 'skipped';
      const candidates = [];
      const replacementText = typeof change.replacement === 'string' ? change.replacement : '';
      const originalText = typeof change.original === 'string' ? change.original : '';

      if (useReplacement && replacementText) candidates.push(replacementText);
      if (originalText) candidates.push(originalText);
      if (!useReplacement && replacementText) candidates.push(replacementText);

      let matchIndex = -1;
      let matchedText = '';

      for (const candidate of candidates) {
        if (!candidate) continue;
        const preferredStart = typeof change.startIndex === 'number'
          ? safeValue.indexOf(candidate, Math.max(0, Math.min(change.startIndex, Math.max(safeValue.length - 1, 0))))
          : -1;
        const idx = preferredStart !== -1 ? preferredStart : safeValue.indexOf(candidate);
        if (idx !== -1) {
          matchIndex = idx;
          matchedText = candidate;
          break;
        }
      }

      if (matchIndex === -1 && typeof change.startIndex === 'number') {
        matchIndex = Math.max(0, Math.min(change.startIndex, Math.max(safeValue.length - 1, 0)));
        matchedText = replacementText || originalText || safeValue.slice(matchIndex, matchIndex + 1);
      }

      const endIndex = matchIndex + matchedText.length;
      if (matchIndex < 0 || endIndex <= matchIndex) return;

      const rangeKey = `${matchIndex}-${endIndex}`;
      if (seenRanges.has(rangeKey)) return;
      seenRanges.add(rangeKey);

      collected.push({
        start: matchIndex,
        end: endIndex,
        change,
        matchedText
      });
    });

    return collected
      .filter((seg) => seg.start >= 0 && seg.end > seg.start)
      .sort((a, b) => a.start - b.start || b.end - a.end);
  }, [changes, decisions, safeValue]);

  const registerSpan = useCallback((id, node) => {
    if (!spanRefs.current) return;
    if (node) {
      spanRefs.current.set(id, node);
      if (id === activeChangeId) {
        refs.setReference(node);
        requestAnimationFrame(() => update?.());
      }
    } else {
      spanRefs.current.delete(id);
    }
  }, [activeChangeId, refs, update]);

  useEffect(() => {
    if (!activeChangeId) {
      refs.setReference(null);
      return;
    }
    const node = spanRefs.current.get(activeChangeId);
    refs.setReference(node || null);
    if (node) {
      requestAnimationFrame(() => update?.());
    }
  }, [activeChangeId, refs, segments, update]);

  useEffect(() => {
    // Close any open popover when a fresh set of recommendations is loaded
    setActiveChangeId(null);
    refs.setReference(null);
    requestAnimationFrame(() => update?.());
  }, [changes, refs, update]);

  useEffect(() => {
    if (!activeChangeId) return;
    const decision = decisions[activeChangeId];
    const changeStillExists = Array.isArray(changes) && changes.some((c) => c.id === activeChangeId);
    const resolved = decision && decision !== 'pending';
    if (!changeStillExists || resolved) {
      setActiveChangeId(null);
      refs.setReference(null);
      requestAnimationFrame(() => update?.());
    }
  }, [activeChangeId, changes, decisions, refs, update]);

  useEffect(() => {
    const handleResize = () => update?.();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [update]);

  const syncScroll = useCallback(() => {
    if (!overlayRef.current || !resolvedEditorRef?.current) return;
    overlayRef.current.scrollTop = resolvedEditorRef.current.scrollTop;
    overlayRef.current.scrollLeft = resolvedEditorRef.current.scrollLeft;
    if (activeChangeId) update?.();
  }, [activeChangeId, resolvedEditorRef, update]);

  const handleCursorSelection = useCallback((event) => {
    const pos = typeof event?.target?.selectionStart === 'number' ? event.target.selectionStart : 0;
    const match = segments.find((seg) => pos >= seg.start && pos <= seg.end);
    if (!match) {
      setActiveChangeId(null);
      refs.setReference(null);
      requestAnimationFrame(() => update?.());
    }
  }, [refs, segments, update]);

  useEffect(() => {
    syncScroll();
  }, [safeValue, segments, syncScroll]);

  const renderedSegments = useMemo(() => {
    const output = [];
    let cursor = 0;
    const contentLength = safeValue.length;

    const markerColorByType = {
      correctness: '#17B26A',
      clarity: '#2DB2D3',
      engagement: '#7C7CF2',
      delivery: '#F6A83F',
      keyword: '#18B981'
    };

    const decisionClass = {
      accepted: 'bg-emerald-600 text-white ring-emerald-200',
      rejected: 'bg-rose-500 text-white ring-rose-200',
      pending: 'bg-white text-slate-700 ring-slate-200',
      skipped: 'bg-white text-slate-500 ring-slate-200'
    };

    segments.forEach((seg, idx) => {
      const segStart = Math.max(0, Math.min(seg.start, contentLength));
      const segEnd = Math.max(segStart, Math.min(seg.end, contentLength));
      if (segStart > cursor) {
        output.push(safeValue.slice(cursor, segStart));
      }

      const renderStart = Math.max(segStart, cursor);
      const renderEnd = Math.max(renderStart, segEnd);
      if (renderEnd <= renderStart) {
        cursor = Math.max(cursor, segEnd);
        return;
      }

      const decision = decisions[seg.change.id] || 'pending';
      const accentColor = markerColorByType[seg.change.type] || markerColorByType.clarity;
      const decisionStyles = decisionClass[decision] || decisionClass.pending;
      const selectionStart = segStart;
      const selectionEnd = segEnd;

      output.push(
        <span
          key={`${seg.change.id}-${idx}`}
          className="relative inline-block align-baseline pointer-events-auto"
        >
          <span className="invisible select-none">{safeValue.slice(renderStart, renderEnd)}</span>
          <button
            type="button"
            ref={(node) => registerSpan(seg.change.id, node)}
            className={`absolute right-0 translate-x-[8px] -top-2 inline-flex items-center justify-center w-5 h-5 rounded-full border border-white/60 shadow-sm text-[10px] font-bold transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-emerald-300 ${decisionStyles}`}
            style={{ backgroundColor: decision === 'pending' ? accentColor : undefined, color: decision === 'pending' ? '#fff' : undefined }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              setActiveChangeId(seg.change.id);
              refs.setReference(e.currentTarget);
              if (resolvedEditorRef?.current) {
                resolvedEditorRef.current.focus();
                resolvedEditorRef.current.setSelectionRange(selectionStart, selectionEnd);
              }
              requestAnimationFrame(() => update?.());
            }}
            title={seg.change.title || 'Correction'}
            aria-label={`View recommendation: ${seg.change.title || 'Correction'}`}
          >
            +
          </button>
        </span>
      );

      cursor = Math.max(cursor, segEnd);
    });

    if (cursor < contentLength) {
      output.push(safeValue.slice(cursor));
    }

    return output;
  }, [decisions, registerSpan, refs, resolvedEditorRef, safeValue, segments, update]);

  const activeChange = activeChangeId
    ? changes.find((c) => c.id === activeChangeId)
    : null;
  const activeDecision = activeChange ? (decisions[activeChange.id] || 'pending') : 'pending';
  const activeStyle = activeChange ? (categoryStyles[activeChange.type] || categoryStyles.clarity) : null;
  const showPopover = !!(activeChange && refs.reference?.current);

  const handleDecisionClick = useCallback((decision) => {
    if (!activeChange) return;
    const changeId = activeChange.id;
    onDecisionChange?.(changeId, decision);
    setActiveChangeId(null);
    refs.setReference(null);
    requestAnimationFrame(() => update?.());
  }, [activeChange, onDecisionChange, refs, update]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative" ref={containerRef}>
        <div
          ref={overlayRef}
          className="absolute inset-0 overflow-auto pointer-events-none z-10"
          aria-hidden="true"
        >
          <pre className="h-full w-full p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-transparent">
            {renderedSegments}
          </pre>
        </div>
        <textarea
          ref={resolvedEditorRef}
          value={safeValue}
          onChange={(e) => onChange?.(e.target.value)}
          onScroll={syncScroll}
          onClick={handleCursorSelection}
          onKeyUp={handleCursorSelection}
          onSelect={handleCursorSelection}
          spellCheck="false"
          className="w-full h-full bg-white border-0 p-4 overflow-auto text-[13px] text-gray-800 font-mono leading-relaxed focus:outline-none resize-none cv-editor-highlight relative"
          placeholder="Your improved CV will appear here after applying the changes."
        />
        {showPopover && (
          <div
            ref={refs.setFloating}
            className="absolute z-20 rounded-xl border border-gray-200 bg-white shadow-2xl"
            style={{
              ...floatingStyles,
              minWidth: '320px',
              maxWidth: '420px'
            }}
          >
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border bg-white"
                    style={{
                      color: activeStyle?.text || '#334155',
                      borderColor: activeStyle?.bar || '#e2e8f0'
                    }}
                  >
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${activeStyle?.gradient || 'from-emerald-400 to-green-500'}`} />
                    {activeStyle?.label || 'Correction'}
                  </span>
                  <span className="text-[11px] px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 capitalize text-gray-700">
                    {activeDecision}
                  </span>
                </div>
                <div className="text-sm font-semibold text-gray-900">{activeChange.title}</div>
                <p className="text-xs text-gray-600">{activeChange.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-100 break-words">
                  <div className="text-[10px] uppercase font-semibold text-rose-700 mb-1">Original</div>
                  <div className="text-rose-800 text-[11px]">{activeChange.original}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 break-words">
                  <div className="text-[10px] uppercase font-semibold text-emerald-700 mb-1">Replacement</div>
                  <div className="text-emerald-900 font-medium text-[11px]">{activeChange.replacement}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDecisionClick('accepted')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeDecision === 'accepted'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => handleDecisionClick('rejected')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeDecision === 'rejected'
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


// ============================================
// MAIN PRESENTATION COMPONENT
// ============================================

const PREFETCH_SLIDE_AHEAD = 3;
const PRESENTATION_SPEECH_SPEED = 1.0;
const PRESENTATION_TIMING = {
  introToHighlight: 200,
  highlightToBeforeAfter: 400,
  beforeAfterToAudio: 200
};

const Presentation = ({ 
  cvText, 
  changes, 
  score, 
  onBack, 
  apiKey, 
  selectedVoice, 
  improvedCV, 
  keywordSnapshot,
  manualChanges = [],
  decisions,
  onDecisionChange,
  editorValue,
  onEditorChange,
  onApplyAll,
  onUserRequest,
  isUserRequesting,
  userRequestError,
  onClearUserRequestError
}) => {
  const [currentSlide, setCurrentSlide] = useState(() => changes.length);
  const [phase, setPhase] = useState('intro');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCinematic, setIsCinematic] = useState(false);
  const handleCloseOverlay = () => {
    clearTimeouts();
    stop();
    setIsPlaying(false);
    setIsCinematic(false);
    setPhase('intro');
    setCurrentSlide(changes.length); // drop to summary instead of bouncing to first page
  };
  
  const { playTransition, playHighlight, speak, prefetchSpeech, cancelPrefetches, pruneCache, setCacheLimit, getSpeechKey, stop, isSpeaking, isLoading } = useAudioSystem(apiKey);
  const timeoutRef = useRef(null);
  const editorRef = useRef(null);
  const playerRef = useRef(null);
  const timelineRef = useRef(null);
  const prevChangeCountRef = useRef(changes.length);

  const newScore = Math.min(95, score + Math.round(changes.length * 5));
  const isOutro = currentSlide === changes.length;

  const activeTitle = currentSlide >= 0 && currentSlide < changes.length
    ? changes[currentSlide]?.title
    : 'Personalized walkthrough';

  const phaseProgress = phase === 'highlight' ? 0.2 : phase === 'before-after' ? 0.55 : phase === 'impact' ? 0.9 : 0.05;
  const timelineProgress = changes.length
    ? Math.min(1, Math.max(0, (Math.max(currentSlide, 0) + phaseProgress) / changes.length))
    : 0;

  const ESTIMATED_SECONDS_PER_SCENE = 9;
  const timelineDuration = Math.max(ESTIMATED_SECONDS_PER_SCENE * Math.max(changes.length, 1), ESTIMATED_SECONDS_PER_SCENE);
  const elapsedSeconds = timelineDuration * timelineProgress;

  const formatTime = useCallback((seconds) => {
    const total = Math.max(0, Math.round(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const buildSpeechPlan = useCallback(() => {
    if (!changes.length) return [];
    const unique = new Map();

    changes.forEach((change, idx) => {
      const script = generateScript(change, idx, changes.length, score);
      if (!script) return;

      const segments = [
        ['intro', script.narrativeIntro],
        ['main', script.mainExplanation || script.description || change.description],
        ['impact', script.impact]
      ];

      segments.forEach(([slot, text]) => {
        const trimmed = (text || '').trim();
        if (!trimmed) return;
        const key = getSpeechKey(trimmed, selectedVoice, PRESENTATION_SPEECH_SPEED);
        if (!unique.has(key)) {
          unique.set(key, { key, text: trimmed, slot, slideIndex: idx });
        }
      });
    });

    return Array.from(unique.values());
  }, [changes, getSpeechKey, score, selectedVoice]);

  const clearTimeouts = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  useEffect(() => {
    let cancelled = false;

    if (!changes.length || !apiKey) {
      pruneCache([]);
      cancelPrefetches([]);
      setCacheLimit(DEFAULT_AUDIO_CACHE_LIMIT);
      return undefined;
    }

    const plan = buildSpeechPlan();
    if (!plan.length) return undefined;

    const planKeys = plan.map((item) => item.key);
    const desiredLimit = Math.max(
      DEFAULT_AUDIO_CACHE_LIMIT,
      Math.min(PREFETCH_AUDIO_CACHE_LIMIT, planKeys.length + 4)
    );

    setCacheLimit(desiredLimit);
    pruneCache(planKeys);
    cancelPrefetches(planKeys);

    const prefetchAllSlides = async () => {
      for (const item of plan) {
        if (cancelled) break;
        try {
          await prefetchSpeech(item.text, selectedVoice, PRESENTATION_SPEECH_SPEED);
        } catch (err) {
          if (err?.name !== 'AbortError') {
            console.warn('Warmup prefetch failed', err);
          }
        }
      }
    };

    prefetchAllSlides();

    return () => {
      cancelled = true;
    };
  }, [apiKey, buildSpeechPlan, cancelPrefetches, changes.length, prefetchSpeech, pruneCache, selectedVoice, setCacheLimit]);

  useEffect(() => {
    const prev = prevChangeCountRef.current;
    if (currentSlide >= prev && changes.length > prev) {
      setCurrentSlide(changes.length);
      setPhase('intro');
    }
    prevChangeCountRef.current = changes.length;
  }, [changes.length, currentSlide]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const refreshPrefetchWindow = useCallback((anchorIndex) => {
    if (!changes.length) {
      cancelPrefetches([]);
      pruneCache([]);
      return;
    }

    if (!audioEnabled) {
      return;
    }

    if (anchorIndex >= changes.length) {
      return;
    }

    const startIndex = Math.max(0, anchorIndex < 0 ? 0 : anchorIndex);
    const endIndex = Math.min(changes.length - 1, startIndex + PREFETCH_SLIDE_AHEAD);

    for (let idx = startIndex; idx <= endIndex; idx += 1) {
      const script = generateScript(changes[idx], idx, changes.length, score);
      if (!script) continue;

      if (script.narrativeIntro?.trim()) {
        prefetchSpeech(script.narrativeIntro, selectedVoice, PRESENTATION_SPEECH_SPEED);
      }

      if (script.mainExplanation?.trim()) {
        prefetchSpeech(script.mainExplanation, selectedVoice, PRESENTATION_SPEECH_SPEED);
      }

      if (script.impact?.trim()) {
        prefetchSpeech(script.impact, selectedVoice, PRESENTATION_SPEECH_SPEED);
      }
    }
  }, [audioEnabled, cancelPrefetches, changes, prefetchSpeech, pruneCache, score, selectedVoice]);

  useEffect(() => {
    refreshPrefetchWindow(currentSlide);
  }, [currentSlide, refreshPrefetchWindow]);

  const runSlideSequence = useCallback((slideIndex) => {
    if (slideIndex < 0 || slideIndex >= changes.length) return;
    
    const change = changes[slideIndex];
    const script = generateScript(change, slideIndex, changes.length, score);
    const nextChange = changes[slideIndex + 1];
    const nextScript = nextChange ? generateScript(nextChange, slideIndex + 1, changes.length, score) : null;
    
    // Phase 1: Show the slide intro immediately
    setPhase('intro');
    
    timeoutRef.current = setTimeout(() => {
      // Phase 2: Show the highlight/modification visually first
      setPhase('highlight');
      //playHighlight(change.type);
      
      // Phase 3: Show before-after comparison visually
      timeoutRef.current = setTimeout(() => {
        setPhase('before-after');
        // Start pulling down audio while the visuals are animating
        if (audioEnabled) {
          if (script.narrativeIntro?.trim()) {
            prefetchSpeech(script.narrativeIntro, selectedVoice, PRESENTATION_SPEECH_SPEED);
          }
          prefetchSpeech(script.mainExplanation, selectedVoice, PRESENTATION_SPEECH_SPEED);
        }
        
        // Phase 4: After visual elements are shown, START audio narration
        timeoutRef.current = setTimeout(() => {
          if (audioEnabled) {
            const moveToNextSlide = () => {
              if (isPlaying && slideIndex < changes.length - 1) {
                timeoutRef.current = setTimeout(() => {
                  setCurrentSlide(slideIndex + 1);
                }, 1500);
              } else if (slideIndex === changes.length - 1) {
                timeoutRef.current = setTimeout(() => {
                  setCurrentSlide(changes.length);
                  setIsPlaying(false);
                }, 2000);
              }
            };

            const handleImpact = () => {
              setPhase('impact');
              if (nextScript?.narrativeIntro?.trim()) {
                prefetchSpeech(nextScript.narrativeIntro, selectedVoice, PRESENTATION_SPEECH_SPEED);
              }
              if (nextScript?.mainExplanation?.trim()) {
                prefetchSpeech(nextScript.mainExplanation, selectedVoice, PRESENTATION_SPEECH_SPEED);
              }

              if (script.impact?.trim()) {
                speak(script.impact, moveToNextSlide, selectedVoice, PRESENTATION_SPEECH_SPEED);
              } else {
                moveToNextSlide();
              }
            };

            const handleMain = () => {
              prefetchSpeech(script.impact, selectedVoice, PRESENTATION_SPEECH_SPEED);
              if (script.mainExplanation?.trim()) {
                speak(script.mainExplanation, () => {
                  handleImpact();
                }, selectedVoice, PRESENTATION_SPEECH_SPEED);
              } else {
                handleImpact();
              }
            };

            if (script.narrativeIntro?.trim()) {
              speak(script.narrativeIntro, () => {
                handleMain();
              }, selectedVoice, PRESENTATION_SPEECH_SPEED);
            } else {
              handleMain();
            }
          } else {
            // No audio: just progress through phases with timers
            timeoutRef.current = setTimeout(() => {
              setPhase('impact');
              if (isPlaying && slideIndex < changes.length - 1) {
                timeoutRef.current = setTimeout(() => setCurrentSlide(slideIndex + 1), 3000);
              } else if (slideIndex === changes.length - 1) {
                timeoutRef.current = setTimeout(() => {
                  setCurrentSlide(changes.length);
                  setIsPlaying(false);
                }, 3000);
              }
            }, 3000);
          }
        }, PRESENTATION_TIMING.beforeAfterToAudio); // Small pause after before-after, then start audio
        
      }, PRESENTATION_TIMING.highlightToBeforeAfter); // Brief pause to show highlight before before-after
      
    }, PRESENTATION_TIMING.introToHighlight); // Quick ramp from intro into highlight
    
  }, [changes, score, audioEnabled, isPlaying, playHighlight, speak, prefetchSpeech, selectedVoice]);

  useEffect(() => {
    if (currentSlide >= 0 && currentSlide < changes.length) {
      runSlideSequence(currentSlide);
    }
    return clearTimeouts;
  }, [currentSlide, runSlideSequence]);

  useEffect(() => {
    if (currentSlide >= changes.length) {
      setIsPlaying(false);
      setPhase('intro');
    }
  }, [currentSlide, changes.length]);

  useEffect(() => {
    return () => {
      clearTimeouts();
      stop();
    };
  }, [stop]);

  const handleJumpToChange = useCallback((change) => {
    const editor = editorRef.current;
    if (!editor) return;

    const text = editor.value || '';
    if (!text) return;

    const decision = decisions[change.id] || 'pending';
    const useReplacement = decision !== 'rejected' && decision !== 'skipped';
    const candidates = [];

    if (useReplacement && change.replacement) candidates.push(change.replacement);
    if (change.original) candidates.push(change.original);
    if (!useReplacement && change.replacement) candidates.push(change.replacement);

    let matchIndex = -1;
    let matchText = '';

    for (const candidate of candidates) {
      if (!candidate) continue;
      const idx = text.indexOf(candidate);
      if (idx !== -1) {
        matchIndex = idx;
        matchText = candidate;
        break;
      }
    }

    if (matchIndex === -1 && typeof change.startIndex === 'number') {
      matchIndex = Math.max(0, Math.min(change.startIndex, Math.max(text.length - 1, 0)));
      matchText = change.original || change.replacement || '';
    }

    if (matchIndex === -1) return;

    const selectionEnd = Math.min(matchIndex + (matchText?.length || 0), text.length);

    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(matchIndex, Math.max(matchIndex, selectionEnd));

      const totalLines = Math.max(text.split('\n').length, 1);
      const lineNumber = text.slice(0, matchIndex).split('\n').length;
      const ratio = (lineNumber - 1) / totalLines;
      const targetScroll = ratio * Math.max(editor.scrollHeight - editor.clientHeight, 0);
      if (!Number.isNaN(targetScroll)) {
        editor.scrollTop = targetScroll;
      }
    });
  }, [decisions]);

  const handleTimelineScrub = (event) => {
    if (!timelineRef.current || !changes.length) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const targetIndex = Math.min(changes.length - 1, Math.floor(ratio * changes.length));
    clearTimeouts();
    stop();
    setIsPlaying(false);
    setPhase('intro');
    setCurrentSlide(targetIndex);
  };

  const handleToggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    const el = playerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleStart = () => {
    clearTimeouts();
    stop();
    setIsPlaying(true);
    setIsCinematic(true);
    setPhase('intro');
    setCurrentSlide(0);
  };
  
  const handleSkipToRecommendations = () => {
    clearTimeouts();
    stop();
    setIsPlaying(false);
    setPhase('intro');
    setCurrentSlide(changes.length);
    setIsCinematic(false);
  };

  const handlePause = () => {
    setIsPlaying(false);
    stop();
    clearTimeouts();
  };

  const handleResume = () => {
    setIsPlaying(true);
    if (currentSlide >= 0 && currentSlide < changes.length) {
      runSlideSequence(currentSlide);
    }
  };

  const handlePrev = () => {
    handlePause();
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
    else if (currentSlide === 0) setCurrentSlide(-1);
  };

  const handleNext = () => {
    handlePause();
    if (currentSlide < changes.length) setCurrentSlide(currentSlide + 1);
  };

  const handleRestart = () => {
    setCurrentSlide(-1);
    setPhase('intro');
    setIsPlaying(false);
    setIsCinematic(false);
  };
  
  const handleReplay = () => {
    clearTimeouts();
    stop();
    setIsCinematic(true);
    setPhase('intro');
    setCurrentSlide(-1);
    setIsPlaying(false);
    // small delay to allow intro slide animation to reset before play
    setTimeout(() => {
      setIsPlaying(true);
      setCurrentSlide(0);
    }, 200);
  };

  if (isOutro) {
    return (
      <div className="fixed inset-0 bg-slate-50 text-slate-900">
        <div className="h-full flex flex-col">
          <OutroSlide
            isActive
            score={score}
            newScore={newScore}
            totalChanges={changes.length}
            onRestart={handleRestart}
            onBack={onBack}
            onReplay={handleReplay}
            improvedCV={improvedCV || cvText}
            keywordSnapshot={keywordSnapshot}
            onApplyAll={onApplyAll}
            editorRef={editorRef}
            editorValue={editorValue || improvedCV || cvText}
            onEditorChange={onEditorChange}
            changes={changes}
            manualChanges={manualChanges}
            decisions={decisions}
            onDecisionChange={onDecisionChange}
            onSendUserRequest={onUserRequest}
            isRequestingUserChange={isUserRequesting}
            userRequestError={userRequestError}
            onClearUserRequestError={onClearUserRequestError}
          />
        </div>
      </div>
    );
  }

  if (!isCinematic) {
    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm text-slate-900 overflow-hidden z-50"
        onClick={handleCloseOverlay}
      >
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button
            onClick={handleSkipToRecommendations}
            className="px-3 py-2 rounded-lg bg-white text-emerald-700 border border-emerald-100 hover:border-emerald-300 transition"
          >
            Skip to summary
          </button>
          <button
            onClick={handleCloseOverlay}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-slate-300 transition"
          >
            Close
          </button>
        </div>
        <div
          className="relative w-full h-full"
          onClick={(e) => e.stopPropagation()}
        >
          <IntroSlide 
            isActive={currentSlide === -1} 
            score={score} 
            totalChanges={changes.length}
            onStart={handleStart}
            onViewRecommendations={handleSkipToRecommendations}
            isCinematic={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={handleCloseOverlay}
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.15),transparent_40%)] opacity-80" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_85%_15%,rgba(59,130,246,0.12),transparent_38%)] opacity-70" />

      <div
        ref={playerRef}
        className="relative w-[1200px] max-w-[96vw] aspect-video bg-[#0b0d13] rounded-[28px] overflow-hidden shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 pointer-events-none" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-4 text-white text-sm bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20">
          <div className="flex items-center gap-3">

          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSkipToRecommendations}
              className="h-10 w-10 rounded-full bg-white/10 text-white border border-white/10 hover:border-white/40 flex items-center justify-center transition"
              aria-label="Close walkthrough"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="relative h-full w-full overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.05),transparent_45%)] pointer-events-none" />
          <div className="relative h-full w-full">
            <IntroSlide 
              isActive={currentSlide === -1} 
              score={score} 
              totalChanges={changes.length}
              onStart={handleStart}
              onViewRecommendations={handleSkipToRecommendations}
            />
            
            {changes.map((change, idx) => (
              <PresentationSlide
                key={change.id}
                change={change}
                index={idx}
                total={changes.length}
                score={score}
                isActive={currentSlide === idx}
                phase={currentSlide === idx ? phase : 'intro'}
                cvText={cvText}
              />
            ))}
          </div>
        </div>

        <div className="absolute left-0 right-0 bottom-0 px-4 sm:px-6 pb-4 pt-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-white z-20">
          <div className="flex items-center gap-3 text-xs text-white/60 mb-2">
            <div className="flex items-center gap-2 uppercase tracking-[0.22em]">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>Playing</span>
            </div>
            <span className="text-white font-semibold truncate">{activeTitle || 'Your CV walkthrough'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={isPlaying ? handlePause : handleResume}
              className="h-12 w-12 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg hover:-translate-y-0.5 transition"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>

            <div className="flex-1">
              <div
                ref={timelineRef}
                className="relative h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer group"
                onMouseDown={handleTimelineScrub}
                onClick={handleTimelineScrub}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 via-red-400 to-orange-400"
                  style={{ width: `${timelineProgress * 100}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-white shadow-lg shadow-red-500/40 opacity-0 group-hover:opacity-100 transition"
                  style={{ left: `${timelineProgress * 100}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs tabular-nums text-white/70 min-w-[96px] justify-end">
              <span>{formatTime(elapsedSeconds)}</span>
              <span className="text-white/40">/</span>
              <span>{formatTime(timelineDuration)}</span>
            </div>

            <button
              onClick={handleToggleFullscreen}
              className="h-10 w-10 rounded-full bg-white/10 text-white border border-white/10 hover:border-white/40 flex items-center justify-center transition"
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l-4 0 0-4m10 0 4 0 0 4m0 6 0 4-4 0m-6 0-4 0 0-4" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H5v4m10-4h4v4m0 6v4h-4m-6 0H5v-4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// INPUT VIEW
// ============================================

const readPlainTextFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsText(file);
  });

const extractTextFromPdf = async (file) => {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs')
  ]);

  if (GlobalWorkerOptions) {
    const workerSrc =
      typeof workerModule === 'string'
        ? workerModule
        : typeof workerModule?.default === 'string'
          ? workerModule.default
          : new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    if (!GlobalWorkerOptions.workerSrc) {
      GlobalWorkerOptions.workerSrc = workerSrc;
    }
  }

  const pdfData = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: pdfData }).promise;
  const pageTexts = [];

    
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);

    // Improves mapping to human coordinates (optional but recommended)
    const viewport = page.getViewport({ scale: 1.0 });

    const content = await page.getTextContent({
      includeMarkedContent: true,
      disableCombineTextItems: false,
    });

    const text = buildTextWithLayout(content.items, viewport);
    if (text.trim()) pageTexts.push(text.trim());
  }

  // Keep page boundaries as blank line (tune as you wish)
  return pageTexts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
};

function buildTextWithLayout(items, viewport) {
  // Convert item coordinates to viewport coords and keep useful geometry
  const mapped = items
    .filter((it) => it.str && it.str.trim() !== "")
    .map((it) => {
      const tx = pdfjsLib.Util.transform(
        pdfjsLib.Util.transform(viewport.transform, it.transform),
        [1, 0, 0, 1, 0, 0]
      );

      // tx = [a,b,c,d,e,f] where (e,f) is the transformed origin
      const x = tx[4];
      const y = tx[5];

      // Approx item width/height in viewport space
      const w = it.width * viewport.scale;
      const h = it.height * viewport.scale;

      return {
        str: it.str,
        x,
        y,
        w,
        h,
      };
    });

  if (!mapped.length) return "";

  // Sort top-to-bottom then left-to-right
  // NOTE: in viewport coords, y typically increases downward.
  mapped.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  // Group into lines by y
  const lines = [];
  const yTolerance = 3; // tune: 2–6 depending on PDFs
  let currentLine = [];
  let currentY = mapped[0].y;

  for (const it of mapped) {
    if (Math.abs(it.y - currentY) <= yTolerance) {
      currentLine.push(it);
    } else {
      lines.push(currentLine);
      currentLine = [it];
      currentY = it.y;
    }
  }
  if (currentLine.length) lines.push(currentLine);

  // For each line, sort by x and stitch fragments with spacing heuristics
  const lineTexts = [];
  let prevLineY = null;
  let prevLineH = null;

  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);

    // Stitch line fragments
    let out = "";
    let prev = null;

    for (const frag of line) {
      if (!prev) {
        out += frag.str;
        prev = frag;
        continue;
      }

      const gap = frag.x - (prev.x + prev.w);

      // Heuristic: insert a space if there is a visible gap
      // Threshold scaled by text height; tune factor if needed.
      const spaceThreshold = Math.max(2, prev.h * 0.25);

      // Also avoid duplicating spaces if frag already starts with one
      if (gap > spaceThreshold && !out.endsWith(" ") && !frag.str.startsWith(" ")) {
        out += " ";
      }

      out += frag.str;
      prev = frag;
    }

    out = normalizeLine(out);

    // Decide newline vs paragraph break
    if (prevLineY == null) {
      lineTexts.push(out);
    } else {
      const dy = line[0].y - prevLineY;
      const typicalLineHeight = Math.max(prevLineH ?? 10, line[0].h);

      // If there is a bigger-than-normal vertical gap, treat as paragraph break
      const paragraphGap = typicalLineHeight * 1.4;

      if (dy > paragraphGap) lineTexts.push("", out); // blank line between paragraphs
      else lineTexts.push(out);
    }

    prevLineY = line[0].y;
    prevLineH = line[0].h;
  }

  // Final text
  return lineTexts.join("\n").replace(/[ \t]+\n/g, "\n");
}

function normalizeLine(s) {
  // Keep indentation? If you want indentation, remove the trimStart().
  // Many PDFs encode indentation as x-position, so trimming usually helps.
  return s
    .replace(/\s+/g, " ")
    .trim();
}

const extractTextFromFile = async (file) => {
  const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
  if (isPdf) return extractTextFromPdf(file);
  return readPlainTextFile(file);
};

const InputView = ({ onAnalyze, isLoading, progress }) => {
  const [cvText, setCvText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiProvider, setApiProvider] = useState('openai');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('nova');
  const progressStage = progress?.stage || (isLoading ? 'keywords' : 'idle');
  const totalKeywords = typeof progress?.totalKeywords === 'number' ? progress.totalKeywords : null;
  const matchedKeywords = typeof progress?.matchedKeywords === 'number' ? progress.matchedKeywords : null;
  const matchedKeywordsList = progress?.matchedKeywordsList || [];
  const missingKeywords = progress?.missingKeywords || [];
  const missingPreview = missingKeywords.slice(0, 5);
  const hasMoreMissing = missingKeywords.length > missingPreview.length;
  const stageRank = { keywords: 1, generating: 2, story: 3, done: 4 };
  const currentStageRank = stageRank[progressStage] || 1;
  const hasKeywordData = totalKeywords !== null || matchedKeywords !== null || missingKeywords.length > 0;
  const isGenerating = currentStageRank >= 2;
  const isDone = currentStageRank >= 4;
  const statusMessage = progress?.message || 'Analyzing your CV and job description...';
  const [showAllMissing, setShowAllMissing] = useState(false);
  const missingDisplay = showAllMissing ? missingKeywords : missingPreview;
  const hasMoreMatched = matchedKeywordsList.length > 5;
  const matchedPreview = hasMoreMatched ? matchedKeywordsList.slice(0, 5) : matchedKeywordsList;
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load saved settings
  useEffect(() => {
    const savedKey = localStorage.getItem('cv-coach-api-key');
    const savedProvider = localStorage.getItem('cv-coach-api-provider');
    const savedVoice = localStorage.getItem('cv-coach-voice');
    if (savedKey) setApiKey(savedKey);
    if (savedProvider) setApiProvider(savedProvider);
    if (savedVoice) setSelectedVoice(savedVoice);
  }, []);

  // Save settings
  useEffect(() => {
    if (apiKey) localStorage.setItem('cv-coach-api-key', apiKey);
    localStorage.setItem('cv-coach-api-provider', apiProvider);
    localStorage.setItem('cv-coach-voice', selectedVoice);
  }, [apiKey, apiProvider, selectedVoice]);

  useEffect(() => {
    if (!isLoading) {
      setShowAllMissing(false);
    }
  }, [isLoading]);

  const handleFileUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadError('');
      setUploadStatus('Extracting text from file...');
      setIsReadingFile(true);

      try {
        const maxSize = 8 * 1024 * 1024; // 8 MB safety cap
        if (file.size > maxSize) {
          throw new Error('File is too large. Please upload something under 8 MB.');
        }

        const rawText = await extractTextFromFile(file);
        const normalized = rawText.replace(/\u00a0/g, ' ').trim();
        if (!normalized) {
          throw new Error('No readable text found in this file. Try another file.');
        }
        setCvText(normalized);
        setUploadStatus(`${file.name} loaded. You can edit the text below.`);
      } catch (err) {
        console.error('File upload error:', err);
        setUploadError(err.message || 'Could not read this file. Please try a different one.');
        setUploadStatus('');
      } finally {
        event.target.value = '';
        setIsReadingFile(false);
      }
    },
    [setCvText]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 flex items-center justify-center text-slate-900">
        <div className="max-w-3xl w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 mx-auto">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-semibold">Preparing your walkthrough</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Analyzing your CV for this role</h1>
            <p className="text-slate-500 text-sm">{statusMessage}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-4 rounded-xl border ${currentStageRank >= 1 ? 'border-emerald-200 bg-emerald-50/70 shadow-sm' : 'border-slate-200 bg-white/70'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">1</span>
                  <span className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700">Valid keywords</span>
                </div>
                {isGenerating || isDone ? (
                  <span className="text-emerald-600 text-lg">✓</span>
                ) : (
                  <svg className="w-4 h-4 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-slate-700 mt-2">
                {totalKeywords !== null
                  ? `${totalKeywords} keywords pulled straight from the job description.`
                  : 'Extracting the most important keywords from the job description...'}
              </p>
              {matchedKeywords !== null && totalKeywords ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span>{matchedKeywords} already in your CV</span>
                    <span>{totalKeywords} total</span>
                  </div>
                  <div className="h-2 bg-white border border-emerald-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
                      style={{ width: `${Math.min(100, (matchedKeywords / Math.max(totalKeywords, 1)) * 100)}%` }}
                    />
                  </div>
                  {matchedKeywordsList.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {matchedPreview.map((kw) => (
                        <span key={kw} className="text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                          {kw}
                        </span>
                      ))}
                      {hasMoreMatched && (
                        <span className="text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                          +{matchedKeywordsList.length - matchedPreview.length} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">Finding and validating each keyword...</p>
              )}
            </div>

            <div className={`p-4 rounded-xl border ${currentStageRank >= 1 ? 'border-amber-200 bg-amber-50/70 shadow-sm' : 'border-slate-200 bg-white/70'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">2</span>
                  <span className="text-[11px] uppercase tracking-wide font-semibold text-amber-700">Missing in CV</span>
                </div>
                {hasKeywordData ? (
                  <span className="text-amber-700 text-xs font-semibold">{missingKeywords.length}</span>
                ) : (
                  <svg className="w-4 h-4 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-slate-700 mt-2">
                {hasKeywordData
                  ? 'Keywords in the job post that are missing from your CV:'
                  : 'Checking which of those keywords are absent from your CV...'}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {hasKeywordData && missingKeywords.length === 0 && (
                  <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                    Nice—nothing missing.
                  </span>
                )}
                {hasKeywordData && missingDisplay.map((kw) => (
                  <span key={kw} className="text-xs text-amber-800 font-semibold bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg">
                    {kw}
                  </span>
                ))}
                {hasKeywordData && hasMoreMissing && !showAllMissing && (
                  <button
                    type="button"
                    onClick={() => setShowAllMissing(true)}
                    className="text-[11px] text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-lg hover:border-emerald-300 hover:text-emerald-700 transition"
                  >
                    + Show {missingKeywords.length - missingPreview.length} more
                  </button>
                )}
                {!hasKeywordData && (
                  <span className="text-xs text-slate-500">We’ll list the missing ones here.</span>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isGenerating || isDone ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white shadow-sm' : 'border-slate-200 bg-white/70'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center">3</span>
                  <span className="text-[11px] uppercase tracking-wide font-semibold text-sky-700">Final step</span>
                </div>
                {isDone ? (
                  <span className="text-emerald-600 text-lg">✓</span>
                ) : (
                  <svg className={`w-4 h-4 ${isGenerating ? 'text-emerald-500 animate-spin' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-slate-700 mt-2">
                {isGenerating || isDone
                  ? 'Drafting your personalized corrections and walkthrough script.'
                  : 'Once the keywords are set, we’ll draft the corrections.'}
              </p>
              <p className="text-xs text-slate-500 mt-1">{statusMessage}</p>
            </div>
          </div>

          <div className="text-center text-xs text-slate-500">
            As soon as the analysis finishes, you can start the walkthrough or jump straight to the recommendations.
          </div>
        </div>
      </div>
    );
  }

  const sampleCV = `Hojjat Rakhshani

AI Researcher ML tooling
* Amsterdam, Netherlands
# Email | LinkedIn | GitHub | Publications

Summary GCP

Senior ML Engineer/Researcher with 3+ years transformers delivering end-to-end ML systems from rapid prototyping to production deployment. Strong Python and PyTorch; experienced in deep learning (BERT/LLMs, embeddings), training/evaluation, fine-tuning, and scalable inference. Build reliable ML platforms and pipelines (Airflow/Databricks/SageMaker) with monitoring and data-quality checks, and collaborate closely with researchers and engineers to translate ideas into measurable product impact.

Skills

Core Skills: Recom Machine Learning Engineering mendation engines, Java retrieval-augmented generation (RAG), multi-agent systems, synthetic data generation, model deployment (TGI/vLLM/Tensor-RT), fine-tuning, LLMs & LMs, optimization, AutoML

Experience

Senior ML Engineer at TechCorp (2021-Present)
- Developed recommendation systems
- Built data pipelines
- Improved model performance`;

  const sampleJob = `Senior Data Scientist - E-commerce Analytics

Requirements:
- 5+ years experience in data science or machine learning
- Strong Python and SQL skills
- Experience with sales analysis and revenue optimization
- Knowledge of A/B testing and experimentation
- Experience building recommendation systems
- Familiarity with cloud platforms (AWS, GCP)

Responsibilities:
- Develop predictive models for customer behavior
- Build dashboards for performance insights
- Conduct sales analysis and revenue forecasting
- Design multi-channel revenue strategy`;

  const handleSubmit = () => {
    if (!apiKey.trim()) {
      alert('Please enter your API key');
      return;
    }
    onAnalyze(cvText, jobDescription, apiKey, apiProvider, selectedVoice);
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-8 relative">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">

          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-emerald-300 hover:text-emerald-700 transition"
            aria-label="Open settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a5.25 5.25 0 100 10.5 5.25 5.25 0 000-10.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h1.25M3.25 12H4.5m7.5 7.5v1.25m0-18.5V4.5m4.95 13.05l.9.9m-11.8-11.8l.9.9m0 10l-.9.9m11.8-11.8l-.9.9" />
            </svg>
            <span className="text-sm font-semibold">Settings</span>
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Job description</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job posting you're applying to..."
              className="w-full h-40 p-4 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none resize-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Your CV / resume</label>
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste your CV content here..."
              className="w-full h-56 p-4 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none resize-none transition font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-slate-500">
                API, voice, and sample data live in Settings.
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <label className="relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 transition cursor-pointer shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                  </svg>
                  <span className="text-sm font-semibold">Upload PDF or TXT</span>
                  <input
                    type="file"
                    accept=".pdf,.txt,application/pdf,text/plain"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileUpload}
                    disabled={isLoading || isReadingFile}
                  />
                </label>
                <button
                  onClick={handleSubmit}
                  disabled={!cvText.trim() || !jobDescription.trim() || !apiKey.trim() || isLoading || isReadingFile}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold shadow-lg shadow-emerald-100 disabled:shadow-none transition"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                      Start Walkthrough
                    </>
                  )}
                </button>
              </div>
            </div>
          {uploadStatus && (
            <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
              {uploadStatus}
            </div>
          )}
          {uploadError && (
            <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl">
              {uploadError}
            </div>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <div className="text-xs uppercase font-semibold text-slate-500">Settings</div>
                <div className="text-lg font-bold text-slate-900">API, voice, and samples</div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition"
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 text-sm font-semibold mb-2">API Provider</label>
                  <select
                    value={apiProvider}
                    onChange={(e) => setApiProvider(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                  >
                    <option value="openai">OpenAI (GPT-5.2)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 text-sm font-semibold mb-2">
                    API Key <span className="text-slate-500 font-normal">(analysis & TTS)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={apiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                      className="w-full p-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      aria-label="Toggle API key visibility"
                    >
                      {showApiKey ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-2">
                  Narrator Voice <span className="text-slate-500 font-normal">(OpenAI TTS)</span>
                </label>
                <VoiceSelector selectedVoice={selectedVoice} onVoiceChange={setSelectedVoice} />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 text-sm font-semibold mb-2">Sample data</label>
                  <button
                    type="button"
                    onClick={() => { setCvText(sampleCV); setJobDescription(sampleJob); }}
                    className="px-4 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 hover:border-emerald-300 hover:text-emerald-800 transition"
                  >
                    Load sample CV & job
                  </button>
                  <p className="text-xs text-slate-500 mt-2">
                    Upload your file from the main screen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN APP
// ============================================

export default function App() {
  const [view, setView] = useState('input');
  const [cvText, setCvText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [changes, setChanges] = useState([]);
  const [score, setScore] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [apiProvider, setApiProvider] = useState('openai');
  const [selectedVoice, setSelectedVoice] = useState('onyx');
  const [logs, setLogs] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [improvedCV, setImprovedCV] = useState('');
  const [keywordSnapshot, setKeywordSnapshot] = useState(null);
  const [proposedCV, setProposedCV] = useState('');
  const [proposedKeywordSnapshot, setProposedKeywordSnapshot] = useState(null);
  const [suggestionDecisions, setSuggestionDecisions] = useState({});
  const [validatedKeywords, setValidatedKeywords] = useState(null);
  const [pendingAnalysis, setPendingAnalysis] = useState(null);
  const [keywordReviewOpen, setKeywordReviewOpen] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState([]);
  const [isUserRequesting, setIsUserRequesting] = useState(false);
  const [userRequestError, setUserRequestError] = useState(null);
  const [editorText, setEditorText] = useState('');
  const [manualChanges, setManualChanges] = useState([]);
  const manualSessionRef = useRef({ id: null, baseText: '', lastUpdated: 0 });
  const manualDebounceRef = useRef(null);
  const manualPendingRef = useRef(null);

  const addLogEntry = useCallback((entry) => {
    setLogs((prev) => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `log-${Date.now()}-${prev.length}`;
      const timestamp = entry.timestamp || Date.now();
      const next = [
        ...prev,
        {
          id,
          timestamp,
          status: 'success',
          ...entry,
        }
      ];
      return next.slice(-30); // keep last 30 entries to avoid bloat
    });
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const handleAnalyze = async (cv, job, key, apiProviderChoice, voice) => {
    if (manualDebounceRef.current) {
      clearTimeout(manualDebounceRef.current);
      manualDebounceRef.current = null;
    }
    manualPendingRef.current = null;
    setIsLoading(true);
    setError(null);
    setCvText(cv);
    setJobDescription(job);
    setApiKey(key);
    setApiProvider(apiProviderChoice);
    setSelectedVoice(voice);
    setImprovedCV(cv);
    setKeywordSnapshot(null);
    setProposedCV('');
    setProposedKeywordSnapshot(null);
    setSuggestionDecisions({});
    setValidatedKeywords(null);
    setPendingAnalysis({ cv, job, key, apiProvider: apiProviderChoice, voice });
    setKeywordDraft([]);
    setKeywordReviewOpen(false);
    setUserRequestError(null);
    setIsUserRequesting(false);
    setEditorText(cv || '');
    setManualChanges([]);
    manualSessionRef.current = { id: null, baseText: cv || '', lastUpdated: 0 };
    setAnalysisProgress({
      stage: 'keywords',
      totalKeywords: null,
      matchedKeywords: null,
      missingKeywords: [],
      message: 'Scanning the job description for critical keywords...'
    });

    try {
      const extractedKeywords = await extractKeywords(job, key, apiProviderChoice, addLogEntry);
      const validatedList = validateKeywords(extractedKeywords, job, cv);

      setKeywordDraft(validatedList.map((k) => k.keyword));
      setKeywordReviewOpen(true);
      setAnalysisProgress({
        stage: 'keywords',
        totalKeywords: validatedList.length,
        matchedKeywords: validatedList.filter((k) => k.inCV).length,
        matchedKeywordsList: validatedList.filter((k) => k.inCV).map((k) => k.keyword),
        missingKeywords: validatedList
          .filter((k) => k.inJobDescription && !k.inCV)
          .map((k) => k.keyword),
        message: 'Confirm, add, or remove keywords before we draft your improvements.'
      });
    } catch (err) {
      setError(err.message || 'Keyword extraction failed. Please check your API key and try again.');
      setAnalysisProgress(null);
      setPendingAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmKeywords = async (finalKeywords) => {
    if (!pendingAnalysis) return;

    const { cv, job, key, apiProvider, voice } = pendingAnalysis;
    setApiProvider(apiProvider);
    const cleaned = validateKeywords(
      Array.isArray(finalKeywords) && finalKeywords.length > 0 ? finalKeywords : keywordDraft,
      job,
      cv
    );
    const keywordList = cleaned.map((k) => k.keyword);
    const matchedList = cleaned.filter((k) => k.inCV).map((k) => k.keyword);
    const missingList = cleaned.filter((k) => k.inJobDescription && !k.inCV).map((k) => k.keyword);

    addLogEntry({
      stage: 'keywords',
      provider: apiProvider,
      model: 'user-confirmed',
      prompt: 'User confirmed keyword list',
      response: JSON.stringify(keywordList),
      status: 'success'
    });

    setKeywordReviewOpen(false);
    setIsLoading(true);
    setSelectedVoice(voice);
    setAnalysisProgress({
      stage: 'keywords',
      totalKeywords: keywordList.length,
      matchedKeywords: matchedList.length,
      matchedKeywordsList: matchedList,
      missingKeywords: missingList,
      message: 'Validating your keywords and drafting personalized recommendations...'
    });

    try {
      const result = await analyzeCV(
        cv,
        job,
        key,
        apiProvider,
        addLogEntry,
        (progressUpdate) => {
          setAnalysisProgress((prev) => ({
            ...(prev || {}),
            ...progressUpdate
          }));
        },
        keywordList
      );

      setAnalysisProgress((prev) => ({
        ...(prev || {}),
        stage: 'story',
        message: 'Weaving a short intro for each slide so the walkthrough feels like a story...'
      }));

      const storytellingEntries = await generateStorytellingIntros(result.suggestions, key, addLogEntry);
      const suggestionsWithNarrative = mergeNarrativesIntoChanges(result.suggestions, storytellingEntries);

      setChanges(suggestionsWithNarrative);
      setScore(result.score);
      setSuggestionDecisions(
        Object.fromEntries((suggestionsWithNarrative || []).map((s) => [s.id, 'pending']))
      );
      setValidatedKeywords(result.validatedKeywords || null);

      const { text: proposedText } = applySuggestionsToCV(cv, suggestionsWithNarrative);
      setProposedCV(proposedText);
      const missingAfterProposed = computeMissingKeywordsAfter(result.validatedKeywords?.inJob, proposedText);
      setProposedKeywordSnapshot({
        total: result.validatedKeywords?.inJob?.length || 0,
        before: result.validatedKeywords?.missing?.length || 0,
        after: missingAfterProposed.length,
        missingBeforeList: result.validatedKeywords?.missing || [],
        missingAfterList: missingAfterProposed
      });
      setImprovedCV(proposedText);
      setEditorText(proposedText || cv || '');
      setManualChanges([]);
      manualSessionRef.current = { id: null, baseText: proposedText || cv || '', lastUpdated: 0 };
      setView('presentation');
      setAnalysisProgress(null);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please check your API key and try again.');
      setAnalysisProgress(null);
    } finally {
      setIsLoading(false);
      setPendingAnalysis(null);
    }
  };

  const handleCancelKeywordReview = () => {
    setKeywordReviewOpen(false);
    setPendingAnalysis(null);
    setAnalysisProgress(null);
  };

  const handleBack = () => {
    if (manualDebounceRef.current) {
      clearTimeout(manualDebounceRef.current);
      manualDebounceRef.current = null;
    }
    manualPendingRef.current = null;
    setView('input');
    setChanges([]);
    setAnalysisProgress(null);
    setImprovedCV('');
    setKeywordSnapshot(null);
    setProposedCV('');
    setProposedKeywordSnapshot(null);
    setSuggestionDecisions({});
    setValidatedKeywords(null);
    setKeywordReviewOpen(false);
    setPendingAnalysis(null);
    setKeywordDraft([]);
    setJobDescription('');
    setUserRequestError(null);
    setIsUserRequesting(false);
    setEditorText('');
    setManualChanges([]);
    manualSessionRef.current = { id: null, baseText: '', lastUpdated: 0 };
  };

  useEffect(() => {
    setImprovedCV(editorText || '');
  }, [editorText]);

  useEffect(() => {
    if (!validatedKeywords) {
      setKeywordSnapshot(null);
      return;
    }

    const missingAfter = computeMissingKeywordsAfter(validatedKeywords.inJob, editorText || '');
    setKeywordSnapshot({
      total: validatedKeywords.inJob?.length || 0,
      before: validatedKeywords.missing?.length || 0,
      after: missingAfter.length,
      missingBeforeList: validatedKeywords.missing || [],
      missingAfterList: missingAfter
    });
  }, [editorText, validatedKeywords]);

  const handleEditorTextChange = useCallback((nextText) => {
    setEditorText((prevText) => {
      const prevValue = typeof prevText === 'string' ? prevText : '';
      if (prevValue === nextText) return prevText;

      const now = Date.now();
      const sessionExpired = now - (manualSessionRef.current.lastUpdated || 0) > MANUAL_DEBOUNCE_MS * 1.5;
      if (!manualSessionRef.current.id || sessionExpired) {
        manualSessionRef.current = {
          id: `manual-${now}`,
          baseText: prevValue,
          lastUpdated: now
        };
      } else {
        manualSessionRef.current.lastUpdated = now;
      }

      manualPendingRef.current = {
        id: manualSessionRef.current.id,
        baseText: manualSessionRef.current.baseText,
        nextText
      };

      if (manualDebounceRef.current) {
        clearTimeout(manualDebounceRef.current);
      }

      manualDebounceRef.current = setTimeout(() => {
        const { id, baseText, nextText: pendingText } = manualPendingRef.current || {};
        if (!id) return;

        const change = buildManualChangeEntry(
          baseText,
          pendingText,
          id,
          validatedKeywords
        );

        if (change) {
          setManualChanges((prevList) => {
            const idx = prevList.findIndex((c) => c.id === change.id);
            if (idx >= 0) {
              const copy = [...prevList];
              copy[idx] = change;
              return copy;
            }
            return [...prevList, change];
          });
          setSuggestionDecisions((prevDecisions) => ({
            ...prevDecisions,
            [change.id]: 'accepted'
          }));
        } else if (id) {
          setManualChanges((prevList) => prevList.filter((c) => c.id !== id));
          setSuggestionDecisions((prevDecisions) => {
            if (prevDecisions[id]) {
              const next = { ...prevDecisions };
              delete next[id];
              return next;
            }
            return prevDecisions;
          });
        }
      }, MANUAL_DEBOUNCE_MS);

      return nextText;
    });
  }, [validatedKeywords]);

  const handleDecisionChange = (id, decision) => {
    setSuggestionDecisions((prev) => ({
      ...prev,
      [id]: decision
    }));

    const combinedChanges = [...changes, ...manualChanges];
    const targetChange = combinedChanges.find((c) => c.id === id);
    if (!targetChange) return;

    if (targetChange.manual && decision === 'rejected') {
      setEditorText((prev) => revertChangeInText(prev, targetChange));
      setManualChanges((prevList) => prevList.filter((c) => c.id !== id));
      setSuggestionDecisions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    if (decision === 'rejected') {
      setEditorText((prev) => revertChangeInText(prev, targetChange));
      return;
    }

    if (decision === 'accepted') {
      setEditorText((prev) => applyChangeToText(prev, targetChange));
    }
  };

  const handleApplyAll = () => {
    setSuggestionDecisions((prev) => {
      const next = { ...prev };
      changes.forEach((change) => {
        next[change.id] = 'accepted';
      });
      return next;
    });
    setEditorText((prev) => {
      const base = typeof prev === 'string' && prev ? prev : (cvText || '');
      const { text } = applySuggestionsToCV(base, changes);
      return text;
    });
  };

  const handleUserRequest = async (userText) => {
    const request = (userText || '').trim();
    if (!request) {
      setUserRequestError('Please add a short request for the change.');
      return;
    }
    if (!apiKey) {
      setUserRequestError('Add your API key before requesting new modifications.');
      return;
    }
    if (!cvText || !jobDescription) {
      setUserRequestError('Run an analysis first so we can ground your request in the CV and job description.');
      return;
    }

    setIsUserRequesting(true);
    setUserRequestError(null);

    try {
      const baseDraft = editorText || cvText;
      const currentDraft = editorText || improvedCV || cvText;
      const { suggestions: rawSuggestions } = await generateUserRequestedChanges(
        baseDraft,
        jobDescription,
        currentDraft,
        request,
        apiKey,
        apiProvider,
        changes,
        addLogEntry
      );

      const baseText = baseDraft || '';
      const draftText = currentDraft || '';
      const existingSignature = new Set(changes.map((c) => `${c.original}→${c.replacement}`));
      const now = Date.now();

      const normalized = (rawSuggestions || [])
        .map((s, idx) => {
          if (!s || typeof s.original !== 'string' || !s.original.trim()) return null;
          const signature = `${s.original}→${s.replacement}`;
          if (existingSignature.has(signature)) return null;
          const id = s.id && !changes.some((c) => c.id === s.id) ? s.id : `user-${now}-${idx}`;
          let startIndex = baseText.indexOf(s.original);
          if (startIndex === -1 && draftText) {
            startIndex = draftText.indexOf(s.original);
          }
          if (startIndex === -1) return null;
          return {
            ...s,
            id,
            startIndex,
            endIndex: startIndex + s.original.length
          };
        })
        .filter(Boolean);

      if (normalized.length === 0) {
        throw new Error('No valid modifications found. Try a more specific request or mention the exact sentence to change.');
      }

      setChanges((prev) => [...prev, ...normalized]);
      setSuggestionDecisions((prev) => {
        const next = { ...prev };
        normalized.forEach((s) => {
          if (!next[s.id]) next[s.id] = 'pending';
        });
        return next;
      });
      setEditorText((prevDraft) => {
        const base = typeof prevDraft === 'string' && prevDraft ? prevDraft : (cvText || '');
        const { text } = applySuggestionsToCV(base, normalized);
        return text;
      });
    } catch (err) {
      setUserRequestError(err.message || 'Could not generate modifications from your request.');
      throw err;
    } finally {
      setIsUserRequesting(false);
    }
  };

  const showPresentation = view === 'presentation' && changes.length > 0;
  const displayKeywordSnapshot = keywordSnapshot || proposedKeywordSnapshot;
  const displayImprovedCV = editorText || improvedCV || proposedCV || cvText;

  return (
    <>
      {showPresentation ? (
        <Presentation 
          cvText={cvText} 
          changes={changes} 
          score={score} 
          onBack={handleBack} 
          apiKey={apiKey}
          selectedVoice={selectedVoice}
          improvedCV={displayImprovedCV}
          keywordSnapshot={displayKeywordSnapshot}
          manualChanges={manualChanges}
          decisions={suggestionDecisions}
          onDecisionChange={handleDecisionChange}
          editorValue={displayImprovedCV}
          onEditorChange={handleEditorTextChange}
          onApplyAll={handleApplyAll}
          onUserRequest={handleUserRequest}
          isUserRequesting={isUserRequesting}
          userRequestError={userRequestError}
          onClearUserRequestError={() => setUserRequestError(null)}
        />
      ) : (
        <InputView onAnalyze={handleAnalyze} isLoading={isLoading} progress={analysisProgress} />
      )}
      <KeywordReviewModal
        open={keywordReviewOpen}
        keywords={keywordDraft}
        jobDescription={jobDescription}
        cvText={cvText}
        onClose={handleCancelKeywordReview}
        onConfirm={handleConfirmKeywords}
        onKeywordsChange={setKeywordDraft}
        isSubmitting={isLoading}
      />
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 max-w-lg">
          <span>⚠️</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="hover:bg-white/20 rounded-lg p-1">✕</button>
        </div>
      )}
      <LogConsole logs={logs} onClear={clearLogs} />
    </>
  );
}
