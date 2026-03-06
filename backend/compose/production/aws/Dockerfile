FROM amazon/aws-cli:latest

COPY ./backend/compose/production/aws/maintenance /usr/local/bin/maintenance
COPY ./backend/compose/local/postgres/maintenance/_sourced /usr/local/bin/maintenance/_sourced

RUN chmod +x /usr/local/bin/maintenance/*

RUN mv /usr/local/bin/maintenance/* /usr/local/bin && rmdir /usr/local/bin/maintenance
