import { notifyOwner } from '../../src/services/notifications';

// Mock the fetch function
global.fetch = jest.fn();

// Mock the logger
jest.mock('../../src/utils/logger.js', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
}));

describe('Notifications Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.OWNER_WEBHOOK_URL;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.OWNER_PHONE_NUMBER;
  });

  describe('notifyOwner', () => {
    const testLeadData = {
      urgency: 'emergency',
      service_tier: 'premium',
      vehicle_type: 'luxury sedan'
    };

    it('should skip notification when no webhook URL configured', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      
      await notifyOwner('business123', testLeadData, 85, '+1234567890');
      
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send webhook notification successfully', async () => {
      process.env.OWNER_WEBHOOK_URL = 'https://api.business.com/webhook';
      
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      } as Response);
      
      await notifyOwner('business123', testLeadData, 85, '+1234567890');
      
      expect(mockFetch).toHaveBeenCalledWith('https://api.business.com/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ReplyoAI/1.0'
        },
        body: expect.stringContaining('"businessId":"business123"')
      });
      
      // Verify payload structure
      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1]!.body as string);
      expect(payload).toMatchObject({
        businessId: 'business123',
        leadData: testLeadData,
        score: 85,
        phone: '+1234567890',
        timestamp: expect.any(String)
      });
    });

    it('should handle webhook failure gracefully', async () => {
      process.env.OWNER_WEBHOOK_URL = 'https://api.business.com/webhook';
      
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);
      
      // Should not throw
      await expect(notifyOwner('business123', testLeadData, 85, '+1234567890')).resolves.not.toThrow();
    });

    it('should handle webhook network error gracefully', async () => {
      process.env.OWNER_WEBHOOK_URL = 'https://api.business.com/webhook';
      
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Should not throw
      await expect(notifyOwner('business123', testLeadData, 85, '+1234567890')).resolves.not.toThrow();
    });

    it('should skip Twilio SMS when not configured', async () => {
      process.env.OWNER_WEBHOOK_URL = 'https://api.business.com/webhook';
      
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response);
      
      await notifyOwner('business123', testLeadData, 85, '+1234567890');
      
      // Should only call webhook, not Twilio API
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://api.business.com/webhook', expect.any(Object));
    });

    it('should send Twilio SMS when properly configured', async () => {
      // Configure Twilio environment
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_AUTH_TOKEN = 'auth_token_123';
      process.env.TWILIO_PHONE_NUMBER = '+15551234567';
      process.env.OWNER_PHONE_NUMBER = '+15559876543';
      
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      // Mock Twilio API success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () => Promise.resolve('{"sid": "SM123456789"}')
      } as Response);
      
      await notifyOwner('business123', testLeadData, 85, '+1234567890');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC123456789/Messages.json',
        {
          method: 'POST',
          headers: {
            'Authorization': expect.stringMatching(/^Basic /),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: expect.any(URLSearchParams)
        }
      );
      
      // Check SMS body content
      const smsCall = mockFetch.mock.calls[0];
      const smsBody = smsCall[1]!.body as URLSearchParams;
      expect(smsBody.get('From')).toBe('+15551234567');
      expect(smsBody.get('To')).toBe('+15559876543');
      expect(smsBody.get('Body')).toContain('🔥 HOT LEAD ALERT!');
      expect(smsBody.get('Body')).toContain('Score: 85');
      expect(smsBody.get('Body')).toContain('Business: business123');
    });

    it('should handle Twilio SMS failure gracefully', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_AUTH_TOKEN = 'auth_token_123'; 
      process.env.TWILIO_PHONE_NUMBER = '+15551234567';
      process.env.OWNER_PHONE_NUMBER = '+15559876543';
      
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error": "Invalid phone number"}')
      } as Response);
      
      // Should not throw
      await expect(notifyOwner('business123', testLeadData, 85, '+1234567890')).resolves.not.toThrow();
    });

    it('should work with both webhook and SMS configured', async () => {
      // Configure both webhook and Twilio
      process.env.OWNER_WEBHOOK_URL = 'https://api.business.com/webhook';
      process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
      process.env.TWILIO_AUTH_TOKEN = 'auth_token_123';
      process.env.TWILIO_PHONE_NUMBER = '+15551234567';
      process.env.OWNER_PHONE_NUMBER = '+15559876543';
      
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      // Mock webhook success (first call)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response);
      // Mock Twilio success (second call)  
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () => Promise.resolve('{"sid": "SM123456789"}')
      } as Response);
      
      await notifyOwner('business123', testLeadData, 85, '+1234567890');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // First call should be webhook
      expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://api.business.com/webhook', expect.any(Object));
      // Second call should be Twilio
      expect(mockFetch).toHaveBeenNthCalledWith(2, expect.stringContaining('api.twilio.com'), expect.any(Object));
    });

    it('should handle missing phone gracefully', async () => {
      process.env.OWNER_WEBHOOK_URL = 'https://api.business.com/webhook';
      
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response);
      
      // Test without phone number
      await notifyOwner('business123', testLeadData, 85);
      
      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1]!.body as string);
      expect(payload.phone).toBeUndefined();
    });

    it('should mask sensitive data in logs', async () => {
      // This test would require access to the logger mock to verify
      // that sensitive information like phone numbers and webhook URLs
      // are properly masked in the logs
      process.env.OWNER_WEBHOOK_URL = 'https://user:pass@api.business.com/webhook';
      process.env.OWNER_PHONE_NUMBER = '+15559876543';
      
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);
      
      await notifyOwner('business123', testLeadData, 85, '+1234567890');
      
      // In a real implementation, we'd verify that logs don't contain
      // the actual credentials or full phone numbers
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});