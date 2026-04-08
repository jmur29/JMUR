'use strict';

const axios = require('axios');

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

/**
 * Create a pre-configured axios instance for the GoHighLevel REST API v2.
 * Reads GHL_API_KEY from environment variables (expects a pit-... token).
 */
function createGhlClient() {
  if (!process.env.GHL_API_KEY) {
    throw new Error('GHL_API_KEY environment variable is not set.');
  }

  const client = axios.create({
    baseURL: GHL_BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
    timeout: 15_000,
  });

  // Log outgoing requests in debug mode
  client.interceptors.request.use((config) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[GHL] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  });

  // Normalize error messages for clarity
  client.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err.response?.status;
      const data = err.response?.data;
      const msg = data?.message || data?.msg || err.message;
      const enriched = new Error(`GHL API error ${status}: ${msg}`);
      enriched.status = status;
      enriched.data = data;
      return Promise.reject(enriched);
    }
  );

  return client;
}

module.exports = { createGhlClient };
