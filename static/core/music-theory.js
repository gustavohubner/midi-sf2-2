export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getNoteIndex(midiNumber) {
    return midiNumber % 12;
}

export function midiToNoteName(midiNumber) {
    const noteIndex = getNoteIndex(midiNumber);
    const octave = Math.floor(midiNumber / 12) - 1;
    return `${NOTE_NAMES[noteIndex]}${octave}`;
}
