const CACHE_KEY = 'expenseflow_rates';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Fallback rates (approximate, for demo/offline use)
const MOCK_RATES = {
  USD: { EUR: 0.92, GBP: 0.79, INR: 83.5, JPY: 149.5, CAD: 1.36, AUD: 1.53, CHF: 0.88, CNY: 7.24 },
  EUR: { USD: 1.09, GBP: 0.86, INR: 90.8, JPY: 162.5, CAD: 1.48, AUD: 1.66, CHF: 0.96, CNY: 7.87 },
  GBP: { USD: 1.27, EUR: 1.16, INR: 105.6, JPY: 189.0, CAD: 1.72, AUD: 1.93, CHF: 1.11, CNY: 9.16 },
  INR: { USD: 0.012, EUR: 0.011, GBP: 0.0095, JPY: 1.79, CAD: 0.016, AUD: 0.018, CHF: 0.011, CNY: 0.087 },
  JPY: { USD: 0.0067, EUR: 0.0062, GBP: 0.0053, INR: 0.56, CAD: 0.0091, AUD: 0.010, CHF: 0.0059, CNY: 0.048 },
};

function getCachedRates() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const { rates, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return rates;
  } catch {
    return null;
  }
}

function setCachedRates(from, to, rate) {
  try {
    const cached = getCachedRates() || {};
    const key = `${from}_${to}`;
    cached[key] = rate;
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      rates: cached,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn('Failed to cache rates:', e);
  }
}

export async function getExchangeRate(from, to) {
  if (from === to) return 1;

  // Check cache
  const cached = getCachedRates();
  const cacheKey = `${from}_${to}`;
  if (cached && cached[cacheKey]) {
    return cached[cacheKey];
  }

  // Try ExchangeRate API (Required by Hackathon)
  try {
    const res = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${from}`
    );
    if (res.ok) {
      const data = await res.json();
      const rate = data.rates[to];
      if (rate) {
        setCachedRates(from, to, rate);
        return rate;
      }
    }
  } catch (err) {
    console.warn('Frankfurter API failed, using fallback:', err);
  }

  // Fallback: mock rates
  if (MOCK_RATES[from] && MOCK_RATES[from][to]) {
    return MOCK_RATES[from][to];
  }

  // Reverse lookup
  if (MOCK_RATES[to] && MOCK_RATES[to][from]) {
    return 1 / MOCK_RATES[to][from];
  }

  // Default: no conversion
  console.warn(`No rate found for ${from} → ${to}`);
  return 1;
}

export async function convertCurrency(amount, from, to) {
  const rate = await getExchangeRate(from, to);
  return {
    convertedAmount: parseFloat((amount * rate).toFixed(2)),
    exchangeRate: rate,
  };
}

// Fetch all countries + currencies for the signup form
let countriesCache = null;

export async function getCountriesWithCurrencies() {
  if (countriesCache) return countriesCache;

  try {
    const res = await fetch('https://restcountries.com/v3.1/all?fields=name,currencies');
    if (res.ok) {
      const data = await res.json();
      const result = data
        .map(c => {
          const currencyCode = c.currencies ? Object.keys(c.currencies)[0] : null;
          const currencyName = currencyCode && c.currencies[currencyCode]
            ? c.currencies[currencyCode].name
            : null;
          return {
            name: c.name.common,
            currencyCode,
            currencyName,
          };
        })
        .filter(c => c.currencyCode)
        .sort((a, b) => a.name.localeCompare(b.name));
      countriesCache = result;
      return result;
    }
  } catch (err) {
    console.warn('Failed to fetch countries:', err);
  }

  // Fallback
  countriesCache = [
    { name: 'India', currencyCode: 'INR', currencyName: 'Indian rupee' },
    { name: 'United States', currencyCode: 'USD', currencyName: 'United States dollar' },
    { name: 'United Kingdom', currencyCode: 'GBP', currencyName: 'Pound sterling' },
    { name: 'Germany', currencyCode: 'EUR', currencyName: 'Euro' },
    { name: 'Japan', currencyCode: 'JPY', currencyName: 'Japanese yen' },
    { name: 'Canada', currencyCode: 'CAD', currencyName: 'Canadian dollar' },
    { name: 'Australia', currencyCode: 'AUD', currencyName: 'Australian dollar' },
  ];
  return countriesCache;
}
