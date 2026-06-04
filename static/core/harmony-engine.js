import { detectChord } from './chord-detection.js';
import { HARMONY_CONFIG } from './constants.js';

export class HarmonyEngine {
    constructor() {
        this.physicalNotes = new Set();
        this.noteHistory = [];
        this.lastStableChord = null;
        this.lastActiveTime = Date.now();
        this.config = {
            historySize: HARMONY_CONFIG.HISTORY_SIZE,
            sustainTime: HARMONY_CONFIG.SUSTAIN_WITHOUT_NOTES_MS,
            allowedQualities: null
        };
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    noteOn(note, velocity) {
        this.physicalNotes.add(note);
        this.addToHistory({
            note: note,
            timestamp: Date.now(),
            velocity: velocity,
            type: 'on'
        });
    }

    noteOff(note) {
        this.physicalNotes.delete(note);
    }

    addToHistory(event) {
        const lastEvent = this.noteHistory[this.noteHistory.length - 1];
        if (lastEvent && (event.timestamp - lastEvent.timestamp > HARMONY_CONFIG.MAX_HISTORY_AGE_MS)) {
            this.noteHistory = [];
        }
        this.noteHistory.push(event);
        if (this.noteHistory.length > this.config.historySize) {
            this.noteHistory.shift();
        }
    }

    getHarmonicState() {
        let result = null;
        const clusterResult = this.analyzeHistoryClusters();
        if (clusterResult.chord) {
            result = clusterResult;
        }

        if (result) {
            this.lastStableChord = result;
            this.lastActiveTime = Date.now();
            return result;
        } else {
            const timeSinceLastActive = Date.now() - this.lastActiveTime;
            if (this.lastStableChord && timeSinceLastActive < this.config.sustainTime) {
                return {
                    ...this.lastStableChord,
                    source: 'sustain_hold'
                };
            }
        }

        return { chord: null, notes: [] };
    }

    analyzeHistoryClusters() {
        if (this.noteHistory.length === 0 && this.physicalNotes.size === 0) {
            return { chord: null, notes: [] };
        }

        let bestCandidate = null;
        let maxScore = -1;

        const minClusterSize = 3;
        const maxClusterSize = this.noteHistory.length;

        for (let size = minClusterSize; size <= maxClusterSize; size++) {
            const clusterEvents = this.noteHistory.slice(-size);
            const uniqueNotes = new Set();

            this.physicalNotes.forEach(n => uniqueNotes.add(n));
            clusterEvents.forEach(e => uniqueNotes.add(e.note));

            const notesArray = Array.from(uniqueNotes).sort((a, b) => a - b);
            const chordName = detectChord(notesArray, this.config.allowedQualities);

            if (chordName && chordName !== "Unknown" && chordName !== "...") {
                const score = this.calculateScore(clusterEvents, chordName, notesArray);
                if (score > maxScore) {
                    maxScore = score;
                    bestCandidate = {
                        chord: chordName,
                        notes: notesArray,
                        source: 'history_cluster',
                        size: size
                    };
                }
            }
        }

        return bestCandidate || { chord: null, notes: [] };
    }

    calculateScore(events, chordName, notesArray) {
        let score = 0;
        const lastHistoryEvent = this.noteHistory[this.noteHistory.length - 1];
        const referenceTime = lastHistoryEvent ? lastHistoryEvent.timestamp : Date.now();

        events.forEach((event, index) => {
            const positionWeight = 0.5 + (index / events.length);
            const isVeryRecent = (referenceTime - event.timestamp) < 500;
            const recentBonus = isVeryRecent ? 2.0 : 0;
            score += (1 * positionWeight) + recentBonus;
        });

        if (lastHistoryEvent) {
            if (notesArray.includes(lastHistoryEvent.note)) {
                score += 10.0;
            } else {
                score -= 20.0;
            }
        }

        if (chordName.includes("7") || chordName.includes("9")) {
            score += 0.5;
        }

        const rootNoteMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        const rootChar = chordName.charAt(0);
        const hasSharp = chordName.length > 1 && chordName.charAt(1) === '#';
        let rootPitch = rootNoteMap[rootChar];
        if (hasSharp) rootPitch = (rootPitch + 1) % 12;

        const bassNote = notesArray[0];
        const bassPitch = bassNote % 12;

        if (bassPitch === rootPitch) {
            score += 2.0;
        }

        return score;
    }

    reset() {
        this.physicalNotes.clear();
        this.noteHistory = [];
    }
}
