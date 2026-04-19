FROM alpine:3.20

RUN apk add --no-cache bash git curl gettext docker-cli docker-cli-compose webhook

COPY hooks.json.template /etc/webhook/hooks.json.template
COPY deploy.sh /usr/local/bin/deploy.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/deploy.sh /usr/local/bin/entrypoint.sh

EXPOSE 9000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
