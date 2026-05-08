const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(): string {
  const time = Date.now();
  let timeStr = "";
  let t = time;
  for (let i = 0; i < 10; i++) {
    timeStr = ALPHABET[t % 32] + timeStr;
    t = Math.floor(t / 32);
  }
  const rand = crypto.getRandomValues(new Uint8Array(16));
  let randStr = "";
  for (let i = 0; i < 16; i++) {
    randStr += ALPHABET[rand[i] % 32];
  }
  return timeStr + randStr;
}
