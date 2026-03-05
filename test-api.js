const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/reports/ordered-items?startDate=2025-01-01&endDate=2025-12-31',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer nikfoodsllc@gmail.com:Admin@123',
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data.substring(0, 1000));
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();
