import {
  bufferToBase64UrlEncoded,
  createRandomString,
  encodeState,
  parseQueryResult,
  runIframe,
  sha256,
  unionScopes
} from './utils';

import Cache from './cache';
import TransactionManager from './transaction-manager';
import {verify as verifyIdToken} from './jwt';
import * as ClientStorage from './storage';
import {DEFAULT_POPUP_CONFIG_OPTIONS, telemetry} from './constants';
import {fetchJson, URL} from '../requests';
import {Log} from "../logs";
import {coalesce, exists} from "../utils";
import {value2json} from "../convert";
import {toPairs} from "../vectors";

async function createAuth0Client(options) {
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

  const auth0 = new Auth0Client(options);

  if (!ClientStorage.get('auth0.is.authenticated')) {
    return auth0;
  }
  try {
    await auth0.getTokenSilently({
      audience: options.audience,
      scope: options.scope,
      ignoreCache: true
    });
  } catch (error) {
    Log.warning("get token did not work", error);
  }
  return auth0;
}




/**
 * Auth0 SDK for Single Page Applications using [Authorization Code Grant Flow with PKCE](https://auth0.com/docs/api-auth/tutorials/authorization-code-grant-pkce).
 */
class Auth0Client {
  DEFAULT_SCOPE = 'openid profile email';

  constructor(options) {
    this.options = options;
    this.cache = new Cache();
    this.transactionManager = new TransactionManager();
    this.domainUrl = `https://${this.options.domain}`;
  }
  _authorizeUrl(authorizeOptions) {
    return URL({
      path: this.domainUrl + "/authorize",
      query: {...authorizeOptions, telemetry}
    });
  }
  _verifyIdToken(id_token, nonce) {
    return verifyIdToken({
      iss: `${this.domainUrl}/`,
      aud: this.options.client_id,
      id_token,
      nonce,
      leeway: this.options.leeway
    });
  }


  oauthToken = async (options) => {
    const body = {
      ...toPairs(options).filter(exists).fromPairs(),
      grant_type: 'authorization_code'
    };
    Log.note("post to /oath/token  {{body|json}}", {body});

    return fetchJson(
        `${this.domainUrl}/oauth/token`,
        {
          method: 'POST',
          headers: {"Content-type": "application/json"},
          body: JSON.stringify(body)
        }
    );

  };
  /**
   * ```js
   * const user = await auth0.getUser();
   * ```
   *
   * Returns the user information if available (decoded
   * from the `id_token`).
   *
   * @param options
   */
  async getUser(options={}){
    options.audience = coalesce(options.audience, this.options.audience);
    options.scope = unionScopes(this.DEFAULT_SCOPE, options.scope, this.options.scope);
    const cache = this.cache.get(options);
    return cache && cache.decodedToken.user;
  }

  /**
   * ```js
   * const claims = await auth0.getIdTokenClaims();
   * ```
   *
   * Returns all claims from the id_token if available.
   *
   * @param options
   */
  async getIdTokenClaims(options={}) {
    options.audience = coalesce(options.audience, this.options.audience);
    options.scope = unionScopes(this.DEFAULT_SCOPE, options.scope, this.options.scope);
    const cache = this.cache.get(options);
    return cache && cache.decodedToken.claims;
  }

  /**
   * ```js
   * await auth0.loginWithRedirect(options);
   * ```
   *
   * Performs a redirect to `/authorize` using the parameters
   * provided as arguments. Random and secure `state` and `nonce`
   * parameters will be auto-generated.
   *
   * @param options
   */
  async loginWithRedirect(options={}){
    try {
      const {
        scope: loginScope,
        redirect_uri,
        appState,
        ...loginOptions  // do not use audience
      } = options;
      const state = encodeState(createRandomString());
      const nonce= createRandomString();
      const code_verifier = createRandomString();
      const code_challenge = bufferToBase64UrlEncoded(await sha256(code_verifier));
      const { domain, leeway, ...withoutDomain } = this.options;

      const scope = unionScopes(this.DEFAULT_SCOPE, this.options.scope, loginScope);

      const url = this._authorizeUrl({
        ...withoutDomain,
        ...loginOptions,
        scope,
        response_type: 'code',
        response_mode: 'query',
        state,
        nonce,
        redirect_uri: redirect_uri || this.options.redirect_uri,
        code_challenge,
        code_challenge_method: 'S256'
      });
      this.transactionManager.create(state, {
        nonce,
        code_verifier,
        appState,
        scope,
      });
      Log.note("GOTO: {{url}}", {url});
      window.location.assign(url);

    } catch (error) {
      Log.error("Problem with login", error);
    }
  };

  /**
   * After the browser redirects back to the callback page,
   * call `handleRedirectCallback` to handle success and error
   * responses from Auth0. If the response is successful, results
   * will be valid according to their expiration times.
   */
  async handleRedirectCallback() {
    if (!window.location.search) {
      throw new Error(
        'There are no query params available at `window.location.search`.'
      );
    }
    const { state, code, error, error_description } = parseQueryResult(
      window.location.search.substr(1)
    );

    if (error) {
      Log.error("problem with callback {{detail|json}}", {detail: {error, error_description, state}});
    }

    const transaction = this.transactionManager.get(state);
    if (!transaction) {
      throw new Error('Invalid state');
    }
    this.transactionManager.remove(state);

    const authResult = await this.oauthToken({
      audience: coalesce(this.options.audience),
      client_id: this.options.client_id,
      code_verifier: transaction.code_verifier,
      redirect_uri: coalesce(this.options.redirect_uri, window.location.origin),
      code
    });

    const decodedToken = this._verifyIdToken(
      authResult.id_token,
      transaction.nonce
    );
    const cacheEntry = {
      ...authResult,
      decodedToken,
      audience: coalesce(transaction.audience),
      scope: transaction.scope
    };
    this.cache.save(cacheEntry);
    ClientStorage.save('auth0.is.authenticated', true, { daysUntilExpire: 1 });
    return {
      appState: transaction.appState
    };
  }

  /**
   * ```js
   * const token = await auth0.getTokenSilently(options);
   * ```
   *
   * If there's a valid token stored, return it. Otherwise, opens an
   * iframe with the `/authorize` URL using the parameters provided
   * as arguments. Random and secure `state` and `nonce` parameters
   * will be auto-generated. If the response is successful, results
   * will be valid according to their expiration times.
   *
   * @param options
   */
  async getTokenSilently(options = {}) {
    const {audience: requestAudience, scope: requestScope, redirect_uri: requestRedirect, ignoreCache = false} = options;
    const { domain, leeway, client_id, audience: authAudience, scope: authScope, redirect_uri: authRedirect, ...withoutDomain } = this.options;
    const audience = coalesce(requestAudience, authAudience);
    const scope = unionScopes(requestScope, authScope, this.DEFAULT_SCOPE);
    const redirect_uri = coalesce(requestRedirect, authRedirect, window.location.origin);
    if (!options.ignoreCache) {
      const cache = this.cache.get({scope, audience});
      if (cache) return cache.access_token;
    }

    const state = encodeState(createRandomString());
    const nonce = createRandomString();
    const code_verifier = createRandomString();
    const code_challengeBuffer = await sha256(code_verifier);
    const code_challenge = bufferToBase64UrlEncoded(code_challengeBuffer);

    const url = this._authorizeUrl({
      ...withoutDomain,
      client_id,
      audience,
      scope,
      response_type: 'code',
      state,
      nonce,
      redirect_uri,
      code_challenge,
      code_challenge_method: 'S256',
      prompt: 'none',
      response_mode: 'web_message',
    });

    const codeResult = await runIframe(url, this.domainUrl);
    if (state !== codeResult.state) {
      throw new Error('Invalid state');
    }
    const authResult = await this.oauthToken({
      audience,
      client_id,
      code_verifier,
      redirect_uri,
      code: codeResult.code
    });
    const decodedToken = this._verifyIdToken(authResult.id_token, nonce);
    const cacheEntry = {
      ...authResult,
      decodedToken,
      scope,
      audience
    };
    this.cache.save(cacheEntry);
    ClientStorage.save('auth0.is.authenticated', true, { daysUntilExpire: 1 });
    return authResult.access_token;
  }

  /**
   * ```js
   * const token = await auth0.getTokenWithPopup(options);
   * ```
   * Opens a popup with the `/authorize` URL using the parameters
   * provided as arguments. Random and secure `state` and `nonce`
   * parameters will be auto-generated. If the response is successful,
   * results will be valid according to their expiration times.
   *
   * @param options
   * @param config
   */
  async getTokenWithPopup(options = {}, config = DEFAULT_POPUP_CONFIG_OPTIONS) {
    options.scope = unionScopes(this.DEFAULT_SCOPE, this.options.scope, options.scope);
    options.audience = coalesce(options.audience, this.options.audience);
    await this.loginWithPopup(options, config);
    const cache = this.cache.get(options);
    return cache.access_token;
  }

  /**
   * ```js
   * auth0.logout();
   * ```
   *
   * Performs a redirect to `/v2/logout` using the parameters provided
   * as arguments. [Read more about how Logout works at Auth0](https://auth0.com/docs/logout).
   *
   * @param options
   */
  logout(options = {}) {
    ClientStorage.remove('auth0.is.authenticated');
    const url = URL({
      path: this.domainUrl + "/v2/logout",
      query: {
        ...options,
        client_id: coalesce(options.client_id,  this.options.client_id),
        telemetry
      }
    });
    window.location.assign(url);
  }
}

export { createAuth0Client, Auth0Client}