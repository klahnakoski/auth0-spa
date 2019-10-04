import React from "react";

import {Log} from "../vendor/logs";
import {value2json} from "../vendor/convert";
import {fromQueryString} from "../vendor/requests";
import {createAuth0Client} from "../vendor/auth0/Auth0Client";
import OPTIONS from '../auth_config.json';


class Home extends React.Component {

    constructor(props) {
        super(props);
        const {loco} = props;
        this.state = {
            auth0: null,
            user: null,
            token: null,
            loco,
            error: null
        };
    }

    async componentDidMount() {
        const {loco} = this.state;

        if (loco.search.includes("error=")){
            const details = fromQueryString(loco.search);
            this.setState({error: details});
            Log.warning("problem with call {{details|json}}", {details});
            return
        }

        const initOptions = {
            client_id: OPTIONS.clientId || OPTIONS.client_id,
            domain: OPTIONS.domain,
            redirect_uri: loco.origin,
            scope: 'openid email profile',
        };
        Log.note("initOptions: {{initOptions|json}}", {initOptions});

        const auth0 = await createAuth0Client(initOptions);
        this.setState({auth0});

        if (loco.search.includes("code=")) {
            try {
                await auth0.handleRedirectCallback();
            } catch (e) {
                Log.warning("problem with redirect", {cause: e});
                window.history.replaceState({}, null, loco.origin);
            }
        }

        const user = await auth0.getUser();
        if (user) {
            this.setState({user});
            try {
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
                Log.note("API {{response|json}}", {response});
            } catch (error) {
                this.setState({error});
                Log.warning("problem with getting token", error);
            }
        }
    }


    render() {
        const {auth0, user, token, error} = this.state;
        if (error){
            return (<pre>{value2json(error)}</pre>);
        }
        if (!auth0) {
            return (<div>WAIT</div>);
        }
        if (!user) {
            return (<button onClick={() => auth0.loginWithRedirect({
                audience:"https://locahost/query",
                scope:"query:send"
            })}>LOGIN</button>);
        }
        return <div>
            <button onClick={() => auth0.logout()}>LOGOUT</button>
            {token && (<pre>{value2json(token)}</pre>)}
            {user && (<pre>{value2json(user)}</pre>)}
            READY!
        </div>;
    }

}

export default Home;
