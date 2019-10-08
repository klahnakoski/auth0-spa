# Auth0-SPA

A simple working SPA that integrates with Auth0.

## Requirements

This SPA works with an API, which is found here: https://github.com/klahnakoski/auth0-api

## Configuration

The `config.json` file has been set so you can use this SPA served from localhost. An `audience` and `scope` have been set, and must match you API configuration at `auth0.com`.  

* Include `{"scope": "offline_access"}` to see how refresh tokens work
* Exclude `scope` and `audience` to send opaque access tokens to API.

## Features

* Maintains its own state through redirects
* Shares Access Token among tabs
* Handles multiple scenarios access token scenarios


## Code

* `Home.jsx` - is responsible for the simple interface that shows the tokens, and allows you trigger events
* `vendor/auth0/client.js` - is the main library. It is in a vendor as part of a larger suite of code to support multiple SPAs
