# Auth0-SPA

A simple working SPA that integrates with Auth0.

## Requirements

This SPA works with an API, which is found here: https://github.com/klahnakoski/auth0-api

## Configuration

The `config.json` file has been set so you can use this SPA served from `http://dev.localhost`. An `audience` and `scope` have been set, and must match you API configuration at `auth0.com`.  

* Include `{"scope": "offline_access"}` to see how refresh tokens work
* Exclude `scope` and `audience` to send opaque access tokens to API.

> Be sure to add `dev.localhost` to you `hosts` file

## Execution

Be sure to install and start:

    yarn install
    yarn start






## Features

* Maintains its own state through redirects
* Shares Access Token among tabs
* Handles multiple authentication scenarios
* Trades Access Token for Session Token (as cookie) once API is contacted

## Code

* `Home.jsx` - is responsible for the simple interface that shows the tokens, and allows you trigger events
* `vendor/auth0/client.jsx` - is the main library. It is in a vendor as part of a larger suite of code to support multiple SPAs
