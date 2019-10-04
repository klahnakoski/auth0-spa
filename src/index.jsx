import React from "react";
import ReactDOM from "react-dom";
import {HashRouter, Route, Switch} from "react-router-dom";

import Home from "./views/Home";

const App = () => {
    const {origin, search, hash} = window.location;
    const loco = {origin, search, hash};

    return (
        <HashRouter>
            <Switch>
                <Route path="/" exact component={(props) => new Home({loco, ...props})}/>
            </Switch>
        </HashRouter>
    );
};

ReactDOM.render(
    (<App />),
  document.getElementById("root")
);
