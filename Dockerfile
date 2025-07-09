FROM farport/node-builder:22.16.0-alpine AS builder

RUN mkdir -p /proj/src

ADD ./.yarnrc.yml /proj/
ADD ./Dockerfile /proj/
ADD ./etc/config.yaml /proj/etc/config.yaml
ADD ./etc/logger.json /proj/etc/logger.json
ADD ./package.json /proj/
ADD ./src /proj/src/
ADD ./tsconfig.build.json /proj/
ADD ./tsconfig.json /proj/
ADD ./yarn.lock /proj/

WORKDIR /proj

RUN yarn install
RUN yarn build:ts
RUN yarn workspaces focus --production
RUN ls -l

FROM node:22.16-alpine3.22

ARG version
ARG git_commit

LABEL version=$version
LABEL git_commit=$git_commit
LABEL org.opencontainers.image.authors="marcos.lin@farport.co"

RUN mkdir -p /proj/app

COPY --from=builder /proj/dist /proj/app/
COPY --from=builder /proj/etc /proj/etc/
COPY --from=builder /proj/node_modules /proj/node_modules/
COPY --from=builder /proj/package.json /proj/

WORKDIR /proj

EXPOSE 8080

ENTRYPOINT ["node"]

CMD ["./app/index.js"]
