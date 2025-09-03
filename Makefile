GCP_PROJECT      := $(shell gcloud config list --format="value(core.project)")

IMAGE_PREFIX     := farport
IMAGE_BASE       := crun-jwt-node-proxy
IMAGE_VERSION    := $(shell node scripts/packageInfo.js)
IMAGE_NAME       := $(IMAGE_PREFIX)/$(IMAGE_BASE):$(IMAGE_VERSION)

LABEL_VERSION    := $(shell echo $(IMAGE_VERSION) | sed -e 's/\./_/g')
GIT_COMMIT       := $(shell scripts/githash.sh)
GIT_UNCOMMITED   := $(shell git status --porcelain=v1 | wc -l)

CERTS_DIR        := ./certs

DOCKER_RUN_OPTIONS := --rm \
	--env NODE_ENV=production \
	--network="host"

man :
	@echo "Options:"
	@echo " - gcloud-builds: build docker image"

$(CERTS_DIR) :
	@mkdir -p $(CERTS_DIR)

$(CERTS_DIR)/private-key.pem : | $(CERTS_DIR)
	openssl genrsa -out $@ 2048

$(CERTS_DIR)/csr.csr : $(CERTS_DIR)/private-key.pem 
	openssl req -new -key $< -out $@ -subj "/C=IT/ST=Lazio/L=Rome/O=Farport Software/OU=FP8/CN=fp8netes-dev"

$(CERTS_DIR)/client-identity.pem : $(CERTS_DIR)/csr.csr
	openssl req -x509 -sha256 -days 365 -key $(CERTS_DIR)/private-key.pem -in $(CERTS_DIR)/csr.csr -out $@

$(CERTS_DIR)/client-identity.p12 : $(CERTS_DIR)/client-identity.pem
	openssl pkcs12 -export -out $@ -inkey $(CERTS_DIR)/private-key.pem -in $<

gcloud-builds :
ifeq ("", $(GCP_PROJECT))
	$(error Gcloud project must be set)
endif
	gcloud builds submit \
		--region=europe-west1 \
		--substitutions=_DOCKER_PREFIX="$(IMAGE_PREFIX)",_DOCKER_VERSION="$(IMAGE_VERSION)",_GIT_COMMIT="$(GIT_COMMIT)"

docker-build :
	@echo "- Building $(IMAGE_NAME)"
	docker build --platform linux/amd64 --rm \
		$(DOCKER_BUILD_OPTIONS) \
		-f Dockerfile -t $(IMAGE_NAME) .

docker-run :
ifeq ("", $(GCP_PROJECT))
	$(error Gcloud project must be set)
endif
	@echo "- Running $(IMAGE_NAME)"
	docker run $(DOCKER_RUN_OPTIONS) \
		--env GOOGLE_CLOUD_PROJECT=$(GCP_PROJECT) \
		--name $(IMAGE_BASE) \
		-p 8888:8888 \
		$(IMAGE_NAME)

docker-push :
ifeq ("", $(GCP_PROJECT))
	$(error Gcloud project must be set)
endif
	@echo "- Pushing $(IMAGE_NAME)"
	docker push $(IMAGE_NAME)

start-request-echo :
	docker run -p 8080:8080 --rm -t mendhak/http-https-echo:37

setup: $(CERTS_DIR)/client-identity.p12

clean:
	rm -rf $(CERTS_DIR)
	rm -rf ./dist

.PHONY : man setup gcloud-builds start-request-echo docker-build docker-run docker-push clean
