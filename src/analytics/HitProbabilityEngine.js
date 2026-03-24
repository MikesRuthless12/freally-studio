// HitProbabilityEngine.js — Estimate commercial viability using heuristic scoring

import { scoreHook } from '../lyrics/HookOptimizer';
import { countSyllables } from '../lyrics/ProsodyAlignEngine';

// Genre trend weights — how commercially active each genre currently is (heuristic)
const GENRE_TREND_WEIGHTS = {
    pop: 0.95, hip_hop: 0.90, rap: 0.90, rnb: 0.80, r_and_b: 0.80,
    latin: 0.85, reggaeton: 0.85, afrobeat: 0.80, electronic: 0.75,
    edm: 0.75, dance: 0.75, rock: 0.60, country: 0.70, indie: 0.55,
    folk: 0.45, jazz: 0.40, classical: 0.30, metal: 0.35, punk: 0.35,
    soul: 0.60, funk: 0.55, blues: 0.40, gospel: 0.45, ambient: 0.30,
    trap: 0.85, drill: 0.80, house: 0.70, techno: 0.55, lo_fi: 0.65
};

/**
 * Calculate simplicity score based on word length and syllable count.
 */
function calcSimplicity(lines) {
    let totalSyl = 0;
    let totalWords = 0;
    for (const line of lines) {
        const words = line.split(/\s+/).filter(Boolean);
        totalWords += words.length;
        for (const w of words) totalSyl += countSyllables(w);
    }
    if (totalWords === 0) return 0;
    const avgSyl = totalSyl / totalWords;
    // Sweet spot: 1.3-1.8 syllables per word
    return Math.max(0, Math.min(1, 1 - Math.abs(avgSyl - 1.5) * 0.6));
}

/**
 * Calculate emotional clarity — percentage of words that carry emotional weight.
 */
const EMOTION_WORDS = new Set([
    'love', 'heart', 'soul', 'fire', 'dream', 'night', 'light', 'burn',
    'fly', 'fall', 'rise', 'break', 'free', 'alive', 'forever', 'never',
    'always', 'baby', 'hold', 'feel', 'touch', 'cry', 'smile', 'dance',
    'hope', 'fear', 'pain', 'rain', 'sun', 'star', 'world', 'life',
    'breathe', 'believe', 'lost', 'found', 'home', 'gone', 'stay',
    'want', 'need', 'mine', 'wild', 'crazy', 'beautiful', 'strong',
    'dark', 'bright', 'deep', 'high', 'low', 'fast', 'slow', 'hot',
    'cold', 'real', 'true', 'fake', 'new', 'old', 'young', 'gold',
    // French
    'amour', 'coeur', 'ame', 'feu', 'reve', 'nuit', 'lumiere', 'flamme',
    'voler', 'tomber', 'libre', 'vivant', 'toujours', 'jamais', 'sentir',
    'danser', 'espoir', 'douleur', 'soleil', 'etoile', 'monde', 'vie',
    'croire', 'perdu', 'seul', 'fort', 'beau', 'passion', 'desir',
    // Spanish
    'amor', 'corazon', 'alma', 'fuego', 'sueno', 'noche', 'luz', 'llama',
    'volar', 'caer', 'libre', 'vivo', 'siempre', 'nunca', 'sentir',
    'bailar', 'esperanza', 'dolor', 'sol', 'estrella', 'mundo', 'vida',
    // German
    'liebe', 'herz', 'seele', 'feuer', 'traum', 'nacht', 'licht', 'flamme',
    'fliegen', 'fallen', 'frei', 'lebendig', 'immer', 'nie', 'stark',
    // Portuguese
    'coracao', 'sonho', 'noite', 'fogo', 'estrela', 'danca', 'esperanca',
    // Italian
    'cuore', 'anima', 'fuoco', 'sogno', 'notte', 'luce', 'fiamma', 'amore',
    // Japanese (common lyric words in romaji-ish)
    // Korean/Chinese/Russian/Arabic — these use non-Latin scripts, emotion detection
    // works via vocabulary density check below instead of word matching
]);

function calcEmotionalClarity(lines) {
    let emotional = 0;
    let total = 0;
    for (const line of lines) {
        const words = line.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
        total += words.length;
        for (const w of words) {
            if (EMOTION_WORDS.has(w)) emotional++;
        }
    }
    if (total === 0) return 0;
    return Math.min(1, (emotional / total) * 3.5);
}

/**
 * Calculate repetition balance — not too little, not too much.
 */
function calcRepetitionBalance(lines) {
    if (lines.length <= 1) return 0.5;
    const wordCounts = {};
    let totalWords = 0;
    for (const line of lines) {
        const words = line.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
        totalWords += words.length;
        for (const w of words) wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
    if (totalWords === 0) return 0;
    const uniqueRatio = Object.keys(wordCounts).length / totalWords;
    // Sweet spot: 40-70% unique words
    if (uniqueRatio >= 0.4 && uniqueRatio <= 0.7) return 1;
    if (uniqueRatio < 0.4) return uniqueRatio / 0.4; // too repetitive
    return Math.max(0, 1 - (uniqueRatio - 0.7) * 3); // too unique
}

/**
 * Calculate flow consistency — line length variance.
 * Consistent line lengths = better flow.
 */
function calcFlowConsistency(lines) {
    if (lines.length <= 1) return 1;
    const lengths = lines.map(l => l.trim().split(/\s+/).filter(Boolean).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    if (avg === 0) return 0;
    const variance = lengths.reduce((s, l) => s + Math.pow(l - avg, 2), 0) / lengths.length;
    const cv = Math.sqrt(variance) / avg; // coefficient of variation
    // Low CV = consistent = good
    return Math.max(0, Math.min(1, 1 - cv));
}

/**
 * Calculate originality index — lexical uniqueness.
 * Ratio of unique words to total, penalizing very common filler words.
 */
const FILLER_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'and',
    'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'each', 'it', 'its',
    'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'us', 'our',
    'you', 'your', 'he', 'she', 'they', 'them', 'his', 'her', 'just', 'like'
]);

function calcOriginalityIndex(lines) {
    const allWords = [];
    for (const line of lines) {
        const words = line.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
        allWords.push(...words);
    }
    if (allWords.length === 0) return 0;
    const contentWords = allWords.filter(w => !FILLER_WORDS.has(w));
    const uniqueContent = new Set(contentWords);
    if (contentWords.length === 0) return 0;
    return Math.min(1, uniqueContent.size / contentWords.length);
}

/**
 * Get genre trend weight. Normalizes genre string and looks up weight.
 */
function getGenreTrendWeight(genre) {
    if (!genre) return 0.5;
    const normalized = genre.toLowerCase().replace(/[\s-]+/g, '_');
    // Try exact match first, then partial
    if (GENRE_TREND_WEIGHTS[normalized] != null) return GENRE_TREND_WEIGHTS[normalized];
    for (const [key, val] of Object.entries(GENRE_TREND_WEIGHTS)) {
        if (normalized.includes(key) || key.includes(normalized)) return val;
    }
    return 0.5; // Default for unknown genres
}

/**
 * Calculate hit probability for a set of lyric lines.
 *
 * @param {string[]} lines - Array of lyric lines
 * @param {object} options - { genre, mood, energyLevel }
 * @returns {{ hitProbabilityPercent, strengths, weaknesses, improvementSuggestions, breakdown }}
 */
export function calculateHitProbability(lines, options = {}) {
    if (!lines || lines.length === 0) {
        return {
            hitProbabilityPercent: 0,
            strengths: [],
            weaknesses: ['No lyrics provided'],
            improvementSuggestions: ['Add some lyrics to analyze'],
            breakdown: {}
        };
    }

    const filtered = lines.filter(l => l.trim().length > 0);
    if (filtered.length === 0) {
        return {
            hitProbabilityPercent: 0,
            strengths: [],
            weaknesses: ['All lines are empty'],
            improvementSuggestions: ['Write some lyrics'],
            breakdown: {}
        };
    }

    const { genre, mood, energyLevel } = options;

    // Calculate individual metrics
    const hookScoreData = scoreHook(filtered);
    const hookScore = hookScoreData.total;
    const simplicity = calcSimplicity(filtered);
    const emotionalClarity = calcEmotionalClarity(filtered);
    const repetitionBalance = calcRepetitionBalance(filtered);
    const genreTrendWeight = getGenreTrendWeight(genre);
    const flowConsistency = calcFlowConsistency(filtered);
    const originalityIndex = calcOriginalityIndex(filtered);

    // Weighted composite score
    const hitScore =
        hookScore * 0.25 +
        simplicity * 0.15 +
        emotionalClarity * 0.15 +
        repetitionBalance * 0.10 +
        genreTrendWeight * 0.15 +
        flowConsistency * 0.10 +
        originalityIndex * 0.10;

    const hitProbabilityPercent = Math.round(hitScore * 100);

    // Analyze strengths and weaknesses
    const strengths = [];
    const weaknesses = [];
    const improvementSuggestions = [];

    const metrics = [
        { name: 'Hook Strength', value: hookScore, threshold: 0.6 },
        { name: 'Simplicity', value: simplicity, threshold: 0.5 },
        { name: 'Emotional Clarity', value: emotionalClarity, threshold: 0.5 },
        { name: 'Repetition Balance', value: repetitionBalance, threshold: 0.5 },
        { name: 'Genre Trend', value: genreTrendWeight, threshold: 0.6 },
        { name: 'Flow Consistency', value: flowConsistency, threshold: 0.5 },
        { name: 'Originality', value: originalityIndex, threshold: 0.4 }
    ];

    for (const m of metrics) {
        if (m.value >= m.threshold) {
            strengths.push(`${m.name}: ${Math.round(m.value * 100)}%`);
        } else {
            weaknesses.push(`${m.name}: ${Math.round(m.value * 100)}%`);
        }
    }

    // Generate suggestions based on low scores
    if (hookScore < 0.5) improvementSuggestions.push('Strengthen the hook with more repetition and simpler phrasing');
    if (simplicity < 0.5) improvementSuggestions.push('Use shorter, simpler words for better singability');
    if (emotionalClarity < 0.4) improvementSuggestions.push('Add more emotionally resonant words (love, dream, fire, etc.)');
    if (repetitionBalance < 0.4) improvementSuggestions.push('Balance repetition — repeat key phrases but keep enough variety');
    if (flowConsistency < 0.4) improvementSuggestions.push('Even out line lengths for smoother flow');
    if (originalityIndex < 0.3) improvementSuggestions.push('Increase vocabulary variety — avoid overusing the same content words');
    if (originalityIndex > 0.9) improvementSuggestions.push('Add some strategic repetition of key phrases');

    if (improvementSuggestions.length === 0) {
        improvementSuggestions.push('Lyrics are scoring well across all metrics!');
    }

    return {
        hitProbabilityPercent,
        strengths,
        weaknesses,
        improvementSuggestions,
        breakdown: {
            hookScore: Math.round(hookScore * 100),
            simplicity: Math.round(simplicity * 100),
            emotionalClarity: Math.round(emotionalClarity * 100),
            repetitionBalance: Math.round(repetitionBalance * 100),
            genreTrendWeight: Math.round(genreTrendWeight * 100),
            flowConsistency: Math.round(flowConsistency * 100),
            originalityIndex: Math.round(originalityIndex * 100)
        }
    };
}
