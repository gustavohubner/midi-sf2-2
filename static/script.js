import { WorkletSynthesizer } from 'spessasynth_lib';
import { ALL_CHORD_QUALITIES } from './core/chord-detection.js';
import { HarmonyEngine } from './core/harmony-engine.js';

// ======================== STATE ========================
const state = {
    audioStarted: false,
    ctx: null,
    masterGain: null,
    layers: {
        piano: { synth: null, gain: null, enabled: true, octave: 0, longRelease: false, noSens: false, presets: [], presetIndex: 0, name: 'No File Loaded', eq: { low: null, mid: null, high: null }, filter: { lp: null, hp: null }, delay: { input: null, delay: null, feedback: null }, fx: { reverb: 0, chorus: 0, delayMix: 0, delayTime: 0.3, delayFdbk: 0.3 } },
        synth: { synth: null, gain: null, enabled: true, octave: 0, longRelease: true, noSens: true, presets: [], presetIndex: 0, name: 'No File Loaded', eq: { low: null, mid: null, high: null }, filter: { lp: null, hp: null }, delay: { input: null, delay: null, feedback: null }, fx: { reverb: 0, chorus: 0, delayMix: 0, delayTime: 0.3, delayFdbk: 0.3 } },
        bass: { synth: null, gain: null, enabled: true, octave: 0, longRelease: false, noSens: false, presets: [], presetIndex: 0, name: 'No File Loaded', eq: { low: null, mid: null, high: null }, filter: { lp: null, hp: null }, delay: { input: null, delay: null, feedback: null }, fx: { reverb: 0, chorus: 0, delayMix: 0, delayTime: 0.3, delayFdbk: 0.3 } },
    },
    mix: 50,
    masterVolume: 75,
    bassVolume: 75,
    bassSplitKey: 60,
    smartPadEnabled: false,
    harmonyEngine: new HarmonyEngine(),
    activeSmartPadNotes: new Set(),
    noSensVelocity: 96,
    longReleaseValue: 110,
    pianoPolyphony: 16,
    synthPolyphony: 16,
    bassPolyphony: 2,
    smartPadLatch: false,
    smartPadHistorySize: 12,
    allowedChordQualities: null,
    currentChord: "--",
};

function updateChordDisplay() {
    const el = $('chord-display');
    if (!el) return;
    if (state.smartPadEnabled) {
        el.style.display = '';
        el.textContent = state.currentChord || '--';
    } else {
        el.style.display = 'none';
    }
}

// Helper for "Sticky 50" snap-to-center slider
function fromSliderValue(val) {
    val = parseInt(val);
    if (val <= 50) return val;
    if (val <= 60) return 50;
    return val - 10;
}
function toSliderValue(val) {
    if (val < 50) return val;
    if (val === 50) return 55;
    return val + 10;
}

// ======================== PRESET SAVE/LOAD ========================
const PRESET_PREFIX = 'sf2workstation_';

function getPresetList() {
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PRESET_PREFIX)) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                list.push({ key, name: key.slice(PRESET_PREFIX.length), timestamp: data._timestamp || 0 });
            } catch (e) {}
        }
    }
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
}

function collectState() {
    const layers = ['piano', 'synth', 'bass'];
    return {
        masterVolume: parseInt(els.masterVol?.value ?? 75),
        bassVolume: parseInt(els.bassVol?.value ?? 75),
        pianoSynthMix: parseInt(els.pianoSynthMix?.value ?? 55),
        bassSplitKey: parseInt(els.bassSplit?.value ?? 60),
        smartPadEnabled: state.smartPadEnabled,
        layer: layers.map(name => {
            const l = state.layers[name];
            const el = els.layers[name];
            const fx = l.fx || {};
            return {
                enabled: l.enabled,
                octave: l.octave,
                longRelease: l.longRelease,
                noSens: l.noSens,
                presetIndex: l.presetIndex,
                eq: {
                    treble: parseInt(el?.eqTreble?.value ?? 55),
                    mid: parseInt(el?.eqMid?.value ?? 55),
                    bass: parseInt(el?.eqBass?.value ?? 55),
                    filter: parseInt(el?.eqFilter?.value ?? 55),
                },
                fx: {
                    reverb: fx.reverb ?? 0,
                    chorus: fx.chorus ?? 0,
                    delayMix: fx.delayMix ?? 0,
                    delayTime: fx.delayTime ?? 0.3,
                    delayFdbk: fx.delayFdbk ?? 0.3,
                },
            };
        }),
        _timestamp: Date.now(),
        longReleaseValue: state.longReleaseValue,
        noSensVelocity: state.noSensVelocity,
        pianoPolyphony: state.pianoPolyphony,
        synthPolyphony: state.synthPolyphony,
        bassPolyphony: state.bassPolyphony,
        smartPadLatch: state.smartPadLatch,
        smartPadHistorySize: state.smartPadHistorySize,
        allowedChordQualities: state.allowedChordQualities,
    };
}

function populatePresetSelect() {
    const sel = els.preset;
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';

    const opt = document.createElement('option');
    opt.value = '-1';
    opt.textContent = '[NEW PRESET]';
    sel.appendChild(opt);

    const list = getPresetList();
    list.forEach(p => {
        const o = document.createElement('option');
        o.value = p.name;
        o.textContent = p.name;
        sel.appendChild(o);
    });

    if (currentVal && [...sel.options].some(o => o.value === currentVal)) {
        sel.value = currentVal;
    } else {
        sel.value = '-1';
    }
}

async function loadPresetState(data) {
    const layers = ['piano', 'synth', 'bass'];

    if (typeof data.masterVolume !== 'undefined') {
        state.masterVolume = data.masterVolume;
        if (els.masterVol) els.masterVol.value = data.masterVolume;
        if (els.masterDisp) els.masterDisp.textContent = data.masterVolume + '%';
        if (state.masterGain) state.masterGain.gain.value = data.masterVolume / 100;
    }
    if (typeof data.bassVolume !== 'undefined') {
        state.bassVolume = data.bassVolume;
        if (els.bassVol) els.bassVol.value = data.bassVolume;
        if (els.bassDisp) els.bassDisp.textContent = data.bassVolume + '%';
        updateBassGain();
    }
    if (typeof data.pianoSynthMix !== 'undefined') {
        state.mix = fromSliderValue(data.pianoSynthMix);
        if (els.pianoSynthMix) els.pianoSynthMix.value = data.pianoSynthMix;
        updateMixGains();
    }
    if (typeof data.bassSplitKey !== 'undefined') {
        state.bassSplitKey = data.bassSplitKey;
        if (els.bassSplit) els.bassSplit.value = data.bassSplitKey;
    }
    if (typeof data.smartPadEnabled !== 'undefined') {
        state.smartPadEnabled = data.smartPadEnabled;
        const sp = els.layers.synth?.sp;
        if (sp) updateToggleBtn(sp, data.smartPadEnabled, 'bg-purple-600');
        updateChordDisplay();
    }

    // Restore global settings
    if (typeof data.longReleaseValue !== 'undefined') {
        state.longReleaseValue = data.longReleaseValue;
        const lr = $('settings-lr');
        const disp = $('settings-lr-disp');
        if (lr) lr.value = data.longReleaseValue;
        if (disp) disp.textContent = String(data.longReleaseValue);
    }
    if (typeof data.noSensVelocity !== 'undefined') {
        state.noSensVelocity = data.noSensVelocity;
        const nv = $('settings-nv');
        const disp = $('settings-nv-disp');
        if (nv) nv.value = data.noSensVelocity;
        if (disp) disp.textContent = String(data.noSensVelocity);
    }
    if (typeof data.pianoPolyphony !== 'undefined') {
        state.pianoPolyphony = data.pianoPolyphony;
        const el = $('settings-piano-poly');
        const disp = $('settings-piano-poly-disp');
        if (el) el.value = data.pianoPolyphony;
        if (disp) disp.textContent = data.pianoPolyphony + ' voices';
        applyPolyphony('piano', data.pianoPolyphony);
    }
    if (typeof data.synthPolyphony !== 'undefined') {
        state.synthPolyphony = data.synthPolyphony;
        const el = $('settings-synth-poly');
        const disp = $('settings-synth-poly-disp');
        if (el) el.value = data.synthPolyphony;
        if (disp) disp.textContent = data.synthPolyphony + ' voices';
        applyPolyphony('synth', data.synthPolyphony);
    }
    if (typeof data.bassPolyphony !== 'undefined') {
        state.bassPolyphony = data.bassPolyphony;
        const el = $('settings-bass-poly');
        const disp = $('settings-bass-poly-disp');
        if (el) el.value = data.bassPolyphony;
        if (disp) disp.textContent = data.bassPolyphony + ' voices';
        applyPolyphony('bass', data.bassPolyphony);
    }
    if (typeof data.smartPadLatch !== 'undefined') {
        state.smartPadLatch = data.smartPadLatch;
        const btn = $('settings-latch');
        if (btn) {
            btn.textContent = data.smartPadLatch ? 'ENABLED' : 'DISABLED';
            btn.classList.toggle('bg-purple-600', data.smartPadLatch);
            btn.classList.toggle('text-white', data.smartPadLatch);
            btn.classList.toggle('bg-gray-700', !data.smartPadLatch);
            btn.classList.toggle('text-gray-400', !data.smartPadLatch);
        }
    }
    if (typeof data.smartPadHistorySize !== 'undefined') {
        state.smartPadHistorySize = data.smartPadHistorySize;
        const el = $('settings-history');
        const disp = $('settings-history-disp');
        if (el) el.value = data.smartPadHistorySize;
        if (disp) disp.textContent = String(data.smartPadHistorySize);
    }
    if (typeof data.allowedChordQualities !== 'undefined') {
        state.allowedChordQualities = data.allowedChordQualities;
        restoreChordGridState();
    }
    updateHarmonyEngineConfig();

    for (let i = 0; i < 3; i++) {
        const ld = data.layer?.[i];
        if (!ld) continue;
        const name = layers[i];
        const l = state.layers[name];
        const el = els.layers[name];

        if (typeof ld.enabled !== 'undefined') {
            l.enabled = ld.enabled;
            if (el.activeBtn) {
                el.activeBtn.textContent = ld.enabled ? 'ON' : 'OFF';
                el.activeBtn.classList.toggle('bg-green-600', ld.enabled);
                el.activeBtn.classList.toggle('bg-gray-700', !ld.enabled);
                el.activeBtn.classList.toggle('text-white', ld.enabled);
                el.activeBtn.classList.toggle('text-gray-400', !ld.enabled);
            }
            if (el.activeLed) {
                el.activeLed.classList.toggle('bg-green-500', ld.enabled);
                el.activeLed.classList.toggle('bg-red-500', !ld.enabled);
            }
            if (name === 'piano' || name === 'synth') updateMixGains();
            if (name === 'bass') updateBassGain();
        }
        if (typeof ld.octave !== 'undefined') {
            l.octave = ld.octave;
            if (el.octDisp) el.octDisp.textContent = formatOct(ld.octave);
        }
        if (typeof ld.longRelease !== 'undefined') {
            l.longRelease = ld.longRelease;
            if (el.lr) updateToggleBtn(el.lr, ld.longRelease);
            if (l.synth) {
                l.synth.controllerChange(0, 72, ld.longRelease ? state.longReleaseValue : 64);
            }
        }
        if (typeof ld.noSens !== 'undefined') {
            l.noSens = ld.noSens;
            if (el.ns) updateToggleBtn(el.ns, ld.noSens);
        }

        // EQ
        if (ld.eq) {
            const setEQ = (band, input) => {
                if (!input || typeof ld.eq[band] === 'undefined') return;
                const raw = parseInt(ld.eq[band]);
                input.value = raw;
                const val = fromSliderValue(raw);
                const node = l.eq[band === 'treble' ? 'high' : band === 'mid' ? 'mid' : 'low'];
                if (node) node.gain.value = (val - 50) * 0.3;
            };
            setEQ('treble', el.eqTreble);
            setEQ('mid', el.eqMid);
            setEQ('bass', el.eqBass);
            // Filter
            if (el.eqFilter && typeof ld.eq.filter !== 'undefined') {
                el.eqFilter.value = ld.eq.filter;
                updateFilter(name, fromSliderValue(parseInt(ld.eq.filter)));
            }
        }

        // FX
        if (ld.fx) {
            if (!l.fx) l.fx = { reverb: 0, chorus: 0, delayMix: 0, delayTime: 0.3, delayFdbk: 0.3 };
            const s = l.synth;
            if (s) {
                if (typeof ld.fx.reverb !== 'undefined') {
                    l.fx.reverb = ld.fx.reverb;
                    if (el.fxReverb) el.fxReverb.value = ld.fx.reverb;
                    s.controllerChange(0, 91, ld.fx.reverb);
                }
                if (typeof ld.fx.chorus !== 'undefined') {
                    l.fx.chorus = ld.fx.chorus;
                    if (el.fxChorus) el.fxChorus.value = ld.fx.chorus;
                    s.controllerChange(0, 93, ld.fx.chorus);
                }
                if (typeof ld.fx.delayMix !== 'undefined' && l.delay?.input) {
                    l.fx.delayMix = ld.fx.delayMix;
                    if (el.delayMix) el.delayMix.value = ld.fx.delayMix;
                    l.delay.input.gain.value = ld.fx.delayMix / 100;
                }
                if (typeof ld.fx.delayTime !== 'undefined' && l.delay?.delay) {
                    l.fx.delayTime = ld.fx.delayTime;
                    if (el.delayTime) el.delayTime.value = ld.fx.delayTime;
                    l.delay.delay.delayTime.value = ld.fx.delayTime;
                }
                if (typeof ld.fx.delayFdbk !== 'undefined' && l.delay?.feedback) {
                    l.fx.delayFdbk = ld.fx.delayFdbk;
                    if (el.delayFdbk) el.delayFdbk.value = ld.fx.delayFdbk;
                    l.delay.feedback.gain.value = ld.fx.delayFdbk;
                }
            }
        }

        // Preset
        if (typeof ld.presetIndex !== 'undefined' && l.presets[ld.presetIndex]) {
            l.presetIndex = ld.presetIndex;
            if (el.preset) el.preset.value = ld.presetIndex;
            handlePresetChange(name, ld.presetIndex);
        }
    }
}

// ======================== DOM REFS ========================
const $ = id => document.getElementById(id);
const els = {};

function cacheElements() {
    els.masterVol = $('global-master-vol');
    els.masterDisp = $('global-master-disp');
    els.pianoSynthMix = $('global-piano-synth-mix');
    els.bassVol = $('global-bass-vol');
    els.bassDisp = $('global-bass-disp');
    els.bassSplit = $('bass-split-input');
    els.preset = $('global-preset-select');
    els.presetPrev = $('global-prev-preset');
    els.presetNext = $('global-next-preset');
    els.saveBtn = $('global-save-btn');
    els.loadBtn = $('global-load-btn');

    els.layers = {};
    ['piano', 'synth', 'bass'].forEach((name, i) => {
        const id = i + 1;
        els.layers[name] = {
            sf: $(`layer-${id}-sf-select`),
            preset: $(`layer-${id}-preset-select`),
            presetPrev: $(`layer-${id}-prev-preset`),
            presetNext: $(`layer-${id}-next-preset`),
            octDown: $(`layer-${id}-octave-down`),
            octDisp: $(`layer-${id}-octave-display`),
            octUp: $(`layer-${id}-octave-up`),
            activeBtn: $(`layer-${id}-active-btn`),
            activeLed: $(`layer-${id}-active-led`),
            lr: $(`layer-${id}-long-release`),
            ns: $(`layer-${id}-no-sens`),
            sp: $(`layer-${id}-smart-pad`),
            eqTreble: $(`layer-${id}-eq-treble`),
            eqMid: $(`layer-${id}-eq-mid`),
            eqBass: $(`layer-${id}-eq-bass`),
            eqFilter: $(`layer-${id}-eq-filter`),
            fxReverb: $(`layer-${id}-fx-reverb`),
            fxChorus: $(`layer-${id}-fx-chorus`),
            delayMix: $(`layer-${id}-delay-mix`),
            delayTime: $(`layer-${id}-delay-time`),
            delayFdbk: $(`layer-${id}-delay-fdbk`),
        };
    });
}

// ======================== HELPERS ========================
function updateToggleBtn(btn, isActive, colorClass = 'bg-green-600') {
    if (!btn) return;
    if (isActive) {
        btn.classList.add(colorClass, 'text-white');
        btn.classList.remove('bg-gray-700', 'text-gray-400', 'hover:bg-gray-600');
    } else {
        btn.classList.remove(colorClass, 'text-white');
        btn.classList.add('bg-gray-700', 'text-gray-400', 'hover:bg-gray-600');
    }
}

function formatOct(v) {
    return v > 0 ? '+' + v : String(v);
}

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToNote(midi) {
    return noteNames[midi % 12] + (Math.floor(midi / 12) - 1);
}

// ======================== AUDIO ENGINE ========================
async function startAudio() {
    if (state.ctx) return;

    try {
        state.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
        if (!state.ctx.audioWorklet) {
            throw new Error('audioWorklet not available. This page must be served from localhost or HTTPS.');
        }
        await state.ctx.audioWorklet.addModule('spessasynth_processor.min.js');
        await state.ctx.resume();

        // Master gain
        state.masterGain = state.ctx.createGain();
        state.masterGain.gain.value = 75 / 100;
        state.masterGain.connect(state.ctx.destination);

        // Init each layer
        for (const name of ['piano', 'synth', 'bass']) {
            const layer = state.layers[name];
            layer.synth = new WorkletSynthesizer(state.ctx);

            // Gain
            layer.gain = state.ctx.createGain();
            layer.gain.gain.value = 1;

            // EQ
            const low = state.ctx.createBiquadFilter();
            low.type = 'lowshelf';
            low.frequency.value = 320;
            const mid = state.ctx.createBiquadFilter();
            mid.type = 'peaking';
            mid.frequency.value = 1000;
            const high = state.ctx.createBiquadFilter();
            high.type = 'highshelf';
            high.frequency.value = 3200;
            layer.eq = { low, mid, high };

            // DJ Filter
            const lp = state.ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 22050;
            const hp = state.ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 10;
            layer.filter = { lp, hp };

            // Chain: synth -> gain -> eq.low -> eq.mid -> eq.high -> filter.hp -> filter.lp -> master
            layer.synth.connect(layer.gain);
            layer.gain.connect(low);
            low.connect(mid);
            mid.connect(high);
            high.connect(hp);
            hp.connect(lp);
            lp.connect(state.masterGain);

            // Delay
            const dInput = state.ctx.createGain();
            dInput.gain.value = 0;
            const dDelay = state.ctx.createDelay(5.0);
            dDelay.delayTime.value = 0.3;
            const dFeedback = state.ctx.createGain();
            dFeedback.gain.value = 0.3;

            dInput.connect(dDelay);
            dDelay.connect(dFeedback);
            dFeedback.connect(dDelay);
            dDelay.connect(state.masterGain);

            layer.delay = { input: dInput, delay: dDelay, feedback: dFeedback };
            lp.connect(dInput);

            applyPolyphony(name, state[`${name}Polyphony`]);
        }

        state.audioStarted = true;
        document.getElementById('start-overlay')?.remove();

        // Auto-load GeneralUser-GS.sf2
        autoLoadSoundfont();
    } catch (e) {
        console.error('Audio Init Error:', e);
        alert('Failed to initialize audio. Please reload.');
    }
}

async function autoLoadSoundfont() {
    try {
        const resp = await fetch('GeneralUser-GS.sf2');
        if (!resp.ok) return;
        const buf = await resp.arrayBuffer();

        const names = ['piano', 'synth', 'bass'];
        const presetTargets = { piano: 0, synth: 194, bass: 90 };

        for (const name of names) {
            const layer = state.layers[name];
            const b = buf.slice(0);
            await layer.synth.soundBankManager.addSoundBank(b, 'main');
            layer.name = 'GeneralUser-GS';
            layer.presets = layer.synth.presetList;

            if (layer.presets.length > 0) {
                const target = name === 'piano' ? 0
                    : name === 'synth' ? Math.min(presetTargets.synth, layer.presets.length - 1)
                    : Math.min(presetTargets.bass, layer.presets.length - 1);
                layer.presetIndex = target;
                const p = layer.presets[target];
                layer.synth.controllerChange(0, 0, p.bankMSB);
                layer.synth.controllerChange(0, 32, p.bankLSB);
                layer.synth.programChange(0, p.program);
                if (layer.longRelease) layer.synth.controllerChange(0, 72, state.longReleaseValue);
            }
        }

        populatePresetSelects();
    } catch (err) {
        console.warn('Auto-load failed:', err);
    }
}

function populatePresetSelects() {
    for (const name of ['piano', 'synth', 'bass']) {
        const layer = state.layers[name];
        const sel = els.layers[name].preset;
        if (!sel) continue;
        sel.innerHTML = '';
        if (layer.presets.length > 0) {
            layer.presets.forEach((p, i) => {
                const o = document.createElement('option');
                o.value = i;
                o.textContent = `${String(i + 1).padStart(3, '0')} - ${p.name}`;
                sel.appendChild(o);
            });
            sel.value = layer.presetIndex;
        } else {
            const o = document.createElement('option');
            o.textContent = 'No presets loaded';
            sel.appendChild(o);
        }
    }
}

// ======================== NOTE HANDLING ========================
function handleNoteOn(note, velocity = 100) {
    const isBassNote = state.layers.bass.enabled && note < state.bassSplitKey;

    if (isBassNote) {
        const layer = state.layers.bass;
        if (layer.synth) {
            const vel = layer.noSens ? state.noSensVelocity : velocity;
            const n = note + layer.octave * 12;
            if (n >= 0 && n <= 127) layer.synth.noteOn(0, n, vel);
        }
    }

    if (!isBassNote && state.layers.piano.synth && state.layers.piano.enabled) {
        const layer = state.layers.piano;
        const vel = layer.noSens ? state.noSensVelocity : velocity;
        const n = note + layer.octave * 12;
        if (n >= 0 && n <= 127) layer.synth.noteOn(0, n, vel);
    }

    if (state.smartPadEnabled) {
        state.harmonyEngine.noteOn(note, velocity);
        const hs = state.harmonyEngine.getHarmonicState();
        state.currentChord = hs.chord || '--';
        updateChordDisplay();
        updateSynthChord(hs, velocity);
    } else if (!isBassNote && state.layers.synth.synth && state.layers.synth.enabled) {
        const layer = state.layers.synth;
        const vel = layer.noSens ? state.noSensVelocity : velocity;
        const n = note + layer.octave * 12;
        if (n >= 0 && n <= 127) layer.synth.noteOn(0, n, vel);
    }
}

function handleNoteOff(note) {
    for (const name of ['bass', 'piano']) {
        const layer = state.layers[name];
        if (layer.synth) {
            const n = note + layer.octave * 12;
            if (n >= 0 && n <= 127) layer.synth.noteOff(0, n);
        }
    }

    if (state.smartPadEnabled) {
        state.harmonyEngine.noteOff(note);
        const hs = state.harmonyEngine.getHarmonicState();
        state.currentChord = hs.chord || '--';
        updateChordDisplay();
        updateSynthChord(hs, 0);
    } else if (state.layers.synth.synth) {
        const layer = state.layers.synth;
        const n = note + layer.octave * 12;
        if (n >= 0 && n <= 127) layer.synth.noteOff(0, n);
    }
}

function updateSynthChord(hs, velocity) {
    const synth = state.layers.synth;
    if (!synth.synth || !synth.enabled) return;

    const newNotes = new Set(hs.notes);
    const oldNotes = state.activeSmartPadNotes;
    const playVelocity = synth.noSens ? state.noSensVelocity : (velocity > 0 ? velocity : 100);

    Array.from(oldNotes).forEach(n => {
        if (!newNotes.has(n)) {
            const fn = n + synth.octave * 12;
            if (fn >= 0 && fn <= 127) synth.synth.noteOff(0, fn);
            oldNotes.delete(n);
        }
    });

    newNotes.forEach(n => {
        if (!oldNotes.has(n)) {
            const fn = n + synth.octave * 12;
            if (fn >= 0 && fn <= 127) synth.synth.noteOn(0, fn, playVelocity);
            oldNotes.add(n);
        }
    });
}

// ======================== FILE LOADING ========================
async function loadSoundfontFile(name, file) {
    const layer = state.layers[name];
    if (!file || !layer.synth) return;

    try {
        const buf = await file.arrayBuffer();
        try { await layer.synth.soundBankManager.deleteSoundBank('main'); } catch (e) {}
        await layer.synth.soundBankManager.addSoundBank(buf, 'main');

        layer.presets = layer.synth.presetList;
        layer.name = file.name.replace('.sf2', '');

        if (layer.presets.length > 0) {
            layer.presetIndex = 0;
            const p = layer.presets[0];
            layer.synth.controllerChange(0, 0, p.bankMSB);
            layer.synth.controllerChange(0, 32, p.bankLSB);
            layer.synth.programChange(0, p.program);
        }

        populatePresetSelects();
    } catch (err) {
        console.error(err);
        alert('Error loading file');
    }
}

function handlePresetChange(name, index) {
    const layer = state.layers[name];
    if (!layer.presets[index] || !layer.synth) return;

    layer.presetIndex = index;
    const p = layer.presets[index];
    layer.synth.controllerChange(0, 0, p.bankMSB);
    layer.synth.controllerChange(0, 32, p.bankLSB);
    layer.synth.programChange(0, p.program);
}

// ======================== UI WIRING ========================
function wireControls() {
    // Master Volume
    if (els.masterVol) {
        els.masterVol.addEventListener('input', e => {
            const v = parseInt(e.target.value);
            state.masterVolume = v;
            if (els.masterDisp) els.masterDisp.textContent = v + '%';
            if (state.masterGain) state.masterGain.gain.value = v / 100;
        });
    }

    // Piano/Synth Mix
    if (els.pianoSynthMix) {
        els.pianoSynthMix.addEventListener('input', e => {
            const raw = parseInt(e.target.value);
            const val = fromSliderValue(raw);
            state.mix = val;
            e.target.value = toSliderValue(val);
            updateMixGains();
        });
    }

    // Bass Volume
    if (els.bassVol) {
        els.bassVol.addEventListener('input', e => {
            const v = parseInt(e.target.value);
            state.bassVolume = v;
            if (els.bassDisp) els.bassDisp.textContent = v + '%';
            updateBassGain();
        });
    }

    // Bass Split
    if (els.bassSplit) {
        els.bassSplit.addEventListener('change', e => {
            state.bassSplitKey = parseInt(e.target.value) || 60;
        });
    }

    // Layer controls
    const layerNames = ['piano', 'synth', 'bass'];
    layerNames.forEach((name, idx) => {
        const id = idx + 1;
        const layer = state.layers[name];
        const el = els.layers[name];

        if (!el) return;

        // Octave
        if (el.octDown && el.octDisp) {
            el.octDown.onclick = () => {
                let val = parseInt(el.octDisp.textContent) || 0;
                layer.octave = Math.max(-3, val - 1);
                el.octDisp.textContent = formatOct(layer.octave);
            };
        }
        if (el.octUp && el.octDisp) {
            el.octUp.onclick = () => {
                let val = parseInt(el.octDisp.textContent) || 0;
                layer.octave = Math.min(3, val + 1);
                el.octDisp.textContent = formatOct(layer.octave);
            };
        }

        // Active toggle
        if (el.activeBtn) {
            el.activeBtn.onclick = () => {
                layer.enabled = !layer.enabled;
                el.activeBtn.textContent = layer.enabled ? 'ON' : 'OFF';
                el.activeBtn.classList.toggle('bg-green-600', layer.enabled);
                el.activeBtn.classList.toggle('bg-gray-700', !layer.enabled);
                el.activeBtn.classList.toggle('text-white', layer.enabled);
                el.activeBtn.classList.toggle('text-gray-400', !layer.enabled);
                if (el.activeLed) {
                    el.activeLed.classList.toggle('bg-green-500', layer.enabled);
                    el.activeLed.classList.toggle('bg-red-500', !layer.enabled);
                }
                if (name === 'piano' || name === 'synth') updateMixGains();
                if (name === 'bass') updateBassGain();
            };
        }

        // Preset navigation
        if (el.presetPrev && el.preset) {
            el.presetPrev.onclick = () => {
                if (el.preset.selectedIndex > 0) {
                    el.preset.selectedIndex--;
                    el.preset.dispatchEvent(new Event('change'));
                }
            };
        }
        if (el.presetNext && el.preset) {
            el.presetNext.onclick = () => {
                if (el.preset.selectedIndex < el.preset.options.length - 1) {
                    el.preset.selectedIndex++;
                    el.preset.dispatchEvent(new Event('change'));
                }
            };
        }
        if (el.preset) {
            el.preset.addEventListener('change', e => {
                handlePresetChange(name, parseInt(e.target.value));
            });
        }

        // Long Release
        if (el.lr) {
            el.lr.onclick = () => {
                layer.longRelease = !layer.longRelease;
                updateToggleBtn(el.lr, layer.longRelease);
                if (layer.synth) {
                    layer.synth.controllerChange(0, 72, layer.longRelease ? state.longReleaseValue : 64);
                }
            };
        }

        // No Sens
        if (el.ns) {
            el.ns.onclick = () => {
                layer.noSens = !layer.noSens;
                updateToggleBtn(el.ns, layer.noSens);
            };
        }

        // Smart Pad (synth only)
        if (el.sp && name === 'synth') {
            el.sp.onclick = () => {
                state.smartPadEnabled = !state.smartPadEnabled;
                updateToggleBtn(el.sp, state.smartPadEnabled, 'bg-purple-600');
                updateChordDisplay();
                if (!state.smartPadEnabled) {
                    state.activeSmartPadNotes.forEach(n => {
                        const fn = n + layer.octave * 12;
                        if (layer.synth && fn >= 0 && fn <= 127) layer.synth.noteOff(0, fn);
                    });
                    state.activeSmartPadNotes.clear();
                    state.harmonyEngine.reset();
                }
            };
        }

        // EQ
        const wireEQ = (band, input) => {
            if (!input) return;
            const eqKey = band === 'treble' ? 'high' : band === 'mid' ? 'mid' : 'low';
            const isFilter = band === 'filter';

            input.addEventListener('input', e => {
                const raw = parseInt(e.target.value);
                const val = fromSliderValue(raw);
                e.target.value = toSliderValue(val);
                if (isFilter) {
                    updateFilter(name, val);
                } else {
                    const gain = (val - 50) * 0.3;
                    if (layer.eq[eqKey]) layer.eq[eqKey].gain.value = gain;
                }
            });
        };
        wireEQ('treble', el.eqTreble);
        wireEQ('mid', el.eqMid);
        wireEQ('bass', el.eqBass);
        wireEQ('filter', el.eqFilter);

        // Effects
        if (el.fxReverb) {
            el.fxReverb.addEventListener('input', e => {
                const v = parseInt(e.target.value);
                layer.fx.reverb = v;
                if (layer.synth) layer.synth.controllerChange(0, 91, v);
            });
        }
        if (el.fxChorus) {
            el.fxChorus.addEventListener('input', e => {
                const v = parseInt(e.target.value);
                layer.fx.chorus = v;
                if (layer.synth) layer.synth.controllerChange(0, 93, v);
            });
        }
        if (el.delayMix && layer.delay && layer.delay.input) {
            el.delayMix.addEventListener('input', e => {
                const v = parseInt(e.target.value);
                layer.fx.delayMix = v;
                layer.delay.input.gain.value = v / 100;
            });
        }
        if (el.delayTime && layer.delay && layer.delay.delay) {
            el.delayTime.addEventListener('input', e => {
                const v = parseInt(e.target.value);
                layer.fx.delayTime = v;
                layer.delay.delay.delayTime.value = v;
            });
        }
        if (el.delayFdbk && layer.delay && layer.delay.feedback) {
            el.delayFdbk.addEventListener('input', e => {
                const v = parseInt(e.target.value);
                layer.fx.delayFdbk = v;
                layer.delay.feedback.gain.value = v;
            });
        }
    });

    // Save / Load buttons
    if (els.saveBtn) {
        els.saveBtn.onclick = () => {
            let name = els.preset.value;
            if (name === '-1') {
                name = prompt('New preset name:');
                if (!name) return;
            } else {
                if (!confirm(`Overwrite "${name}"?`)) return;
            }
            const data = collectState();
            localStorage.setItem(PRESET_PREFIX + name, JSON.stringify(data));
            populatePresetSelect();
            if (els.preset) els.preset.value = name;
            if (els.saveBtn) {
                els.saveBtn.disabled = false;
                els.saveBtn.style.opacity = '1';
                els.saveBtn.style.cursor = 'pointer';
            }
        };
    }
    if (els.loadBtn) {
        els.loadBtn.onclick = async () => {
            const val = els.preset.value;
            if (val === '-1') return;
            const raw = localStorage.getItem(PRESET_PREFIX + val);
            if (!raw) { alert('Preset not found'); return; }
            const data = JSON.parse(raw);
            await loadPresetState(data);
        };
    }
    if (els.preset) {
        els.preset.addEventListener('change', () => {
            if (els.saveBtn) {
                els.saveBtn.disabled = false;
                els.saveBtn.style.opacity = '1';
                els.saveBtn.style.cursor = 'pointer';
            }
        });
    }
    if (els.presetPrev && els.preset) {
        els.presetPrev.onclick = () => {
            if (els.preset.selectedIndex <= 0) {
                els.preset.selectedIndex = els.preset.options.length - 1;
            } else {
                els.preset.selectedIndex--;
            }
            const val = els.preset.value;
            if (val !== '-1') {
                const raw = localStorage.getItem(PRESET_PREFIX + val);
                if (raw) loadPresetState(JSON.parse(raw));
            }
        };
    }
    if (els.presetNext && els.preset) {
        els.presetNext.onclick = () => {
            if (els.preset.selectedIndex >= els.preset.options.length - 1) {
                els.preset.selectedIndex = 0;
            } else {
                els.preset.selectedIndex++;
            }
            const val = els.preset.value;
            if (val !== '-1') {
                const raw = localStorage.getItem(PRESET_PREFIX + val);
                if (raw) loadPresetState(JSON.parse(raw));
            }
        };
    }

    // ======================== SETTINGS MODAL ========================
    const settingsBtn = $('settings-btn');
    const settingsModal = $('settings-modal');
    const settingsClose = $('settings-close-btn');

    function openSettings() {
        if (!settingsModal) return;
        settingsModal.classList.remove('hidden');
        populateChordGrid();
        restoreChordGridState();
        if (settingsBtn) {
            settingsBtn.classList.add('bg-red-600', 'text-white');
            settingsBtn.classList.remove('btn-secondary');
        }
    }

    function closeSettings() {
        if (!settingsModal) return;
        settingsModal.classList.add('hidden');
        if (settingsBtn) {
            settingsBtn.classList.remove('bg-red-600', 'text-white');
            settingsBtn.classList.add('btn-secondary');
        }
    }

    if (settingsBtn) settingsBtn.onclick = () => {
        if (settingsModal.classList.contains('hidden')) {
            openSettings();
        } else {
            closeSettings();
        }
    };
    if (settingsClose) settingsClose.onclick = closeSettings;
    if (settingsModal) settingsModal.addEventListener('click', e => {
        if (e.target === settingsModal) closeSettings();
    });

    // Long Release Time
    const lrEl = $('settings-lr');
    const lrDisp = $('settings-lr-disp');
    if (lrEl) {
        lrEl.addEventListener('input', () => {
            const v = parseInt(lrEl.value);
            state.longReleaseValue = v;
            if (lrDisp) lrDisp.textContent = v;
            // Update all synths that have longRelease enabled
            for (const name of ['piano', 'synth', 'bass']) {
                const l = state.layers[name];
                if (l.synth && l.longRelease) {
                    l.synth.controllerChange(0, 72, v);
                }
            }
        });
    }

    // No Sens Velocity
    const nvEl = $('settings-nv');
    const nvDisp = $('settings-nv-disp');
    if (nvEl) {
        nvEl.addEventListener('input', () => {
            const v = parseInt(nvEl.value);
            state.noSensVelocity = v;
            if (nvDisp) nvDisp.textContent = v;
        });
    }

    // Polyphony
    const wirePoly = (name, elId, dispId, defaultVal) => {
        const el = $(elId);
        const disp = $(dispId);
        if (!el) return;
        el.addEventListener('input', () => {
            const v = parseInt(el.value);
            state[`${name}Polyphony`] = v;
            if (disp) disp.textContent = v + ' voices';
            applyPolyphony(name, v);
        });
    };
    wirePoly('piano', 'settings-piano-poly', 'settings-piano-poly-disp', 16);
    wirePoly('synth', 'settings-synth-poly', 'settings-synth-poly-disp', 16);
    wirePoly('bass', 'settings-bass-poly', 'settings-bass-poly-disp', 2);

    // Smart Pad Latch
    const latchBtn = $('settings-latch');
    if (latchBtn) {
        latchBtn.onclick = () => {
            state.smartPadLatch = !state.smartPadLatch;
            latchBtn.textContent = state.smartPadLatch ? 'ENABLED' : 'DISABLED';
            latchBtn.classList.toggle('bg-purple-600', state.smartPadLatch);
            latchBtn.classList.toggle('text-white', state.smartPadLatch);
            latchBtn.classList.toggle('bg-gray-700', !state.smartPadLatch);
            latchBtn.classList.toggle('text-gray-400', !state.smartPadLatch);
            updateHarmonyEngineConfig();
        };
    }

    // History Size
    const hEl = $('settings-history');
    const hDisp = $('settings-history-disp');
    if (hEl) {
        hEl.addEventListener('input', () => {
            const v = parseInt(hEl.value);
            state.smartPadHistorySize = v;
            if (hDisp) hDisp.textContent = v;
            updateHarmonyEngineConfig();
        });
    }

    // Delete current preset
    const delBtn = $('settings-delete-preset');
    if (delBtn) {
        delBtn.onclick = () => {
            const val = els.preset?.value;
            if (!val || val === '-1') { alert('No preset selected.'); return; }
            if (!confirm(`Delete "${val}"?`)) return;
            localStorage.removeItem(PRESET_PREFIX + val);
            populatePresetSelect();
        };
    }
}

function updateFilter(name, val) {
    const layer = state.layers[name];
    if (!layer.filter.lp || !layer.filter.hp) return;

    if (val < 50) {
        layer.filter.hp.frequency.value = 10;
        const normalized = val / 50;
        const freq = 20 * Math.pow(22050 / 20, normalized);
        layer.filter.lp.frequency.value = Math.max(20, freq);
    } else {
        layer.filter.lp.frequency.value = 22050;
        const normalized = (val - 50) / 50;
        const freq = 20 * Math.pow(22050 / 20, normalized);
        layer.filter.hp.frequency.value = Math.min(22050, freq);
    }
}

function updateMixGains() {
    const p = state.layers.piano;
    const s = state.layers.synth;
    if (!p.gain || !s.gain) return;

    let pVol = 1;
    let sVol = 1;
    const mix = state.mix;

    if (mix < 50) {
        sVol = mix / 50;
    } else {
        pVol = 1 - ((mix - 50) / 50);
    }

    p.gain.gain.value = p.enabled ? pVol : 0;
    s.gain.gain.value = s.enabled ? sVol : 0;
}

function updateBassGain() {
    const b = state.layers.bass;
    if (b.gain) {
        b.gain.gain.value = b.enabled ? (state.bassVolume / 100) : 0;
    }
}

function applyPolyphony(name, value) {
    const s = state.layers[name].synth;
    if (s) s.setSystemParameter("voiceCap", value);
}

function updateHarmonyEngineConfig() {
    state.harmonyEngine.updateConfig({
        historySize: state.smartPadHistorySize,
        sustainTime: state.smartPadLatch ? 999999999 : 10000,
        allowedQualities: state.allowedChordQualities
    });
}

let chordGridPopulated = false;
function populateChordGrid() {
    if (chordGridPopulated) return;
    const grid = $('settings-chord-grid');
    if (!grid) return;
    grid.innerHTML = '';
    ALL_CHORD_QUALITIES.forEach(quality => {
        const label = document.createElement('label');
        label.className = 'flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-white';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500';
        cb.checked = true;
        cb.addEventListener('change', () => {
            const unchecked = [...grid.querySelectorAll('input[type="checkbox"]')]
                .filter(c => !c.checked)
                .map(c => c.getAttribute('data-quality'));
            state.allowedChordQualities = unchecked.length > 0 ? ALL_CHORD_QUALITIES.filter(q => !unchecked.includes(q)) : null;
            updateHarmonyEngineConfig();
        });
        cb.setAttribute('data-quality', quality);
        label.appendChild(cb);
        label.appendChild(document.createTextNode(quality === "" ? "Major" : quality));
        grid.appendChild(label);
    });
    chordGridPopulated = true;
}

function restoreChordGridState() {
    const grid = $('settings-chord-grid');
    if (!grid) return;
    const cbs = grid.querySelectorAll('input[type="checkbox"]');
    if (state.allowedChordQualities === null) {
        cbs.forEach(cb => cb.checked = true);
    } else {
        cbs.forEach(cb => {
            cb.checked = state.allowedChordQualities.includes(cb.getAttribute('data-quality'));
        });
    }
}

// ======================== VIRTUAL PIANO ========================
let pianoInitialized = false;

function createPianoKeys() {
    const container = document.getElementById('virtual-piano');
    if (!container || pianoInitialized) return;
    pianoInitialized = true;

    const startNote = 48;
    const endNote = 84;

    const observer = new ResizeObserver(() => render());
    observer.observe(container);
    render();

    function render() {
        const cw = container.clientWidth;
        if (cw === 0) return;

        container.innerHTML = '';
        let whiteKeyCount = 0;
        for (let i = startNote; i <= endNote; i++) {
            if (![1, 3, 6, 8, 10].includes(i % 12)) whiteKeyCount++;
        }

        const kw = Math.floor(cw / whiteKeyCount);

        // White keys
        let wkIdx = 0;
        for (let i = startNote; i <= endNote; i++) {
            const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
            if (!isBlack) {
                const key = document.createElement('div');
                key.className = 'bg-white border-r border-gray-400 rounded-b pb-2 flex items-end justify-center select-none active:bg-gray-200';
                key.style.width = kw + 'px';
                key.style.height = '100%';
                key.style.position = 'relative';
                key.style.cursor = 'pointer';

                key.addEventListener('mousedown', e => {
                    e.preventDefault();
                    key.classList.add('bg-gray-300');
                    handleNoteOn(i, 100);
                });
                key.addEventListener('mouseup', () => {
                    key.classList.remove('bg-gray-300');
                    handleNoteOff(i);
                });
                key.addEventListener('mouseleave', () => {
                    if (key.classList.contains('bg-gray-300')) {
                        key.classList.remove('bg-gray-300');
                        handleNoteOff(i);
                    }
                });

                key.addEventListener('touchstart', e => {
                    e.preventDefault();
                    key.classList.add('bg-gray-300');
                    handleNoteOn(i, 100);
                }, { passive: false });
                key.addEventListener('touchend', e => {
                    e.preventDefault();
                    key.classList.remove('bg-gray-300');
                    handleNoteOff(i);
                }, { passive: false });

                key.dataset.note = i;
                container.appendChild(key);
                wkIdx++;
            }
        }

        // Black keys
        wkIdx = 0;
        for (let i = startNote; i <= endNote; i++) {
            const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
            if (!isBlack) {
                wkIdx++;
            } else {
                const bw = Math.max(16, Math.floor(kw * 0.6));
                const bh = '60%';
                const leftPos = (wkIdx * kw) - (bw / 2);

                const bKey = document.createElement('div');
                bKey.className = 'absolute bg-black rounded-b shadow active:bg-gray-800 z-10';
                bKey.style.width = bw + 'px';
                bKey.style.height = bh;
                bKey.style.left = leftPos + 'px';
                bKey.style.top = '0';
                bKey.style.cursor = 'pointer';

                bKey.addEventListener('mousedown', e => {
                    e.preventDefault();
                    bKey.classList.add('bg-gray-700');
                    handleNoteOn(i, 100);
                });
                bKey.addEventListener('mouseup', () => {
                    bKey.classList.remove('bg-gray-700');
                    handleNoteOff(i);
                });
                bKey.addEventListener('mouseleave', () => {
                    if (bKey.classList.contains('bg-gray-700')) {
                        bKey.classList.remove('bg-gray-700');
                        handleNoteOff(i);
                    }
                });

                bKey.addEventListener('touchstart', e => {
                    e.preventDefault();
                    bKey.classList.add('bg-gray-700');
                    handleNoteOn(i, 100);
                }, { passive: false });
                bKey.addEventListener('touchend', e => {
                    e.preventDefault();
                    bKey.classList.remove('bg-gray-700');
                    handleNoteOff(i);
                }, { passive: false });

                bKey.dataset.note = i;
                container.appendChild(bKey);
            }
        }
    }
}

// ======================== MIDI ========================
function initMIDI() {
    if (!navigator.requestMIDIAccess) return;

    const onMIDIMessage = (event) => {
        const [status, data1, data2] = event.data;
        const command = status & 0xF0;

        if (command === 0x90 && data2 > 0) {
            handleNoteOn(data1, data2);
        } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
            handleNoteOff(data1);
        } else if (command === 0xB0) {
            for (const name of ['piano', 'synth', 'bass']) {
                const s = state.layers[name].synth;
                if (s && state.layers[name].enabled) s.controllerChange(0, data1, data2);
            }
        }
    };

    navigator.requestMIDIAccess().then(midiAccess => {
        for (const input of midiAccess.inputs.values()) {
            input.onmidimessage = onMIDIMessage;
        }
        midiAccess.onstatechange = (e) => {
            if (e.port.type === 'input' && e.port.state === 'connected') {
                e.port.onmidimessage = onMIDIMessage;
            }
        };
    });
}

function highlightPianoKey(note, active) {
    const el = document.querySelector(`[data-note="${note}"]`);
    if (!el) return;
    if ([1, 3, 6, 8, 10].includes(note % 12)) {
        el.classList.toggle('bg-gray-700', active);
    } else {
        el.classList.toggle('bg-gray-300', active);
    }
}

function initKeyboard() {
    const keyMap = {
        Numpad1: 36, Numpad5: 37, Numpad2: 38, Numpad6: 39,
        Numpad3: 40, Numpad7: 41, NumpadDivide: 42, Numpad8: 43,
        NumpadMultiply: 44, Numpad9: 45, NumpadSubtract: 46, NumpadAdd: 47,
        KeyZ: 60, KeyS: 61, KeyX: 62, KeyD: 63, KeyC: 64,
        KeyV: 65, KeyG: 66, KeyB: 67, KeyH: 68, KeyN: 69, KeyJ: 70, KeyK: 71, KeyM: 71,
        Comma: 72, KeyL: 73, Period: 74, Semicolon: 75, Slash: 76,
        IntlRo: 77, Backslash: 78,
        KeyQ: 72, Digit2: 73, KeyW: 74, Digit3: 75, KeyE: 76,
        KeyR: 77, Digit5: 78, KeyT: 79, Digit6: 80, KeyY: 81,
        Digit7: 82, Digit8: 83, KeyU: 83, KeyI: 84, Digit9: 85, KeyO: 86, Digit0: 87, KeyP: 88,
    };

    let numpadShift = false;
    const activeNotes = new Map();

    window.addEventListener('keydown', e => {
        if (e.repeat) return;
        if (e.code === 'Numpad0') { numpadShift = !numpadShift; return; }
        const base = keyMap[e.code];
        if (base === undefined) return;
        let note = base;
        if (numpadShift && e.code.startsWith('Numpad') && base >= 36 && base <= 47) note += 12;
        if (e.getModifierState('CapsLock') && !e.code.startsWith('Numpad')) note += 12;
        if (activeNotes.has(e.code)) return;
        activeNotes.set(e.code, note);
        highlightPianoKey(note, true);
        handleNoteOn(note, 100);
    });

    window.addEventListener('keyup', e => {
        if (e.code === 'Numpad0') return;
        if (!activeNotes.has(e.code)) return;
        const note = activeNotes.get(e.code);
        activeNotes.delete(e.code);
        highlightPianoKey(note, false);
        handleNoteOff(note);
    });
}

// ======================== START OVERLAY ========================
function showStartOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'start-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.9);backdrop-filter:blur(4px)';

    const btn = document.createElement('button');
    btn.textContent = 'CLICK TO START ENGINE';
    btn.style.cssText = 'padding:24px 48px;background:#dc2626;color:white;font-size:24px;font-weight:bold;border:none;border-radius:12px;cursor:pointer;box-shadow:0 0 30px rgba(220,38,38,0.5);animation:pulse 2s infinite';
    btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; };
    btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
    btn.onclick = async () => {
        btn.textContent = 'Starting...';
        btn.disabled = true;
        await startAudio();
    };

    const style = document.createElement('style');
    style.textContent = `@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}`;

    overlay.appendChild(btn);
    document.head.appendChild(style);
    document.body.appendChild(overlay);
}

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    showStartOverlay();
    createPianoKeys();
    initMIDI();
    initKeyboard();
    // Soundfont file inputs
    for (const name of ['piano', 'synth', 'bass']) {
        const el = els.layers[name];
        if (el && el.sf) {
            el.sf.addEventListener('change', async e => {
                const file = e.target.files[0];
                if (file) await loadSoundfontFile(name, file);
                e.target.value = '';
            });
        }
    }

    // Wire controls after audio starts (but register them now)
    wireControls();

    // Sync initial button states
    for (const name of ['piano', 'synth', 'bass']) {
        const layer = state.layers[name];
        const el = els.layers[name];
        if (!el) continue;
        if (el.lr) updateToggleBtn(el.lr, layer.longRelease);
        if (el.ns) updateToggleBtn(el.ns, layer.noSens);
        if (el.sp && name === 'synth') updateToggleBtn(el.sp, state.smartPadEnabled, 'bg-purple-600');
    }

    // Populate memory preset list from localStorage
    populatePresetSelect();

    // Piano toggle
    const pianoBtn = document.getElementById('toggle-piano-btn');
    const pianoPanel = document.getElementById('piano-panel');
    if (pianoBtn && pianoPanel) {
        let pianoVisible = true;
        pianoBtn.onclick = () => {
            pianoVisible = !pianoVisible;
            pianoPanel.style.display = pianoVisible ? '' : 'none';
            pianoBtn.style.opacity = pianoVisible ? '1' : '0.4';
        };
    }
});
