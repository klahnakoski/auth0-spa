import {Log} from "../logs";

const createKey = (e) => `${e.audience}::${e.scope}`;

const getExpirationTimeoutInMilliseconds = (expiresIn, exp) => {
  const expTime =
    (new Date(exp * 1000).getTime() - new Date().getTime()) / 1000;
  return Math.min(expiresIn, expTime) * 1000;
};

export default class Cache {
  cache = {};
  save(entry) {
    if (entry.audience===undefined){
      Log.error("expecting an audience, or null")
    }
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
    const output = this.cache[createKey(key)];
    if (!output){
      Log.warning("did not find {{key|json}} in {{cache|json}}", {key, cache: this.cache});
    }
    return output;
  }
}
