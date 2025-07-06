# proxy

## Generate certs

```
openssl genrsa -out key.pem 2048
openssl req -new -sha256 -key key.pem -out csr.csr
openssl req -x509 -sha256 -days 365 -key key.pem -in csr.csr -out certificate.pem
openssl pkcs12 -export -out client-identity.p12 -inkey key.pem -in certificate.pem
```

```
gcloud auth print-identity-token
```

## Cloud Run Commands

```
docker run -p 8080:8080 -p 8443:8443 --rm -t mendhak/http-https-echo:37


gcloud run services update request-echo \
  --region europe-west1 \
  --add-custom-audiences=fp8netes-dev

gcloud run services add-iam-policy-binding request-echo \
  --region=europe-west1 \
  --member=allAuthenticatedUsers \
  --role=roles/run.invoker


gcloud run services update request-echo --region europe-west1 --clear-custom-audiences

gcloud run services update request-echo --region europe-west1 --add-custom-audiences=fp8netes-dev

gcloud run services describe request-echo --region europe-west1 --format=json


gcloud run services describe request-echo --region europe-west1 --format=yaml > service.yaml
gcloud run services replace service.yaml
```