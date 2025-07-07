# crun-jwt-proxy

This project creates a docker image that is to be deployed as a sidecar
in a cloud run service to validate firebase jwt.  The validation is
project id specific so as long as `GOOGLE_CLOUD_PROJECT` is provided
the Firebase Auth jwt should be validated correctly.



## ENV needed for proxy service

Following ends are required for cloud run to work:

* `GOOGLE_CLOUD_PROJECT`: This must be set to the cloud run project id
* `PROXY_TARGET`: The url of target project. Defaults to `http://localhost:8080`
* `PORT`: The port that proxy should be listening.  Defaults to `8888`

## Local Dev

There are 2 envs setup for local development:

* `local`: This env is setup to point to `request-echo` Cloud Run service in `fp8netes-dev`.  You must generate a client certificate to use this by running `make setup`
* `local-http`: This env is setup to point to `http://localhost:8080`.  You can lauch the local version of `request-echo` by running `make start-request-echo`
