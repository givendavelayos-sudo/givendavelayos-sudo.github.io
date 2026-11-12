// Encrypts a private import file (e.g. evaluation results) for shipping in the public app.
// Usage: ACE_PASSCODE='…' node tests/build-sealed.mjs <plain.json> <out.enc.json> "<label>"
// The plaintext and the passcode are never committed; only the sealed output is.
import fs from 'fs';
import { seal } from '../js/sources.js';
const [, , src, out, label = 'Private data'] = process.argv, pass = process.env.ACE_PASSCODE;
if (!src || !out || !pass || pass.length < 14) { console.error('need <plain.json> <out.json> and ACE_PASSCODE (14+ chars)'); process.exit(1); }
const sealed = await seal(JSON.parse(fs.readFileSync(src, 'utf8')), pass, { label });
fs.writeFileSync(out, JSON.stringify(sealed));
console.log(`sealed ${src} → ${out} (${sealed.ct.length} chars of ciphertext)`);
