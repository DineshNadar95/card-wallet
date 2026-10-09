# Weekly rewards scraper (Render cron). Build from the repo root:
#   docker build -f scraper/Dockerfile -t card-wallet-scraper .
# Official Playwright image: Chromium plus its system libraries. Keep the tag in step with
# the playwright version in scraper/uv.lock.
FROM mcr.microsoft.com/playwright/python:v1.63.0-noble

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv
ENV UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never

WORKDIR /app
# The scraper depends on the backend package (models, DB session, SMTP sender).
COPY backend/ backend/
COPY scraper/ scraper/
WORKDIR /app/scraper
RUN uv sync --frozen --no-dev

# Browsers ship in the base image; don't download them again.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
USER pwuser
CMD ["uv", "run", "--no-sync", "python", "-m", "scraper"]
