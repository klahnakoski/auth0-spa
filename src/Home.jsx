import React from "react";

import {Log} from "./vendor/logs";
import {value2json} from "./vendor/convert";
import {fromQueryString} from "./vendor/requests";
import {Auth0Client} from "./vendor/auth0/Auth0Client";
import config from './config.json';
import {decode as decodeJwt} from "./vendor/auth0/jwt";

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
        if (window.location.search.includes("error=")){
            const details = fromQueryString(window.location.search);
            this.setState({error: details});
            Log.warning("problem with call {{details|json}}", {details});
            return
        }

        const initOptions = {
            ...config.auth0,
            scope: 'openid email profile',
        };
        Log.note("initOptions: {{initOptions|json}}", {initOptions});

        const auth0 = await Auth0Client.newInstance(initOptions);
        this.setState({auth0});

        const user = await auth0.getUser();
        if (user) {
            this.setState({user});
            try {
                const token = await auth0.authorizeSilently();
                this.setState({token});

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
            return (<button onClick={() => auth0.authorizeWithRedirect({
                audience:"https://locahost/query",
                scope:"query:send"
            })}>LOGIN</button>);
        }
        return <div>
            <button onClick={() => auth0.logout()}>LOGOUT</button>
            {token && (<pre>{value2json(token.includes(".") ? decodeJwt(token) : token)}</pre>)}
            {user && (<pre>{value2json(user)}</pre>)}
            READY!
        </div>;
    }

}

export default Home;
