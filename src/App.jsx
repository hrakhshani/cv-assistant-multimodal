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

const extractKeywords = async (jobDescription, apiKey, apiProvider = 'anthropic') => {
  const prompt = `Given the following job description, identify the most important keywords and phrases that would increase a candidate's chances during the interview process.

Focus on:
- Technical skills and tools
- Methodologies and frameworks
- Industry-specific terminology
- Soft skills explicitly mentioned
- Required qualifications and certifications

Return ONLY a JSON array of keywords, nothing else:
["keyword1", "keyword2", ...]

JOB DESCRIPTION:
${jobDescription}`;

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
          model: 'claude-sonnet-4-20250514',
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
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      content = data.choices?.[0]?.message?.content || '';
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in keyword response');
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
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

const analyzeCV = async (cvText, jobDescription, apiKey, apiProvider = 'anthropic') => {
  // Step 1: Extract keywords from job description
  const rawKeywords = await extractKeywords(jobDescription, apiKey, apiProvider);
  
  // Step 2: Validate keywords actually appear in the text
  const validatedKeywords = validateKeywords(rawKeywords, jobDescription, cvText);
  
  const keywordsInJob = validatedKeywords.filter(k => k.inJobDescription).map(k => k.keyword);
  const keywordsInCV = validatedKeywords.filter(k => k.inCV).map(k => k.keyword);
  const missingKeywords = validatedKeywords.filter(k => k.inJobDescription && !k.inCV).map(k => k.keyword);

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
          model: 'claude-sonnet-4-20250514',
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
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      content = data.choices?.[0]?.message?.content || '';
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const result = JSON.parse(jsonMatch[0]);

    // Validate that original text actually exists in CV
    const validated = result.suggestions
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
    console.error('CV Analysis Error:', error);
    throw error;
  }
};

//export { analyzeCV, extractKeywords, validateKeywords };

// ============================================
// OPENAI TEXT-TO-SPEECH API
// ============================================

const generateSpeech = async (text, apiKey, voice = 'onyx', speed = 1.2) => {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
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

  const speak = useCallback(async (text, onEnd, voice = 'onyx', speed = 1.4) => {
    if (!apiKey) {
      console.warn('No API key provided for TTS');
      onEnd?.();
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setIsSpeaking(false);

    try {
      const audioUrl = await generateSpeech(text, apiKey, voice, speed);
      
      // Check if we were aborted while waiting
      if (abortControllerRef.current?.signal.aborted) {
        URL.revokeObjectURL(audioUrl);
        return;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsLoading(false);
        setIsSpeaking(true);
      };

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        onEnd?.();
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsLoading(false);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
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
  }, [apiKey]);

  const stop = useCallback(() => {
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return { playTone, playTransition, playHighlight, speak, stop, isSpeaking, isLoading };
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

const IntroSlide = ({ isActive, score, totalChanges, onStart }) => {
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
          🔊 OpenAI TTS narration • Takes about {Math.ceil(totalChanges * 0.5)} minutes
        </p>
      </div>
    </div>
  );
};

// ============================================
// OUTRO SLIDE
// ============================================

const OutroSlide = ({ isActive, score, newScore, totalChanges, onRestart, onBack }) => {
  return (
    <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="text-center max-w-2xl px-8">
        
        {/* Success animation */}
        <div className="mb-8">
          <div className="w-32 h-32 mx-auto rounded-full flex items-center justify-center shadow-2xl shadow-emerald-100 animate-pulse">
            <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <h1 className="text-5xl font-bold text-slate-900 mb-4">
          Walkthrough Complete! 🎉
        </h1>
        
        <p className="text-xl text-slate-600 mb-8">
          Apply these <span className="text-emerald-600 font-bold">{totalChanges} changes</span> to transform your CV
        </p>

        {/* Score comparison */}
        <div className="flex items-center justify-center gap-8 mb-10">
          <div className="text-center">
            <div className="text-4xl font-bold text-slate-500">{score}%</div>
            <div className="text-slate-400 text-sm">Before</div>
          </div>
          <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <div className="text-center">
            <div className="text-5xl font-bold text-emerald-600">{newScore}%</div>
            <div className="text-emerald-500 text-sm">Projected</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-white border border-emerald-100 hover:border-emerald-200 text-slate-700 font-semibold rounded-xl transition-all shadow-sm"
          >
            ← Analyze Another CV
          </button>
          <button
            onClick={onRestart}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Watch Again
          </button>
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
// MAIN PRESENTATION COMPONENT
// ============================================

const Presentation = ({ cvText, changes, score, onBack, apiKey, selectedVoice }) => {
  const [currentSlide, setCurrentSlide] = useState(-1);
  const [phase, setPhase] = useState('intro');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  const { playTransition, playHighlight, speak, stop, isSpeaking, isLoading } = useAudioSystem(apiKey);
  const timeoutRef = useRef(null);

  const newScore = Math.min(95, score + Math.round(changes.length * 5));

  const clearTimeouts = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const runSlideSequence = useCallback((slideIndex) => {
    if (slideIndex < 0 || slideIndex >= changes.length) return;
    
    const change = changes[slideIndex];
    const script = generateScript(change, slideIndex, changes.length, score);
    
    // Phase 1: Show the slide intro immediately
    setPhase('intro');
    
    timeoutRef.current = setTimeout(() => {
      // Phase 2: Show the highlight/modification visually first
      setPhase('highlight');
      playHighlight(change.type);
      
      // Phase 3: Show before-after comparison visually
      timeoutRef.current = setTimeout(() => {
        setPhase('before-after');
        
        // Phase 4: After visual elements are shown, START audio narration
        timeoutRef.current = setTimeout(() => {
          if (audioEnabled) {
            // Now speak the category intro
            speak(script.categoryIntro, () => {
              // Then the main explanation
              speak(script.mainExplanation, () => {
                // Show impact phase
                setPhase('impact');
                
                // Speak the impact
                speak(script.impact, () => {
                  // Move to next slide or finish
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
    
  }, [changes, score, audioEnabled, isPlaying, playHighlight, speak, selectedVoice]);

  useEffect(() => {
    if (currentSlide >= 0 && currentSlide < changes.length) {
      runSlideSequence(currentSlide);
    }
    return clearTimeouts;
  }, [currentSlide]);

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

  return (
    <div className="fixed inset-0 bg-white overflow-hidden text-slate-900">
      
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

        <OutroSlide
          isActive={currentSlide === changes.length}
          score={score}
          newScore={newScore}
          totalChanges={changes.length}
          onRestart={handleRestart}
          onBack={onBack}
        />
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

const InputView = ({ onAnalyze, isLoading }) => {
  const [cvText, setCvText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiProvider, setApiProvider] = useState('openai');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('onyx');

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
          Note: OpenAI API key is used for both CV analysis (GPT-4o) and voice narration (TTS). 
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
                <option value="openai">OpenAI (GPT-4o)</option>
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

  const handleAnalyze = async (cv, job, key, apiProvider, voice) => {
    setIsLoading(true);
    setError(null);
    setCvText(cv);
    setApiKey(key);
    setSelectedVoice(voice);

    try {
      const result = await analyzeCV(cv, job, key, apiProvider);
      setChanges(result.suggestions);
      setScore(result.score);
      setView('presentation');
    } catch (err) {
      setError(err.message || 'Analysis failed. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setView('input');
    setChanges([]);
  };

  if (view === 'presentation' && changes.length > 0) {
    return (
      <Presentation 
        cvText={cvText} 
        changes={changes} 
        score={score} 
        onBack={handleBack} 
        apiKey={apiKey}
        selectedVoice={selectedVoice}
      />
    );
  }

  return (
    <>
      <InputView onAnalyze={handleAnalyze} isLoading={isLoading} />
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 max-w-lg">
          <span>⚠️</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="hover:bg-white/20 rounded-lg p-1">✕</button>
        </div>
      )}
    </>
  );
}
