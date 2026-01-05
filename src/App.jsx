import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

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
  
  const outro = isLast
    ? `And that's all ${total} improvements! Apply these changes and you'll have a much stronger CV for this role.`
    : `Great, let's move on to the next one.`;

  return {
    categoryIntro,
    mainExplanation,
    impact,
    outro,
    fullScript: mainExplanation
  };
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

const validateKeywords = (keywords, jobDescription, cvText) => {
  const jobDescLower = jobDescription.toLowerCase();
  const cvTextLower = cvText.toLowerCase();
  
  return keywords.filter(keyword => {
    const keywordLower = keyword.toLowerCase();
    const inJobDesc = jobDescLower.includes(keywordLower);
    const inCV = cvTextLower.includes(keywordLower);
    return inJobDesc; // Must appear in job description
  }).map(keyword => ({
    keyword,
    inJobDescription: jobDescription.toLowerCase().includes(keyword.toLowerCase()),
    inCV: cvText.toLowerCase().includes(keyword.toLowerCase())
  }));
};

const analyzeCV = async (cvText, jobDescription, apiKey, apiProvider = 'anthropic', onLog, onProgress) => {
  // Step 1: Extract keywords from job description
  const rawKeywords = await extractKeywords(jobDescription, apiKey, apiProvider, onLog);
  
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

Provide 5-10 high-impact suggestions. The "original" field MUST be an exact substring from the CV.`;

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

// Apply validated suggestions to the CV text to generate an improved draft
const applySuggestionsToCV = (cvText, suggestions = []) => {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return { text: cvText, applied: [] };
  }

  const sorted = [...suggestions]
    .filter((s) => typeof s.startIndex === 'number' && typeof s.endIndex === 'number' && s.startIndex >= 0)
    .sort((a, b) => a.startIndex - b.startIndex);

  let cursor = 0;
  let output = '';
  const applied = [];

  sorted.forEach((s) => {
    // Skip overlapping or invalid ranges to keep the text coherent
    if (s.startIndex < cursor || s.endIndex > cvText.length) return;
    output += cvText.slice(cursor, s.startIndex);
    const replacementText = typeof s.replacement === 'string' ? s.replacement : s.original || '';
    output += replacementText;
    cursor = s.endIndex;
    applied.push(s.id);
  });

  output += cvText.slice(cursor);

  return { text: output, applied };
};

// Re-check which keywords remain missing after applying the replacements
const computeMissingKeywordsAfter = (keywordsInJob = [], updatedCV = '') => {
  const loweredCV = updatedCV.toLowerCase();
  return keywordsInJob.filter((kw) => !loweredCV.includes(kw.toLowerCase()));
};

//export { analyzeCV, extractKeywords, validateKeywords };

// ============================================
// OPENAI TEXT-TO-SPEECH API
// ============================================

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
  return URL.createObjectURL(audioBlob);
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
  const prefetchTasksRef = useRef(new Map());
  const audioCacheRef = useRef(new Map());

  const makeCacheKey = useCallback((text, voice, speed) => `${voice}-${speed}-${text}`, []);

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

  const clearCachedAudio = useCallback(() => {
    prefetchTasksRef.current.forEach(({ controller }) => controller.abort());
    prefetchTasksRef.current.clear();
    audioCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    audioCacheRef.current.clear();
  }, []);

  const prefetchSpeech = useCallback((text, voice = 'onyx', speed = 1.4) => {
    if (!apiKey || !text?.trim()) return null;

    const key = makeCacheKey(text, voice, speed);
    if (audioCacheRef.current.has(key)) return audioCacheRef.current.get(key);
    if (prefetchTasksRef.current.has(key)) return prefetchTasksRef.current.get(key).promise;

    const controller = new AbortController();

    const promise = generateSpeech(text, apiKey, voice, speed, controller.signal)
      .then((audioUrl) => {
        if (controller.signal.aborted) {
          URL.revokeObjectURL(audioUrl);
          return null;
        }
        audioCacheRef.current.set(key, audioUrl);
        prefetchTasksRef.current.delete(key);
        return audioUrl;
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('TTS prefetch error:', error);
        }
        prefetchTasksRef.current.delete(key);
        return null;
      });

    prefetchTasksRef.current.set(key, { controller, promise });
    return promise;
  }, [apiKey, makeCacheKey]);

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

    setIsLoading(!audioUrl);
    setIsSpeaking(false);

    try {
      if (!audioUrl && prefetchTasksRef.current.has(key)) {
        audioUrl = await prefetchTasksRef.current.get(key).promise;
      }

      if (!audioUrl) {
        audioUrl = await generateSpeech(text, apiKey, voice, speed, abortControllerRef.current.signal);
      }
      
      if (abortControllerRef.current?.signal.aborted) {
        if (!audioCacheRef.current.has(key) && audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        return;
      }

      if (!audioCacheRef.current.has(key) && audioUrl) {
        audioCacheRef.current.set(key, audioUrl);
      }

      const audio = new Audio(audioCacheRef.current.get(key));
      audioRef.current = audio;

      audio.onplay = () => {
        setIsLoading(false);
        setIsSpeaking(true);
      };

      const cleanupUrl = () => {
        const cachedUrl = audioCacheRef.current.get(key);
        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl);
          audioCacheRef.current.delete(key);
        }
        audioRef.current = null;
      };

      audio.onended = () => {
        setIsSpeaking(false);
        cleanupUrl();
        onEnd?.();
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsLoading(false);
        setIsSpeaking(false);
        cleanupUrl();
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
  }, [apiKey, makeCacheKey]);

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
      clearCachedAudio();
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
      clearCachedAudio();
    };
  }, [clearCachedAudio]);

  return { playTone, playTransition, playHighlight, speak, prefetchSpeech, stop, isSpeaking, isLoading };
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
    <div className={`absolute inset-0 flex transition-all duration-700 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
      
      {/* Left Panel - Context */}
      <div className="w-1/2 p-12 flex flex-col justify-center">
        

        {/* Category Badge */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border w-fit mb-6 transition-all duration-500 delay-100 ${phase !== 'intro' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
          <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${style.gradient}`} />
          <span className="text-emerald-700 text-sm font-medium">{style.label}</span>
        </div>

        {/* Main Title */}
        <h2 className={`text-4xl font-bold text-slate-900 mb-4 transition-all duration-500 delay-200 ${phase !== 'intro' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {change.title}
        </h2>

        {/* Explanation */}
        <p className={`text-xl text-slate-600 leading-relaxed mb-8 transition-all duration-500 delay-300 ${['explanation', 'before-after', 'impact'].includes(phase) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {change.description}
        </p>

        {/* Impact Meter */}
        <div className={`transition-all duration-500 delay-400 ${phase === 'impact' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-sm">Impact on Match Score</span>
            <span className="text-slate-900 font-bold">+{Math.round(100/total)}%</span>
          </div>
          <div className="h-3 bg-emerald-50 rounded-full overflow-hidden border">
            <div 
              className={`h-full rounded-full bg-gradient-to-r ${style.gradient} transition-all duration-1000`}
              style={{ width: phase === 'impact' ? `${Math.min((100/total) * 5, 100)}%` : '0%' }}
            />
          </div>
        </div>

        {/* Progress */}
        <div className="mt-auto pt-8">
          <div className="flex items-center justify-between">
            {/* <span>Progress</span> */}
            {/* <span>{index + 1} of {total}</span> */}
          </div>
          <div>
            {/* <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            /> */}
          </div>
        </div>
      </div>

      {/* Right Panel - Visual */}
      <div className="w-1/2 p-12 flex flex-col justify-center bg-white">
        
        {/* Before/After Card */}
        <div className={`transition-all duration-700 delay-200 ${['before-after', 'impact'].includes(phase) ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          
          {/* Before */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-rose-600 font-semibold text-sm uppercase tracking-wide">Before</span>
            </div>
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-100">
              <p className="text-lg text-rose-700 line-through decoration-rose-300 decoration-2">
                {change.original}
              </p>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center mb-8">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${style.gradient} flex items-center justify-center shadow-lg transition-all duration-500 ${phase === 'impact' ? 'scale-110' : 'scale-100'}`}>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          {/* After */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-emerald-600 font-semibold text-sm uppercase tracking-wide">After</span>
            </div>
            <div className={`p-6 rounded-2xl bg-emerald-50 border transition-all duration-500 ${phase === 'impact' ? 'shadow-lg shadow-emerald-100' : ''}`}>
              <p className="text-lg text-emerald-800 font-medium">
                {change.replacement}
              </p>
            </div>
          </div>
        </div>

        {/* Highlight indicator */}
        <div className={`mt-8 flex items-center justify-center gap-2 transition-all duration-500 ${phase === 'impact' ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-2xl">✨</span>
          <span className="text-slate-600 font-medium">Much better!</span>
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
  onStart
}) => {
  return (
    <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="text-center max-w-2xl px-8">
        
        {/* Animated Logo */}
        <div className="mb-8 relative">
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white border flex items-center justify-center animate-bounce shadow-sm">
            <span className="text-emerald-700 text-sm font-bold">{totalChanges}</span>
          </div>
        </div>
        
        <p className="text-xl text-slate-600 mb-8">
          I found <span className="text-emerald-600 font-bold">{totalChanges} improvements</span> that could boost your match score from <span className="text-amber-500 font-bold">{score}%</span> to over <span className="text-emerald-600 font-bold">{Math.min(95, score + 40)}%</span>
        </p>

        {/* Host intro */}
        <div className="flex items-center justify-center gap-6 mb-10">
        </div>

        <button
          onClick={onStart}
          className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-lg rounded-2xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 flex items-center gap-3 mx-auto"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          Start Walkthrough
        </button>

        <p className="text-slate-500 text-sm mt-4">
          Takes about {Math.ceil(totalChanges * 0.5)} minutes
        </p>
      </div>
    </div>
  );
};

// ============================================
// OUTRO SLIDE
// ============================================

const OutroSlide = ({ 
  isActive, 
  score, 
  newScore, 
  totalChanges, 
  onRestart, 
  onBack,
  improvedCV,
  keywordSnapshot,
  onApplyAll
}) => {
  if (!isActive) return null;

  const totalKeywords = keywordSnapshot?.total || 0;
  const missingBefore = keywordSnapshot?.before || 0;
  const missingAfter = keywordSnapshot?.after || 0;
  const missingAfterList = keywordSnapshot?.missingAfterList || [];
  const missingBeforeList = keywordSnapshot?.missingBeforeList || [];
  const delta = Math.max(0, missingBefore - missingAfter);

  return (
    <div className="space-y-6">

      <div className="grid gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-xs uppercase font-semibold text-slate-500">Keywords covered</div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex-1">
              <div className="text-lg font-semibold text-slate-900">{totalKeywords} total</div>
              <div className="text-xs text-slate-500 mt-1">From the job description</div>
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold text-amber-700">{missingBefore} missing → {missingAfter}</div>
              <div className="text-xs text-slate-500 mt-1">Before vs. after your edits</div>
            </div>
          </div>
          {missingAfterList.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {missingAfterList.slice(0, 6).map((kw) => (
                <span key={kw} className="px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-100 text-xs">
                  {kw}
                </span>
              ))}
              {missingAfterList.length > 6 && (
                <span className="px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200 text-xs">
                  +{missingAfterList.length - 6} more
                </span>
              )}
            </div>
          )}
          {missingAfterList.length === 0 && (
            <div className="mt-3 text-sm font-semibold text-emerald-700">Nice—no missing keywords remain.</div>
          )}
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500">Proposed CV draft</div>
            <div className="text-slate-900 text-lg font-bold">Walkthrough version you can accept or ignore</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Applied suggestions are highlighted in the panel
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-h-512 overflow-auto text-sm text-slate-800 whitespace-pre-wrap font-mono mt-4">
          {improvedCV || 'Your improved CV will appear here after applying the changes.'}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onApplyAll}
          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-200 transition"
        >
          Apply all changes
        </button>
        <button
          onClick={onRestart}
          className="px-5 py-3 rounded-xl border border-slate-300 text-slate-800 hover:border-emerald-300 hover:text-emerald-800 transition"
        >
          Watch walkthrough again
        </button>
        <button
          onClick={onBack}
          className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:border-slate-400 transition"
        >
          Analyze another CV
        </button>
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
// SUGGESTION REVIEW PANEL
// ============================================

const SuggestionReviewPanel = ({
  open,
  onClose,
  suggestions = [],
  decisions = {},
  onDecisionChange,
  onApplyAll,
  variant = 'modal'
}) => {
  if (!open) return null;

  const isInline = variant === 'inline';
  const panelWidth = isInline ? 'w-full' : 'w-full max-w-xl';
  const panelHeight = isInline ? 'max-h-[calc(100vh-3rem)]' : 'h-full';
  const panelClasses = isInline
    ? `${panelWidth} ${panelHeight} bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden`
    : `${panelWidth} h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col`;

  const decisionOrder = { accepted: 0, pending: 1, skipped: 2, rejected: 3 };
  const importanceOrder = { high: 0, medium: 1, low: 2 };

  const acceptedCount = suggestions.filter((s) => decisions[s.id] === 'accepted').length;
  const skippedCount = suggestions.filter((s) => decisions[s.id] === 'skipped').length;
  const rejectedCount = suggestions.filter((s) => decisions[s.id] === 'rejected').length;
  const pendingCount = Math.max(0, suggestions.length - acceptedCount - skippedCount - rejectedCount);

  const sorted = [...suggestions].sort((a, b) => {
    const decisionRankA = decisionOrder[decisions[a.id] || 'pending'];
    const decisionRankB = decisionOrder[decisions[b.id] || 'pending'];
    if (decisionRankA !== decisionRankB) return decisionRankA - decisionRankB;

    const importanceRankA = importanceOrder[a.importance] ?? 3;
    const importanceRankB = importanceOrder[b.importance] ?? 3;
    if (importanceRankA !== importanceRankB) return importanceRankA - importanceRankB;

    return (a.title || '').localeCompare(b.title || '');
  });

  const decisionStyles = {
    accepted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    skipped: 'bg-amber-50 text-amber-700 border-amber-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    pending: 'bg-slate-50 text-slate-600 border-slate-200'
  };

  const panelContent = (
    <div className={panelClasses}>
      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase font-semibold text-slate-500">Recommended modifications</div>
          <div className="text-lg font-bold text-slate-900">
            {acceptedCount} accepted · {pendingCount} pending · {skippedCount} skipped · {rejectedCount} rejected
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onApplyAll}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold shadow-sm hover:bg-emerald-600 transition"
          >
            Apply all of them
          </button>
          {!isInline && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700"
              aria-label="Close review panel"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="p-4 overflow-y-auto space-y-3">
        {sorted.map((change) => {
          const decision = decisions[change.id] || 'pending';
          const style = decisionStyles[decision];
          const badgeStyle = categoryStyles[change.type] || categoryStyles.clarity;

          return (
            <div key={change.id} className="border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${badgeStyle.gradient}`} />
                  <span className="text-xs font-semibold uppercase text-slate-600">{badgeStyle.label}</span>
                  {change.importance && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600">
                      {change.importance} priority
                    </span>
                  )}
                </div>
                <span className={`text-[11px] px-2 py-1 rounded-lg border ${style}`}>
                  {decision === 'pending' ? 'Pending' : decision.charAt(0).toUpperCase() + decision.slice(1)}
                </span>
              </div>

              <div className="mb-2">
                <div className="text-sm font-semibold text-slate-900">{change.title}</div>
                <p className="text-sm text-slate-600 mt-1">{change.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 break-words">
                  <div className="text-[11px] uppercase font-semibold text-rose-700 mb-1">Original</div>
                  <div className="text-rose-800">{change.original}</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 break-words">
                  <div className="text-[11px] uppercase font-semibold text-emerald-700 mb-1">Replacement</div>
                  <div className="text-emerald-900 font-medium">{change.replacement}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onDecisionChange(change.id, decision === 'accepted' ? 'pending' : 'accepted')}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                    decision === 'accepted'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {decision === 'accepted' ? 'Accepted' : 'Accept'}
                </button>
                <button
                  onClick={() => onDecisionChange(change.id, 'skipped')}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                    decision === 'skipped'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  Skip
                </button>
                <button
                  onClick={() => onDecisionChange(change.id, 'rejected')}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                    decision === 'rejected'
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  Reject
                </button>
                {decision !== 'pending' && (
                  <button
                    onClick={() => onDecisionChange(change.id, 'pending')}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="border border-slate-200 rounded-xl p-4 text-sm text-slate-600 bg-slate-50">
            No suggestions available yet. Run an analysis to populate this list.
          </div>
        )}
      </div>
    </div>
  );

  if (isInline) {
    return (
      <div className={`${panelHeight} sticky top-4`}>
        {panelContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {panelContent}
    </div>
  );
};

// ============================================
// MAIN PRESENTATION COMPONENT
// ============================================

const Presentation = ({ 
  cvText, 
  changes, 
  score, 
  onBack, 
  apiKey, 
  selectedVoice, 
  improvedCV, 
  keywordSnapshot,
  decisions,
  onDecisionChange,
  onApplyAll
}) => {
  const [currentSlide, setCurrentSlide] = useState(-1);
  const [phase, setPhase] = useState('intro');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  const { playTransition, playHighlight, speak, prefetchSpeech, stop, isSpeaking, isLoading } = useAudioSystem(apiKey);
  const timeoutRef = useRef(null);

  const newScore = Math.min(95, score + Math.round(changes.length * 5));
  const isOutro = currentSlide === changes.length;

  const clearTimeouts = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

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
      playHighlight(change.type);
      
      // Phase 3: Show before-after comparison visually
      timeoutRef.current = setTimeout(() => {
        setPhase('before-after');
        // Start pulling down audio while the visuals are animating
        if (audioEnabled) {
          //prefetchSpeech(script.categoryIntro, selectedVoice, 1.0);
          prefetchSpeech(script.mainExplanation, selectedVoice, 1.0);
        }
        
        // Phase 4: After visual elements are shown, START audio narration
        timeoutRef.current = setTimeout(() => {
          if (audioEnabled) {
            const handleImpact = () => {
              setPhase('impact');
              if (nextScript) {
                //prefetchSpeech(nextScript.categoryIntro, selectedVoice, 1.0);
              }
              
              speak("", () => {
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
              }, selectedVoice, 1.0);
            };

            speak("", () => {
              prefetchSpeech(script.impact, selectedVoice, 1.0);
              speak(script.mainExplanation, () => {
                handleImpact();
              }, selectedVoice, 1.0);
            }, selectedVoice, 1.0);
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
        }, 800); // Wait 800ms after showing before-after, then start audio
        
      }, 1000); // Wait 1s to show before-after after highlight
      
    }, 500); // Wait 500ms to show highlight after intro
    
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

  const handleStart = () => {
    setIsPlaying(true);
  
    setCurrentSlide(0);
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
  };

  if (isOutro) {
    return (
      <div className="fixed inset-0 bg-slate-50 text-slate-900">
        <div className="flex h-full gap-4 px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex-1 min-w-0 overflow-y-auto pr-1">
            <div className="max-w-5xl w-full mx-auto space-y-6 pb-10">
              <OutroSlide
                isActive
                score={score}
                newScore={newScore}
                totalChanges={changes.length}
                onRestart={handleRestart}
                onBack={onBack}
                improvedCV={improvedCV || cvText}
                keywordSnapshot={keywordSnapshot}
                onApplyAll={onApplyAll}
              />
            </div>
          </div>
          <div className="w-[320px] sm:w-[360px] lg:w-[420px] overflow-y-auto pl-1">
            <SuggestionReviewPanel
              open
              variant="inline"
              suggestions={changes}
              decisions={decisions}
              onDecisionChange={onDecisionChange}
              onApplyAll={onApplyAll}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white text-slate-900 overflow-hidden">

      <div className="relative w-full h-full">
        <IntroSlide 
          isActive={currentSlide === -1} 
          score={score} 
          totalChanges={changes.length}
          onStart={handleStart}
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

      {/* Controls */}
      {currentSlide >= 0 && currentSlide < changes.length && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-2 bg-white rounded-2xl border border-emerald-100 shadow-xl shadow-emerald-50">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <div className="w-px h-8 bg-emerald-100 mx-2" />

          <button onClick={handlePrev} disabled={currentSlide <= -1} className="w-8 h-8 rounded-xl bg-white hover:bg-emerald-50 disabled:opacity-40 flex items-center justify-center text-slate-700 transition-all border border-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button 
            onClick={isPlaying ? handlePause : handleResume}
            className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all shadow-lg ${isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
          >
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>
          
          <button onClick={handleNext} disabled={currentSlide >= changes.length} className="w-10 h-10 rounded-xl bg-white hover:bg-emerald-50 disabled:opacity-40 flex items-center justify-center text-slate-700 transition-all border border-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="w-px h-8 bg-emerald-100 mx-2" />

          <button 
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${audioEnabled ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200'}`}
          >
            {audioEnabled ? '🔊' : '🔇'}
          </button>

          <div className="w-px h-8 bg-emerald-100 mx-2" />

          <div className="text-slate-600 text-sm">
            <span className="text-slate-900 font-bold">{currentSlide + 1}</span> / {changes.length}
          </div>

          <div className="w-px h-8 bg-emerald-100 mx-2" />
        </div>
      )}


      {/* Speaking/Loading indicator */}
      {(isSpeaking || isLoading) && (
        <div className={`absolute top-6 right-6 flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm ${isLoading ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          {isLoading ? (
            <>
              <svg className="w-4 h-4 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-amber-800 text-sm font-medium">Generating audio...</span>
            </>
          ) : (
            <>
              <div className="flex gap-1">
                <div className="w-1 h-4 bg-emerald-600 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-6 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-4 bg-emerald-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-emerald-800 text-sm font-medium">Speaking...</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// INPUT VIEW
// ============================================

const InputView = ({ onAnalyze, isLoading, progress }) => {
  const [cvText, setCvText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiProvider, setApiProvider] = useState('openai');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('onyx');
  const progressStage = progress?.stage || (isLoading ? 'keywords' : 'idle');
  const totalKeywords = typeof progress?.totalKeywords === 'number' ? progress.totalKeywords : null;
  const matchedKeywords = typeof progress?.matchedKeywords === 'number' ? progress.matchedKeywords : null;
  const matchedKeywordsList = progress?.matchedKeywordsList || [];
  const missingKeywords = progress?.missingKeywords || [];
  const missingPreview = missingKeywords.slice(0, 5);
  const hasMoreMissing = missingKeywords.length > missingPreview.length;
  const stageRank = { keywords: 1, generating: 2, done: 3 };
  const currentStageRank = stageRank[progressStage] || 1;
  const hasKeywordData = totalKeywords !== null || matchedKeywords !== null || missingKeywords.length > 0;
  const isGenerating = currentStageRank >= 2;
  const isDone = currentStageRank >= 3;
  const statusMessage = progress?.message || 'Analyzing your CV and job description...';
  const [showAllMissing, setShowAllMissing] = useState(false);
  const missingDisplay = showAllMissing ? missingKeywords : missingPreview;
  const hasMoreMatched = matchedKeywordsList.length > 5;
  const matchedPreview = hasMoreMatched ? matchedKeywordsList.slice(0, 5) : matchedKeywordsList;

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
            This view will switch to the walkthrough as soon as the analysis finishes.
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
    <div className="min-h-screen bg-white px-6 py-10 flex items-center justify-center text-slate-900">
      <div className="max-w-4xl w-full">
        
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 px-5 py-2.5">
            <span className="font-bold text-lg">Get a Personalized CV Walkthrough</span>
          </div>
          <div className="inline-flex items-center gap-3 px-5 py-2.5">
            <p className="text-center text-slate-500 text-xs mt-6">
          Note: OpenAI API key is used for both CV analysis (GPT-5.2) and voice narration (TTS). 
          For Anthropic analysis, you'll still need an OpenAI key for TTS.
        </p>
        </div>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-3xl border border-emerald-100 shadow-xl shadow-emerald-50 p-8 space-y-6">
          
          {/* API Settings */}
          <div className="grid grid-cols-2 gap-4">
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
                API Key <span className="text-slate-500 font-normal">(used for analysis & TTS)</span>
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

          {/* Voice Selection */}
          <div>
            <label className="block text-slate-700 text-sm font-semibold mb-2">
              Narrator Voice <span className="text-slate-500 font-normal">(OpenAI TTS)</span>
            </label>
            <VoiceSelector selectedVoice={selectedVoice} onVoiceChange={setSelectedVoice} />
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-semibold mb-2">Job Description</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job posting you're applying to..."
              className="w-full h-36 p-4 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none resize-none transition"
            />
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-semibold mb-2">Your CV / Resume</label>
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste your CV content here..."
              className="w-full h-48 p-4 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none resize-none transition font-mono text-sm"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => { setCvText(sampleCV); setJobDescription(sampleJob); }}
              className="text-emerald-600 hover:text-emerald-500 text-sm font-medium transition-colors"
            >
              Load sample data →
            </button>

            <button
              onClick={handleSubmit}
              disabled={!cvText.trim() || !jobDescription.trim() || !apiKey.trim() || isLoading}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 disabled:shadow-none transition-all flex items-center gap-3"
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

      </div>
    </div>
  );
};

// ============================================
// MAIN APP
// ============================================

export default function App() {
  const [view, setView] = useState('input');
  const [cvText, setCvText] = useState('');
  const [changes, setChanges] = useState([]);
  const [score, setScore] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('onyx');
  const [logs, setLogs] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [improvedCV, setImprovedCV] = useState('');
  const [keywordSnapshot, setKeywordSnapshot] = useState(null);
  const [proposedCV, setProposedCV] = useState('');
  const [proposedKeywordSnapshot, setProposedKeywordSnapshot] = useState(null);
  const [suggestionDecisions, setSuggestionDecisions] = useState({});
  const [validatedKeywords, setValidatedKeywords] = useState(null);

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

  const handleAnalyze = async (cv, job, key, apiProvider, voice) => {
    setIsLoading(true);
    setError(null);
    setCvText(cv);
    setApiKey(key);
    setSelectedVoice(voice);
    setImprovedCV(cv);
    setKeywordSnapshot(null);
    setProposedCV('');
    setProposedKeywordSnapshot(null);
    setSuggestionDecisions({});
    setValidatedKeywords(null);
    setAnalysisProgress({
      stage: 'keywords',
      totalKeywords: null,
      matchedKeywords: null,
      missingKeywords: [],
      message: 'Scanning the job description for critical keywords...'
    });

    try {
      const result = await analyzeCV(cv, job, key, apiProvider, addLogEntry, (progressUpdate) => {
        setAnalysisProgress((prev) => ({
          ...(prev || {}),
          ...progressUpdate
        }));
      });
      setChanges(result.suggestions);
      setScore(result.score);
      setSuggestionDecisions(
        Object.fromEntries((result.suggestions || []).map((s) => [s.id, 'pending']))
      );
      setValidatedKeywords(result.validatedKeywords || null);

      const { text: proposedText } = applySuggestionsToCV(cv, result.suggestions);
      setProposedCV(proposedText);
      const missingAfterProposed = computeMissingKeywordsAfter(result.validatedKeywords?.inJob, proposedText);
      setProposedKeywordSnapshot({
        total: result.validatedKeywords?.inJob?.length || 0,
        before: result.validatedKeywords?.missing?.length || 0,
        after: missingAfterProposed.length,
        missingBeforeList: result.validatedKeywords?.missing || [],
        missingAfterList: missingAfterProposed
      });
      setImprovedCV(cv); // applied version reflects user choices later
      setView('presentation');
      setAnalysisProgress(null);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please check your API key and try again.');
      setAnalysisProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setView('input');
    setChanges([]);
    setAnalysisProgress(null);
    setImprovedCV('');
    setKeywordSnapshot(null);
    setProposedCV('');
    setProposedKeywordSnapshot(null);
    setSuggestionDecisions({});
    setValidatedKeywords(null);
  };

  useEffect(() => {
    if (!cvText) {
      setImprovedCV('');
      setKeywordSnapshot(null);
      setProposedCV('');
      setProposedKeywordSnapshot(null);
      return;
    }

    const appliedChanges = changes.filter((change) => {
      const decision = suggestionDecisions[change.id] || 'pending';
      return decision !== 'rejected' && decision !== 'skipped';
    });

    const { text: improvedText } = applySuggestionsToCV(cvText, appliedChanges);
    setImprovedCV(improvedText);

    if (validatedKeywords) {
      const missingAfter = computeMissingKeywordsAfter(validatedKeywords.inJob, improvedText);
      setKeywordSnapshot({
        total: validatedKeywords.inJob?.length || 0,
        before: validatedKeywords.missing?.length || 0,
        after: missingAfter.length,
        missingBeforeList: validatedKeywords.missing || [],
        missingAfterList: missingAfter
      });
    } else {
      setKeywordSnapshot(null);
    }
  }, [changes, suggestionDecisions, cvText, validatedKeywords]);

  const handleDecisionChange = (id, decision) => {
    setSuggestionDecisions((prev) => ({
      ...prev,
      [id]: decision
    }));
  };

  const handleApplyAll = () => {
    setSuggestionDecisions((prev) => {
      const next = { ...prev };
      changes.forEach((change) => {
        next[change.id] = 'accepted';
      });
      return next;
    });
  };

  const showPresentation = view === 'presentation' && changes.length > 0;
  const displayKeywordSnapshot = keywordSnapshot || proposedKeywordSnapshot;
  const displayImprovedCV = improvedCV || proposedCV || cvText;

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
          decisions={suggestionDecisions}
          onDecisionChange={handleDecisionChange}
          onApplyAll={handleApplyAll}
        />
      ) : (
        <InputView onAnalyze={handleAnalyze} isLoading={isLoading} progress={analysisProgress} />
      )}
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
