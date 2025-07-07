IMAGE_VERSION    := $(shell node scripts/package-version.js)
LABEL_VERSION    := $(shell echo $(IMAGE_VERSION) | sed -e 's/\./_/g')
GIT_COMMIT       := $(shell scripts/git-commit.sh)
GIT_UNCOMMITED   := $(shell git status --porcelain=v1 | wc -l)
GCP_PROJECT      := $(shell gcloud config list --format="value(core.project)")

CERTS_DIR        := ./certs

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
ifneq (fp8netes-dev, $(GCP_PROJECT))
	$(error Gcloud project must be fp8netes-dev but got $(GCP_PROJECT))
endif
	gcloud builds submit \
		--region=europe-west1 \
		--substitutions=_DOCKER_VERSION="$(IMAGE_VERSION)",_GIT_COMMIT="$(GIT_COMMIT)"

start-request-echo :
	docker run -p 8080:8080 --rm -t mendhak/http-https-echo:37

setup: $(CERTS_DIR)/client-identity.p12

clean:
	rm -rf $(CERTS_DIR)
	rm -rf ./dist

.PHONY : man setup gcloud-builds start-request-echo clean
