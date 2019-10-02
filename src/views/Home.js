import React from "react";

import createAuth0Client from "../vendor/auth0";
import OPTIONS from '../auth_config.json';
import {
    bufferToBase64UrlEncoded,
    createRandomString,
    encodeState,
    getUniqueScopes,
    sha256
} from "../vendor/auth0/utils";

import { Log } from "../vendor/logs"

class Home extends React.Component{

    constructor(props){
        super(props);
        const {loco} = props;
        this.state={auth0:null, user:null, token: null, loco};
    }

    async componentDidMount() {
        const {loco} = this.state;

        const initOptions = {
            client_id: OPTIONS.clientId || OPTIONS.client_id,
            domain: OPTIONS.domain,
            redirect_uri: loco.origin,
            scope: 'openid email profile'
            // audience: "5ce5797952ed1e0857fad60f"
        };
        Log.note("initOptions: {{initOptions|json}}", {initOptions});

        const auth0 = await createAuth0Client(initOptions);
        this.setState({auth0});

        if (loco.search.includes("code=")) {
            try {
                await auth0.handleRedirectCallback();
            }catch(e){
                Log.warning("problem with redirect", {cause:e});
                window.location.assign(loco.origin);
            }
        }

        const user = await auth0.getUser();
        if (user){
            this.setState({user});
            const token = await auth0.getTokenSilently();
            this.setState({token});

            // window.location.assign(loco.origin);
            const response = await fetch(
                "http://localhost:5000/api/private",
                {
                    method: 'POST',
                    headers: new Headers({
                        Accept: 'application/json',
                        Authorization: "Bearer " + token
                    }),
                    referer: "",
                    body: "{}"
                },

            );
            Log.note("{{response}}", {response});
        }
    }

    async loginWithRedirect(options){
        const {
            scope: loginScope,
            redirect_uri,
            appState,
            audience='default',
            ...loginOptions
        } = options || {};
        try {
            const {auth0} = this.state;
            const state = encodeState(createRandomString());
            const nonce= createRandomString();
            const code_verifier = createRandomString();
            const code_challenge = bufferToBase64UrlEncoded(await sha256(code_verifier));
            const { domain, leeway, ...withoutDomain } = auth0.options;

            const combinedScope = getUniqueScopes(
                auth0.DEFAULT_SCOPE,
                auth0.options.scope,
                loginScope
            );

            const url = auth0._authorizeUrl({
                ...withoutDomain,
                ...loginOptions,
                scope: combinedScope,
                response_type: 'code',
                response_mode: 'query',
                state,
                nonce,
                redirect_uri: redirect_uri || auth0.options.redirect_uri,
                code_challenge,
                code_challenge_method: 'S256'
            });
            auth0.transactionManager.create(state, {
                nonce,
                code_verifier,
                appState,
                scope: combinedScope,
                audience
            });
            Log.note("GOTO: {{url}}", {url});
            window.location.assign(url);

        } catch (error) {
            Log.error("Problem with login", error);
        }
    };

    render(){
        const {auth0, user, token} = this.state;
        if (!auth0) {
            return (<div>WAIT</div>);
        }
        if (!user) {
            return (<button onClick={() => this.loginWithRedirect()}>LOGIN</button>);
        }
        return <div>
            {token && (<div>{JSON.stringify(token)}</div>)}
            {user && (<div>{JSON.stringify(user)}</div>)}
            {'READY!'}
        </div>;
    }

}

export default Home;
