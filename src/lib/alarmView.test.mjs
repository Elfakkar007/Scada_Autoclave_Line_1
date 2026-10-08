import test from "node:test";
import assert from "node:assert/strict";
import { deriveAlarmView, minimizeAll, pruneIds } from "./alarmView.js";

const A = (id) => ({ episodeId: id });

test("tanpa alarm: tidak tampil, tidak bunyi", () => {
    assert.deepEqual(deriveAlarmView([], new Set(), false), { show: false, mode: "none", soundOn: false, count: 0 });
});

test("alarm baru: panel terbuka dan bunyi", () => {
    const v = deriveAlarmView([A("e1")], new Set(), false);
    assert.equal(v.mode, "expanded"); assert.equal(v.soundOn, true);
});

test("setelah minimize: banner, bunyi mati", () => {
    const active = [A("e1")];
    const v = deriveAlarmView(active, minimizeAll(active, new Set()), false);
    assert.equal(v.mode, "banner"); assert.equal(v.soundOn, false);
});

test("episode baru saat banner: terbuka lagi dan bunyi lagi", () => {
    const min = minimizeAll([A("e1")], new Set());
    const v = deriveAlarmView([A("e1"), A("e2")], min, false);
    assert.equal(v.mode, "expanded"); assert.equal(v.soundOn, true);
});

test("buka manual dari banner: tampil tapi senyap", () => {
    const min = minimizeAll([A("e1")], new Set());
    const v = deriveAlarmView([A("e1")], min, true);
    assert.equal(v.mode, "expanded"); assert.equal(v.soundOn, false);
});

test("pruneIds: buang yang sudah pulih, objek sama bila tidak berubah", () => {
    const min = new Set(["e1", "e2"]);
    assert.equal(pruneIds(min, [A("e1"), A("e2")]), min);
    assert.deepEqual([...pruneIds(min, [A("e2")])], ["e2"]);
    assert.equal(pruneIds(min, []).size, 0);
});

test("alarm yang sama muncul lagi sebagai episode baru (id beda) membunyikan lagi", () => {
    const min = minimizeAll([A("e1")], new Set());
    const afterRecovery = pruneIds(min, []);               // e1 pulih -> id dibuang
    const v = deriveAlarmView([A("e9")], afterRecovery, false);
    assert.equal(v.soundOn, true);
});
