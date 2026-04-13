const BASE_URL = process.env.SMART_CAFE_API_URL || 'http://127.0.0.1:5006';

const checks = [
  {
    label: 'Backend health',
    path: '/',
    assert: (body) => typeof body === 'string' && body.toLowerCase().includes('backend api is running')
  },
  {
    label: 'Menu API',
    path: '/api/menu?includeUnavailable=true',
    assert: (body) => body?.success === true && Array.isArray(body.menu) && body.menu.length > 0
  },
  {
    label: 'Orders API',
    path: '/api/orders',
    assert: (body) => body?.success === true && Array.isArray(body.orders)
  },
  {
    label: 'Analytics API',
    path: '/api/orders/analytics',
    assert: (body) => body?.success === true && typeof body?.data?.totalRevenue === 'number'
  },
  {
    label: 'QR table API',
    path: '/api/public/qr-tables?restaurant=smartcafe_main&tables=1&appUrl=http://127.0.0.1:6004',
    assert: (body) => body?.success === true && Array.isArray(body.tables) && Boolean(body.tables[0]?.qr_url)
  }
];

const parseResponse = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const run = async () => {
  console.log(`Running SmartCafe smoke checks against ${BASE_URL}`);

  for (const check of checks) {
    const response = await fetch(`${BASE_URL}${check.path}`);
    if (!response.ok) {
      throw new Error(`${check.label} failed with HTTP ${response.status}`);
    }

    const body = await parseResponse(response);
    if (!check.assert(body)) {
      throw new Error(`${check.label} returned an unexpected payload.`);
    }

    console.log(`PASS ${check.label}`);
  }

  console.log('SmartCafe smoke checks passed.');
};

run().catch((error) => {
  console.error(`SMOKE CHECK FAILED: ${error.message}`);
  process.exit(1);
});
