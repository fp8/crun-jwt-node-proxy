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

## Build

There is one problem when running `make gcloud-builds`.  The `yarn.lock` is modified in
linux and causing the build to fail.  To fix this, we need to run `yarn` in the linux
which will update `yarn.lock` that is suitable for the Cloud Build.  To do that:

```bash
docker run --rm --platform linux/amd64 \
    -v $PWD/:/app \
    -w /app \
    --entrypoint /usr/local/bin/yarn \
    -it farport/node-builder:22.16.0-alpine

# Exit the container and run
make gcloud-builds
```

Do not commit the changes to the `yarn.lock` file.

## Run Container Locally

```
docker run --rm -e GOOGLE_CLOUD_PROJECT=fp8netes-dev -it europe-west1-docker.pkg.dev/fp8netes-dev/docker/crun-jwt-proxy:0.1.0
```