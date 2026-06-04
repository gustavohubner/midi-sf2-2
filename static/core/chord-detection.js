import { midiToNoteName, getNoteIndex, NOTE_NAMES } from './music-theory.js';

const CHORD_DEFINITIONS = [
    { name: "m11", intervals: [0, 2, 3, 5, 7, 10] },
    { name: "13", intervals: [0, 2, 4, 9, 10] },
    { name: "M7(#11)", intervals: [0, 4, 6, 7, 11] },
    { name: "m7(11)", intervals: [0, 3, 5, 7, 10] },
    { name: "7b9", intervals: [0, 1, 4, 7, 10] },
    { name: "9", intervals: [0, 2, 4, 7, 10] },
    { name: "M9", intervals: [0, 2, 4, 7, 11] },
    { name: "m9", intervals: [0, 2, 3, 7, 10] },
    { name: "6/9", intervals: [0, 2, 4, 7, 9] },
    { name: "m6/9", intervals: [0, 2, 3, 7, 9] },
    { name: "11", intervals: [0, 2, 5, 10] },
    { name: "5(6/9)", intervals: [0, 2, 7, 9] },
    { name: "add9", intervals: [0, 2, 4, 7] },
    { name: "m(add9)", intervals: [0, 2, 3, 7] },
    { name: "7", intervals: [0, 4, 7, 10] },
    { name: "M7", intervals: [0, 4, 7, 11] },
    { name: "m7", intervals: [0, 3, 7, 10] },
    { name: "dim7", intervals: [0, 3, 6, 9] },
    { name: "m(maj7)", intervals: [0, 3, 7, 11] },
    { name: "7sus4", intervals: [0, 5, 7, 10] },
    { name: "6", intervals: [0, 4, 7, 9] },
    { name: "m6", intervals: [0, 3, 7, 9] },
    { name: "m7(b5)", intervals: [0, 3, 6, 10] },
    { name: "", intervals: [0, 4, 7] },
    { name: "m", intervals: [0, 3, 7] },
    { name: "dim", intervals: [0, 3, 6] },
    { name: "aug", intervals: [0, 4, 8] },
    { name: "sus2", intervals: [0, 2, 7] },
    { name: "sus4", intervals: [0, 5, 7] },
    { name: "5", intervals: [0, 7] },
];

export const ALL_CHORD_QUALITIES = CHORD_DEFINITIONS.map(d => d.name);

export function detectChord(activeNotes, allowedQualities = null) {
    if (!activeNotes || activeNotes.length < 2) {
        return activeNotes.length > 0 ? "..." : "--";
    }

    const uniquePitches = [...new Set(activeNotes.map(getNoteIndex))].sort((a, b) => a - b);
    if (uniquePitches.length < 2) return "Unison";

    const bassMidi = activeNotes[0];
    const bassNoteIndex = getNoteIndex(bassMidi);
    const bassNoteName = NOTE_NAMES[bassNoteIndex];

    const sortedRoots = [
        bassNoteIndex,
        ...uniquePitches.filter(n => n !== bassNoteIndex)
    ];

    for (let root of sortedRoots) {
        const intervals = uniquePitches.map(pitch => (pitch - root + 12) % 12).sort((a, b) => a - b);
        const quality = identifyQuality(intervals, allowedQualities);

        if (quality !== null) {
            const requiredIntervals = getIntervalsForQuality(quality);
            const hasNoise = intervals.some(i => !requiredIntervals.includes(i));

            if (!hasNoise) {
                const rootName = NOTE_NAMES[root];
                let chordName = `${rootName}${quality}`;
                if (root !== bassNoteIndex) {
                    chordName += `/${bassNoteName}`;
                }
                return chordName;
            }
        }
    }

    return "Unknown";
}

function getIntervalsForQuality(quality) {
    const def = CHORD_DEFINITIONS.find(c => c.name === quality);
    return def ? def.intervals : [];
}

function identifyQuality(intervals, allowedQualities) {
    const intervalSet = new Set(intervals);
    const count = intervalSet.size;

    for (const def of CHORD_DEFINITIONS) {
        if (allowedQualities && !allowedQualities.includes(def.name)) continue;
        if (def.intervals.length > count) continue;

        const hasAll = def.intervals.every(i => intervalSet.has(i));
        if (hasAll) return def.name;
    }

    return null;
}
