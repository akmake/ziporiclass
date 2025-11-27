import axios from 'axios';
import * as cheerio from 'cheerio';

export const getFundPriceBizportal = async (fundNumber) => {
  const url = `https://www.bizportal.co.il/mutualfunds/quote/generalview/${fundNumber}`;
  try {
    const { data } = await axios.get(url, { timeout: 8000 });
    const $ = cheerio.load(data);
    const priceText = $("div.num").first().text().trim().replace(/,/g, '');

    if (priceText) {
      const priceAgorot = parseFloat(priceText);
      return priceAgorot / 100.0; // המרה מאגורות לשקלים
    }
    return 0.0;
  } catch (error) {
    console.error(`Failed to fetch price for fund ${fundNumber}:`, error.message);
    return 0.0;
  }
};