// Test script for ordered-items API endpoint
const http = require('http');

function testAPI(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/admin/reports/ordered-items?startDate=${startDate}&endDate=${endDate}`,
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
        try {
          const response = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: response
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            rawData: data.substring(0, 500)
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function main() {
  console.log('Testing ordered-items API endpoint...\n');
  
  try {
    // Test with a wide date range
    console.log('Test 1: Wide date range (2025-01-01 to 2025-12-31)');
    const result1 = await testAPI('2025-01-01', '2025-12-31');
    console.log('Status:', result1.statusCode);
    if (result1.data) {
      console.log('Success:', result1.data.success);
      console.log('Message:', result1.data.message);
      console.log('Data length:', result1.data.data?.length || 0);
      if (result1.data.data && result1.data.data.length > 0) {
        console.log('First item sample:', JSON.stringify(result1.data.data[0]).substring(0, 200));
      }
    } else {
      console.log('Raw response:', result1.rawData);
    }
    console.log('\n');

    // Test with current month
    console.log('Test 2: Current month (2025-03-01 to 2025-03-31)');
    const result2 = await testAPI('2025-03-01', '2025-03-31');
    console.log('Status:', result2.statusCode);
    if (result2.data) {
      console.log('Success:', result2.data.success);
      console.log('Message:', result2.data.message);
      console.log('Data length:', result2.data.data?.length || 0);
    }
    console.log('\n');

    // Test with specific date range
    console.log('Test 3: Specific date range (2025-01-01 to 2025-01-31)');
    const result3 = await testAPI('2025-01-01', '2025-01-31');
    console.log('Status:', result3.statusCode);
    if (result3.data) {
      console.log('Success:', result3.data.success);
      console.log('Message:', result3.data.message);
      console.log('Data length:', result3.data.data?.length || 0);
    }

  } catch (error) {
    console.error('Error testing API:', error.message);
    console.log('\nNote: This might be due to server connectivity issues.');
    console.log('The server is running on port 3000, but the connection might be blocked.');
  }
}

main();
