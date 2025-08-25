#!/usr/bin/env node

/**
 * MCPO REST API Client Example
 * 
 * Demonstrates how to interact with the Lodgify MCP Server through the MCPO proxy
 * using standard HTTP REST API calls with OpenAPI documentation consumption.
 * 
 * Prerequisites:
 * 1. MCPO proxy running on http://localhost:8000
 * 2. Valid MCPO API key
 * 3. Lodgify API key configured in MCPO
 * 
 * Usage:
 *   node examples/mcpo-client.js
 * 
 * Environment Variables:
 *   MCPO_BASE_URL  - MCPO proxy URL (default: http://localhost:8000)
 *   MCPO_API_KEY   - MCPO API key for authentication
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configuration
const config = {
  baseUrl: process.env.MCPO_BASE_URL || 'http://localhost:8000',
  apiKey: process.env.MCPO_API_KEY || 'mcpo-default-key',
  timeout: 30000, // 30 seconds
};

// Get project root for relative imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

class McpoClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Make authenticated HTTP request to MCPO endpoint
   */
  async request(endpoint, data = {}, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const requestOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'lodgify-mcp-client/1.0.0',
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    };

    console.log(`🚀 ${requestOptions.method} ${url}`);
    if (Object.keys(data).length > 0) {
      console.log(`📤 Request:`, JSON.stringify(data, null, 2));
    }

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log(`📥 Response:`, JSON.stringify(result, null, 2));
      console.log('✅ Success\n');
      
      return result;
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.log('');
      throw error;
    }
  }

  /**
   * Get OpenAPI specification
   */
  async getOpenApiSpec() {
    console.log('📋 Fetching OpenAPI specification...');
    
    const response = await fetch(`${this.baseUrl}/openapi.json`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
    }

    const spec = await response.json();
    console.log(`📋 OpenAPI Version: ${spec.openapi}`);
    console.log(`📋 Title: ${spec.info?.title}`);
    console.log(`📋 Available endpoints: ${Object.keys(spec.paths || {}).length}`);
    console.log('');
    
    return spec;
  }

  /**
   * Test health endpoint
   */
  async testHealth() {
    console.log('🏥 Testing health endpoint...');
    
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (response.ok) {
        const health = await response.json();
        console.log('✅ MCPO proxy is healthy');
        console.log('📥 Health data:', JSON.stringify(health, null, 2));
      } else {
        console.log('⚠️ Health check returned:', response.status);
      }
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
    }
    console.log('');
  }

  /**
   * List all available properties
   */
  async listProperties(params = {}) {
    return this.request('/lodgify/list_properties', params);
  }

  /**
   * Get specific property details
   */
  async getProperty(propertyId) {
    return this.request('/lodgify/get_property', { id: propertyId.toString() });
  }

  /**
   * Find properties by search term
   */
  async findProperties(searchTerm, limit = 10) {
    return this.request('/lodgify/find_properties', {
      searchTerm,
      limit,
      includePropertyIds: true
    });
  }

  /**
   * Check next availability for a property
   */
  async checkAvailability(propertyId, fromDate, daysToCheck = 90) {
    return this.request('/lodgify/check_next_availability', {
      propertyId: propertyId.toString(),
      fromDate,
      daysToCheck
    });
  }

  /**
   * Get availability calendar for a property
   */
  async getAvailabilityCalendar(propertyId, fromDate, daysToShow = 30) {
    return this.request('/lodgify/get_availability_calendar', {
      propertyId: propertyId.toString(),
      fromDate,
      daysToShow
    });
  }

  /**
   * List bookings with optional filters
   */
  async listBookings(params = {}) {
    return this.request('/lodgify/list_bookings', { params });
  }

  /**
   * Get booking details
   */
  async getBooking(bookingId) {
    return this.request('/lodgify/get_booking', { id: bookingId.toString() });
  }

  /**
   * Get quote for property booking
   */
  async getQuote(propertyId, fromDate, toDate, adults = 2, children = 0) {
    const params = {
      from: fromDate,
      to: toDate,
      'guest_breakdown[adults]': adults,
      'guest_breakdown[children]': children
    };

    return this.request('/lodgify/get_quote', {
      propertyId: propertyId.toString(),
      params
    });
  }
}

/**
 * Demo functions to showcase different API capabilities
 */
class McpoDemo {
  constructor(client) {
    this.client = client;
  }

  /**
   * Run basic property management demo
   */
  async runPropertyDemo() {
    console.log('🏨 === PROPERTY MANAGEMENT DEMO ===\n');

    try {
      // List properties
      console.log('📋 Step 1: List available properties');
      const properties = await this.client.listProperties({ limit: 5 });
      
      if (!properties.data?.length) {
        console.log('⚠️ No properties found. Check your Lodgify API configuration.');
        return;
      }

      const firstProperty = properties.data[0];
      console.log(`🎯 Selected property: ${firstProperty.name} (ID: ${firstProperty.id})`);

      // Get property details
      console.log('\n📋 Step 2: Get property details');
      const propertyDetails = await this.client.getProperty(firstProperty.id);

      // Find properties by search
      if (firstProperty.name) {
        console.log('\n📋 Step 3: Search properties');
        const searchTerm = firstProperty.name.split(' ')[0]; // Use first word
        await this.client.findProperties(searchTerm, 3);
      }

    } catch (error) {
      console.error('❌ Property demo failed:', error.message);
    }
  }

  /**
   * Run availability checking demo
   */
  async runAvailabilityDemo() {
    console.log('\n📅 === AVAILABILITY DEMO ===\n');

    try {
      // Get properties first
      const properties = await this.client.listProperties({ limit: 3 });
      
      if (!properties.data?.length) {
        console.log('⚠️ No properties found for availability check.');
        return;
      }

      const property = properties.data[0];
      console.log(`🎯 Checking availability for: ${property.name} (ID: ${property.id})`);

      // Check next availability
      console.log('\n📋 Step 1: Find next available dates');
      const today = new Date().toISOString().split('T')[0];
      const availability = await this.client.checkAvailability(property.id, today, 60);

      // Get availability calendar
      console.log('\n📋 Step 2: Get availability calendar');
      await this.client.getAvailabilityCalendar(property.id, today, 14);

    } catch (error) {
      console.error('❌ Availability demo failed:', error.message);
    }
  }

  /**
   * Run booking management demo
   */
  async runBookingDemo() {
    console.log('\n📖 === BOOKING MANAGEMENT DEMO ===\n');

    try {
      // List recent bookings
      console.log('📋 Step 1: List recent bookings');
      const bookings = await this.client.listBookings({
        limit: 5,
        status: 'confirmed'
      });

      if (!bookings.data?.length) {
        console.log('⚠️ No bookings found.');
        return;
      }

      const firstBooking = bookings.data[0];
      console.log(`🎯 Selected booking: ${firstBooking.id}`);

      // Get booking details
      console.log('\n📋 Step 2: Get booking details');
      await this.client.getBooking(firstBooking.id);

    } catch (error) {
      console.error('❌ Booking demo failed:', error.message);
    }
  }

  /**
   * Run quote generation demo
   */
  async runQuoteDemo() {
    console.log('\n💰 === QUOTE GENERATION DEMO ===\n');

    try {
      // Get properties
      const properties = await this.client.listProperties({ limit: 3 });
      
      if (!properties.data?.length) {
        console.log('⚠️ No properties found for quote generation.');
        return;
      }

      const property = properties.data[0];
      console.log(`🎯 Generating quote for: ${property.name} (ID: ${property.id})`);

      // Generate quote for next month
      const today = new Date();
      const checkIn = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      const checkOut = new Date(checkIn.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 day stay

      const fromDate = checkIn.toISOString().split('T')[0];
      const toDate = checkOut.toISOString().split('T')[0];

      console.log(`📅 Check-in: ${fromDate}, Check-out: ${toDate}`);

      await this.client.getQuote(property.id, fromDate, toDate, 2, 0);

    } catch (error) {
      console.error('❌ Quote demo failed:', error.message);
    }
  }

  /**
   * Run all demos
   */
  async runAllDemos() {
    await this.runPropertyDemo();
    await this.runAvailabilityDemo();
    await this.runBookingDemo();
    await this.runQuoteDemo();
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 MCPO REST API Client Demo');
  console.log('================================\n');

  // Validate configuration
  if (!config.apiKey || config.apiKey === 'mcpo-default-key') {
    console.log('⚠️ Warning: Using default API key. Set MCPO_API_KEY environment variable for production use.\n');
  }

  console.log(`🔗 MCPO Base URL: ${config.baseUrl}`);
  console.log(`🔑 API Key: ${config.apiKey.substring(0, 8)}...\n`);

  // Initialize client
  const client = new McpoClient(config.baseUrl, config.apiKey);
  const demo = new McpoDemo(client);

  try {
    // Test health
    await client.testHealth();

    // Get OpenAPI specification
    await client.getOpenApiSpec();

    // Run demos
    console.log('🎯 Starting API demos...\n');
    await demo.runAllDemos();

    console.log('\n🎉 === DEMO COMPLETED ===');
    console.log(`\n📚 Interactive API docs: ${config.baseUrl}/docs`);
    console.log(`📋 OpenAPI spec: ${config.baseUrl}/openapi.json`);
    console.log('\n💡 Tips:');
    console.log('  - Visit /docs for interactive Swagger UI');
    console.log('  - Use different MCPO_API_KEY for authentication');
    console.log('  - Check logs with: bun run mcpo:logs');
    console.log('  - Monitor with: bun run mcpo:status');

  } catch (error) {
    console.error('\n💥 Demo failed:', error.message);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('  1. Ensure MCPO proxy is running:');
    console.log('     bun run mcpo:start');
    console.log('  2. Check MCPO status:');
    console.log('     bun run mcpo:status');
    console.log('  3. Verify API key:');
    console.log('     export MCPO_API_KEY=your-key');
    console.log('  4. Check logs:');
    console.log('     bun run mcpo:logs');
    console.log(`  5. Test health endpoint manually:`);
    console.log(`     curl -H "Authorization: Bearer ${config.apiKey}" ${config.baseUrl}/health`);
    
    process.exit(1);
  }
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

// Export for programmatic usage
export { McpoClient, McpoDemo };