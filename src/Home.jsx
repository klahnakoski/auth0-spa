import React from "react";

import {Log} from "./vendor/logs";
import {value2json} from "./vendor/convert";
import {fetchJson, fromQueryString} from "./vendor/requests";
import {Auth0Client} from "./vendor/auth0/client";
import config from './config.json';
import {decode as decodeJwt} from "./vendor/auth0/jwt";
import {missing} from "./vendor/utils";
import {GMTDate as Date} from "./vendor/dates";


const dateFormat = (unix) => {
    const d = Date.newInstance(unix);
    return d && d.format('yyyy-MM-dd HH:mm:ss');
};

const decodeToken = (token) => {
    if (missing(token)) return null;

    if (!token.includes(".")) return token;
    const expand = decodeJwt(token);

    expand.claims._expiry = dateFormat(expand.claims.exp);
    expand.claims._issued = dateFormat(expand.claims.iat);
    expand.claims._not_before = dateFormat(expand.claims.nbf);
    return value2json(expand);
};


class Home extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            auth0: null,
            user: null,
            token: null,
            error: null
        };
    }

    async componentDidMount() {
        return this.update();
    }

    async update(){
        if (window.location.search.includes("error=")){
            const details = fromQueryString(window.location.search);
            this.setState({error: details});
            Log.warning("problem with call {{details|json}}", {details});
            return
        }

        const initOptions = config.auth0;
        Log.note("initOptions: {{initOptions|json}}", {initOptions});

        // update() is run multiple times, be sure we do not make multiple auth0
        const auth0 = await Auth0Client.newInstance({...initOptions, onStateChange: () => this.update()});
        const user = auth0.getUser();
        const token = auth0.getAccessToken();
        this.setState({auth0, user, token});

    }

    async apiScope(){
        try{
            const response = await fetchJson(
                "http://localhost:5000/api/private-scoped",
                {
                    headers: {
                        Authorization: "Bearer " + this.state.auth0.getAccessToken()
                    }
                },
            );
            this.setState({response});
        } catch (error) {
            this.setState({response: error});
        }
    }

    async apiPrivate(){
        try {
            const response = await fetchJson(
                "http://localhost:5000/api/private",
                {
                    headers: {
                        Authorization: "Bearer " + this.state.auth0.getAccessToken()
                    }
                },
            );
            this.setState({response});
        }catch (error) {
            this.setState({response: error});
        }
    }

    async refresh(){
        try {
            await this.state.auth0.refreshAccessToken()
        }catch (error) {
            this.setState({response: error});
        }
    }

    async revoke(){
        try {
            await this.state.auth0.revokeRefeshToken()
        }catch (error) {
            this.setState({response: error});
        }
    }

    async reauth(){
        try {
            await this.state.auth0.authorizeSilently();
            this.setState({response: "refresh worked"})
        }catch (error) {
            this.setState({response: error});
        }
    }

    render() {
        const {auth0, user, error, response} = this.state;
        if (error){
            return (<pre>{value2json(error)}</pre>);
        }
        if (!auth0) {
            return (<div>WAIT</div>);
        }
        if (!user) {
            return (<button onClick={() => auth0.authorizeWithRedirect({
                audience:"https://locahost/query",
                scope:"query:send"
            })}>LOGIN</button>);
        }
        const accessToken = auth0.getAccessToken();
        const refreshToken = auth0.getRefreshToken();
        return <div>
            <h2>Actions</h2>
            <button onClick={() => auth0.logout()}>LOGOUT</button>&nbsp;
            <button onClick={() => this.reauth()}>REFRESH AUTHORIZE</button>&nbsp;
            <button onClick={() => this.refresh()}>REFRESH ACCESS TOKEN</button>&nbsp;
            <button onClick={() => this.revoke()}>REVOKE REFRESH TOKEN</button>&nbsp;
            <button onClick={() => this.apiPrivate()}>PRIVATE API REQUEST</button>&nbsp;
            <button onClick={() => this.apiScope()}>SCOPE API REQUEST</button>&nbsp;
            <h2>API Response</h2>
            {response && (<pre>{value2json(response)}</pre>)}
            <h2>RefreshToken</h2>
            {refreshToken && (<pre>{decodeToken(refreshToken)}</pre>)}
            <h2>AccessToken</h2>
            {accessToken && (<pre>{decodeToken(accessToken)}</pre>)}
            <h2>User</h2>
            {user && (<pre>{value2json(user)}</pre>)}
        </div>;
    }

}

export default Home;
