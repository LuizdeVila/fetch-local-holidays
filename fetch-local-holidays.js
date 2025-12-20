require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');

const URL = 'https://feriadosbancarios.febraban.org.br/Municipais/Listar';
const YEAR = new Date().getFullYear();
const OUTPUT_FILE = `holidays_${YEAR}.json`;

async function fetchCity(state, city) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  try {
    await page.goto(URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector("select[name='Uf']");
    await page.select("select[name='Uf']", state);

    await new Promise(resolve => setTimeout(resolve, 5000));

    await page.waitForSelector("select[name='Municipio']");
    await page.select("select[name='Municipio']", city);

    await page.click('.botao');

    await page.waitForFunction(() => {
      const row = document.querySelector('table tbody tr');

      return row && !row.innerText.includes('Selecione um dos filtros');
    }, { timeout: 30000 });

    return await page.evaluate(() => {
      return Array.from(document.querySelectorAll('table tbody tr')).map(row => {
        const cols = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());

        return { date: cols[0], state: cols[1], city: cols[2], type: cols[3] };
      });
    });
  } finally {
    await browser.close();
  }
}

(async () => {
  const result = [];

  for (const loc of JSON.parse(process.env.LOCATIONS || "[]")) {
    const [state, city] = loc;
    try {
      const holidays = await fetchCity(state, city);

      result.push({
        state,
        city,
        holidays,
        status: "success",
        updatedAt: new Date().toISOString()
      });

      console.log(`✔ ${city}/${state} coletado`);
    } catch (err) {

      result.push({
        state,
        city,
        holidays: [],
        status: "error",
        errorMessage: err.message,
      });

      console.error(`❌ Falha em ${city}/${state}:`, err.message);
    }
  }

  const jsonData = JSON.stringify(result, null, 2);

  try {
    fs.writeFileSync(OUTPUT_FILE, jsonData);

    console.log(`✅ Arquivo ${OUTPUT_FILE} gerado!`);
  } catch (error) {
    console.error('❌ Erro ao salvar arquivo:', error.message);

    process.exit(1);
  }
})();
