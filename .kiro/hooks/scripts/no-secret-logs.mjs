// PreToolUse guard: blocks a file edit that would log a password, key or decrypted value.
// Kiro passes the tool call as JSON on stdin. Exit 2 blocks the edit; stderr says why.
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  // Look only at the text being written, not at the whole call, so paths and names do not trigger it.
  let text = input;
  try {
    const call = JSON.parse(input);
    const args = call.tool_input ?? call.toolInput ?? call.arguments ?? call.input ?? call;
    text = [args.text, args.newStr, args.content].filter((v) => typeof v === 'string').join('\n') || input;
  } catch {
    // Not JSON: scan what we got.
  }
  const secret = /\b(password|passphrase|cryptoKey|derivedKey|aesKey|plaintext|decrypted)\w*/i;
  const logCall = /\b(console\.(log|info|debug|warn|error|trace)|alert)\s*\(([^)]*)\)/g;
  for (const m of text.matchAll(logCall)) {
    if (secret.test(m[3])) {
      process.stderr.write(
        `Blocked: "${m[0].slice(0, 120)}" would log a secret. Never log the password, the key or decrypted values (see .kiro/steering/rules.md).\n`,
      );
      process.exit(2);
    }
  }
  process.exit(0);
});
