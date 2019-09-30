import React from "react";

import createAuth0Client from "@auth0/auth0-spa-js";
import OPTIONS from '../auth_config.json';

class Home extends React.Component{

    constructor(props){
        super(props);
        const {loco} = props;
        this.state={auth0:null, user:null, loco};
    }

    async componentDidMount() {
        const {loco} = this.state;

        const initOptions = {
            client_id: OPTIONS.clientId || OPTIONS.client_id,
            domain: OPTIONS.domain,
            redirect_uri: loco.origin
        };
        console.log(JSON.stringify(initOptions));

        const auth0 = await createAuth0Client(initOptions);
        this.setState({auth0});

        if (loco.search.includes("code=")) {
            try {
                await auth0.handleRedirectCallback();
            }catch(e){
                console.warn(e);
                window.location.assign(loco.origin);
            }
        }
        if (await auth0.isAuthenticated()){
            const user = await auth0.getUser();
            this.setState({user});
        }
    }

    async login(){
        try {
            const {auth0} = this.state;
            await auth0.loginWithRedirect();
        } catch (error) {
            console.error(error);
        }
    };

    render(){
        const {auth0, user} = this.state;
        if (auth0) {
            if (!user) {
                return (
                    <button onClick={() => this.login()}>LOGIN</button>
                );
            } else {
                return (<div>READY!</div>);
            }
        }else{
            return (<div>WAIT</div>);
        }
    }

}

export default Home;
