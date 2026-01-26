const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    executablePath: "/usr/bin/google-chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--hide-scrollbars",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-default-browser-check",
      "--safebrowsing-disable-auto-update",
      "--ignore-certificate-errors",
      "--ignore-ssl-errors",
      "--ignore-certificate-errors-spki-list",
    ],
  },
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/AKASHAorg/webwhatsapp-versions/main/canary.json",
  },
  restartOnAuthFail: true,
});

module.exports = { client };
