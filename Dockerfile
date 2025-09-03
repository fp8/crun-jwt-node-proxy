FROM node:22.16-alpine3.22

ARG version
ARG git_commit

LABEL version=$version
LABEL git_commit=$git_commit
LABEL org.opencontainers.image.authors="marcos.lin@farport.co"

RUN mkdir -p /proj/app

COPY ./dist /proj/app/
COPY ./etc/config.yaml /proj/etc/config.yaml
COPY ./etc/logger.json /proj/etc/logger.json
COPY ./node_modules /proj/node_modules/
COPY ./package.json /proj/

WORKDIR /proj

EXPOSE 8080

ENTRYPOINT ["node"]

CMD ["./app/index.js"]
