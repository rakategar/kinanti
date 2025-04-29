const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: "/usr/bin/google-chrome", // Path ke bin google-chrome
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

module.exports = { client };
