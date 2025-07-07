FROM node:22.16-alpine3.22

ARG version
ARG git_commit

LABEL version=$version
LABEL git_commit=$git_commit
LABEL org.opencontainers.image.authors="marcos.lin@farport.co"

RUN mkdir -p /proj/app

ADD ./dist /proj/app/
ADD ./etc /proj/etc
ADD ./package.json /proj/
ADD ./node_modules /proj/node_modules/

WORKDIR /proj

EXPOSE 8080

ENTRYPOINT ["node"]

CMD ["./app/main.js"]
