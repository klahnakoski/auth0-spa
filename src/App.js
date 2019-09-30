import React from "react";
import {HashRouter, Route, Switch} from "react-router-dom";

import Home from "./views/Home";

const App = () => {
    const {origin, search, hash} = window.location;
    const loco = {origin, search, hash};  // because web programming sucks


    return (
        <HashRouter>
            <Switch>
                <Route path="/" exact component={(props) => new Home({loco, ...props})}/>
            </Switch>
        </HashRouter>
    );
};

export default App;
