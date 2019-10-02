
const createKey = (e) => `${e.audience}::${e.scope}`;

const getExpirationTimeoutInMilliseconds = (expiresIn, exp) => {
  const expTime =
    (new Date(exp * 1000).getTime() - new Date().getTime()) / 1000;
  return Math.min(expiresIn, expTime) * 1000;
};

export default class Cache {
  cache = {};
  save(entry) {
    const key = createKey(entry);
    this.cache[key] = entry;
    const timeout = getExpirationTimeoutInMilliseconds(
      entry.expires_in,
      entry.decodedToken.claims.exp
    );
    setTimeout(() => {
      delete this.cache[key];
    }, timeout);
  }
  get(key) {
    return this.cache[createKey(key)];
  }
}
