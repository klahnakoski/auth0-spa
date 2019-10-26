import React from "react";

import {Log} from "./vendor/logs";
import {value2json} from "./vendor/convert";
import {fromQueryString} from "./vendor/requests";
import {Auth0Client} from "./vendor/auth0/client";
import config from './config.json';
import {QRCode} from "./vendor/auth0/qr";

class Home extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            auth0: null,
            user: null,
            cookie: null,
            token: null,
            error: null,
            qr: null,
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
        const user = auth0.getIdToken();
        const token = auth0.getAccessToken();
        const cookie = auth0.getCookie();
        this.setState({auth0, user, token, cookie});
    }

    async apiPublic(){
        try{
            const response = await this.state.auth0.fetchJson("http://dev.localhost:5000/api/public");
            const cookie = this.state.auth0.getCookie();
            this.setState({response, cookie});
        } catch (error) {
            this.setState({response: error});
        }
    }

    async apiScope(){
        try{
            const response = await this.state.auth0.fetchJson("http://dev.localhost:5000/api/private-scoped");
            const cookie = this.state.auth0.getCookie();
            this.setState({response, cookie});
        } catch (error) {
            this.setState({response: error});
        }
    }

    async apiPrivate(){
        try {
            const response = await this.state.auth0.fetchJson("http://dev.localhost:5000/api/private");
            const cookie = this.state.auth0.getCookie();
            this.setState({response, cookie});
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

    async device(){
        try {
            this.setState({qr: <QRCode auth0={this.state.auth0}/>});
        }catch (error) {
            this.setState({response: error});
        }
    }

    render() {
        const {auth0, user, token, cookie, qr, error, response} = this.state;
        if (error){
            return (<pre>{value2json(error)}</pre>);
        }
        if (!auth0) {
            return (<div>WAIT</div>);
        }
        if (!cookie && !token){
            if (qr){
                return qr;
            }
            return (<div>
                <button onClick={() => auth0.authorizeWithRedirect({
                    audience:"https://locahost/query",
                    scope:"query:send"
                })}>LOGIN</button>
                &nbsp;
                <button onClick={()=>this.device()}>DEVICE LOGIN</button>
            </div>);
        }
        const refreshToken = auth0.getRefreshToken();
        return (<div>
            <h2>Actions</h2>
            <button onClick={() => auth0.logout()}>LOGOUT</button>
            <br/>
            <button onClick={() => this.apiPublic()}>PUBLIC API REQUEST</button>
            &nbsp;
            <button onClick={() => this.apiPrivate()}>PRIVATE API REQUEST</button>
            &nbsp;
            <button onClick={() => this.apiScope()}>SCOPE API REQUEST</button>
            {response && (<div>
                <h2>API Response</h2>
                <pre>{value2json(response)}</pre>
            </div>)}
            {refreshToken && (<div>
                <h2>Refresh Token</h2>
                <button onClick={() => this.refresh()}>USE REFRESH TOKEN FOR NEW ACCESS TOKEN</button>
                &nbsp;
                <button onClick={() => this.revoke()}>REVOKE REFRESH TOKEN</button>
                &nbsp;
                <pre>{value2json(refreshToken)}</pre>
            </div>)}
            {cookie && (<div>
                <h2>Session Cookie</h2>
                <pre>{value2json(cookie)}</pre>

            </div>)}
            {token && (<div>
                <h2>Access Token</h2>
                <button onClick={() => this.reauth()}>REFRESH AUTHORIZE</button>
                <br/>
                <pre>{value2json(token)}</pre>

            </div>)}
            {user && (<div>
                <h2>ID Token</h2>
                <pre>{value2json(user)}</pre>

            </div>)}
        </div>);
    }

}

export default Home;
