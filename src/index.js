import React from "react";
import ReactDOM from "react-dom";
import {HashRouter, Route, Switch} from "react-router-dom";

import Home from "./Home";
import config from "./config";

const App = () => {
    return (
        <HashRouter>
            <Switch>
                <Route path={config.home_path} exact component={Home}/>
            </Switch>
        </HashRouter>
    );
};

ReactDOM.render(
    (<App />),
  document.getElementById("root")
);
