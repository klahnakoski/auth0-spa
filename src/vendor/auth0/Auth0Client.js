import {createRandomString, runIframe, sha256, unionScopes} from './utils';
import TransactionManager from './transaction-manager';
import {verify as verifyIdToken, decode as decodeJwt} from './jwt';
import {fetchJson, fromQueryString, toQueryString, URL} from '../requests';
import {Log} from "../logs";
import {exists} from "../utils";
import {bytesToBase64URL, value2json} from "../convert";
import {Cache} from "./cache";
import {GMTDate as Date} from "../dates";

const DEFAULT_SCOPE = 'openid profile email';


let CURRENT_CLIENT = null;

/**
 * A inter-session auth0 interface object
 * only one allowed per page
 */
class Auth0Client {

  constructor({ domain, leeway, client_id, audience, scope, redirect_uri, onStateChange }) {
    if (CURRENT_CLIENT) Log.error("There can be only one");
    CURRENT_CLIENT = this;
    this.options = { leeway, client_id, audience, scope, redirect_uri };
    this.authorizeSilentlyWorks = true;  //optimism
    this.cache = new Cache({name: "auth0.client", onStateChange});
    this.transactionManager = new TransactionManager();
    this.domainUrl = "https://" + domain;
  }

  getUser(){
    return this.cache.get("decodedIdToken.user");
  }

  getIdTokenClaims() {
    return this.cache.get("decodedIdToken.claims");
  }

  getAccessToken(){
    return this.cache.get("access_token");
  }

  getRefreshToken(){
    return this.cache.get("refresh_token");
  }

  async refreshAccessToken(){
    const {client_id} = this.options;
    const {refresh_token} = this.cache.get();
    const authResult = await fetchJson(
        this.domainUrl + "/oauth/token",
        {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body: toQueryString({
            grant_type: 'refresh_token',
            client_id,
            refresh_token
          })
        }
    );

    this.cache.set({...this.cache.get(), ...authResult});
  }

  async revokeRefeshToken(){
    const {client_id} = this.options;
    const token = this.cache.refresh_token;
    await fetchJson(
        this.domainUrl + "/oauth/revoke",
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: value2json({
            client_id,
            token,
          })
        }
    );
    this.cache.set({...this.cache.get(), refresh_token: null});
  }

  /**
   * Performs a redirect to `/authorize` using the parameters
   * Random and secure `state` and `nonce` parameters will be
   * auto-generated, and recorded for eventual callback processing
   */
  async authorizeWithRedirect(){
    try {
      const { client_id, audience, scope, redirect_uri, telemetry} = this.options;

      const state = createRandomString();
      const nonce = createRandomString();
      const code_verifier = createRandomString();
      const code_challenge = bytesToBase64URL(await sha256(code_verifier));

      const url = URL({
        path: this.domainUrl + "/authorize",
        query: {
          client_id,
          redirect_uri,
          audience,
          scope,
          response_type: 'code',
          response_mode: 'query',
          state,  // https://auth0.com/docs/protocols/oauth2/oauth-state
          nonce,  // https://openid.net/specs/openid-connect-core-1_0.html#ImplicitAuthRequest
          code_challenge,
          code_challenge_method: 'S256',
          telemetry,
        }
      });
      this.transactionManager.create(state, {
        nonce,
        code_verifier,
        audience,  // FOR RECOVERY LATER
        scope,    // FOR RECOVERY LATER
      });
      Log.note("GOTO: {{url}}", {url});
      window.location.assign(url);

    } catch (error) {
      Log.error("Problem with login", error);
    }
  };

  /**
   * If there's a valid token stored, return it. Otherwise, opens an
   * iframe with the `/authorize` URL using the parameters provided
   * as arguments. Random and secure `state` and `nonce` parameters
   * will be auto-generated. If the response is successful, results
   * will be valid according to their expiration times.
   */
  async authorizeSilently() {
    if (Date.now().unix() < this.cache.get("decodedAccessToken.claims.exp")) return;

    const { client_id, audience, scope, redirect_uri, telemetry } = this.options;

    const state = createRandomString();
    const nonce = createRandomString();
    const code_verifier = createRandomString();
    const code_challenge = bytesToBase64URL(await sha256(code_verifier));

    const url = URL({
      path: this.domainUrl + "/authorize",
      query: {
        client_id,
        redirect_uri,
        audience,
        scope,
        response_type: 'code',
        state,
        nonce,
        code_challenge,
        code_challenge_method: 'S256',
        prompt: 'none',
        response_mode: 'web_message',
        telemetry,
      }
    });

    try {
      if (this.authorizeSilentlyWorks) {
        const {code, ...authResult} = await runIframe(url, this.domainUrl);
        if (state !== authResult.state) Log.error('Invalid state');
        this.verifyAuthorizeCode({code_verifier, nonce, code});
        return
      }
    }catch(e){
      // EXPECTED PATH DURING DEVELOPMENT
      // https://github.com/auth0/auth0.js/issues/435#issuecomment-302113245
      this.authorizeSilentlyWorks=false;
    }
    window.open(url, '_blank');
  }

  /*
  After user authentication, call back to auth0 to get all the
  tokens.  Verify the id token.
   */
  async verifyAuthorizeCode({code_verifier, nonce, code}){
    const {leeway, client_id, redirect_uri, audience, scope} = this.options;
    const authResult = await fetchJson(
        this.domainUrl + "/oauth/token",
        {
          method: 'POST',
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            client_id,
            redirect_uri,
            code_verifier,
            code,
            grant_type: 'authorization_code'
          })
        }
    );

    const {id_token} = authResult;
    const decodedAccessToken = decodeJwt(authResult.access_token);
    const decodedIdToken = verifyIdToken({
      iss: this.domainUrl + "/",
      aud: client_id,
      id_token,
      nonce,
      leeway: leeway
    });

    this.cache.set({
      ...authResult,
      decodedAccessToken,
      decodedIdToken,
      audience,
      scope
    });
  }

  /**
   * Performs a redirect to `/v2/logout` using the parameters provided
   * as arguments. [Read more about how Logout works at Auth0](https://auth0.com/docs/logout).
   */
  async logout() {
    this.cache.clear();
    const {client_id, telemetry, redirect_uri} = this.options;
    window.location.assign(URL({
      path: this.domainUrl + "/v2/logout",
      query: {client_id, telemetry, returnTo: redirect_uri}
    }));
  }
}

async function newInstance({onStateChange, ...options}) {
  if (!window.crypto && (window).msCrypto) {
    (window).crypto = (window).msCrypto;
  }
  if (!window.crypto) {
    throw new Error(
        'For security reasons, `window.crypto` is required to run `auth0-spa-js`.'
    );
  }
  if (typeof window.crypto.subtle === 'undefined') {
    throw new Error(`
      auth0-spa-js must run on a secure origin.
      See https://github.com/auth0/auth0-spa-js/blob/master/FAQ.md#why-do-i-get-error-invalid-state-in-firefox-when-refreshing-the-page-immediately-after-a-login 
      for more information.
    `);
  }

  const location = window.location.origin + options.home_path;
  const redirect_uri = options.redirect_uri || window.location.origin+window.location.pathname;
  if (redirect_uri !== location){
    Log.error("expecting SPA to be located at {{location}}", {location})
  }

  const { state, code, error, error_description } = fromQueryString(window.location.search);
  if (error) {
    Log.error("problem with callback {{detail|json}}", {detail: {error, error_description, state}});
  }

  const audience = options.audience;
  const scope = unionScopes(options.scope, DEFAULT_SCOPE);

  const auth0 = new Auth0Client({
    ...options,
    audience,
    scope,
    redirect_uri,
    onStateChange
  });

  if (exists(state) && exists(code)){
    // THIS MAY BE A CALLBACK, AND WE CAN RECOVER THE AUTH STATE
    const transaction = auth0.transactionManager.get(state);
    if (transaction){
      auth0.options.audience = transaction.audience;
      auth0.options.scope = transaction.scope;
      auth0.transactionManager.remove(state);
      await auth0.verifyAuthorizeCode({code, ...transaction});
    }
    window.history.replaceState(null, null, location);
  }

  return auth0;
}

Auth0Client.newInstance = newInstance;

export { Auth0Client}



