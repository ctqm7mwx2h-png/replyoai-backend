import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import axios from 'axios';
import { MetaOAuthController } from '../../src/controllers/meta.oauth.controller.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock prisma
jest.mock('../../src/models/index.js', () => ({
  prisma: {
    businessProfile: {
      upsert: jest.fn(),
    },
  },
}));

describe('MetaOAuthController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusSpy: jest.MockedFunction<any>;
  let sendSpy: jest.MockedFunction<any>;

  beforeEach(() => {
    sendSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ send: sendSpy });
    
    mockResponse = {
      status: statusSpy,
      send: sendSpy,
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('handleCallback', () => {
    it('should handle missing code parameter', async () => {
      mockRequest = {
        query: {},
      };

      await MetaOAuthController.handleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('Missing authorization code'));
    });

    it('should handle OAuth callback with code parameter', async () => {
      mockRequest = {
        query: {
          code: 'test_auth_code_123',
          state: 'optional_state',
        },
      };

      // Mock axios responses for successful OAuth flow
      mockedAxios.get
        // First call: Exchange code for short-lived token
        .mockResolvedValueOnce({
          data: { access_token: 'short_lived_token_123' }
        })
        // Second call: Exchange for long-lived token
        .mockResolvedValueOnce({
          data: { access_token: 'long_lived_token_456' }
        })
        // Third call: Get Instagram account info
        .mockResolvedValueOnce({
          data: {
            accounts: {
              data: [{
                id: 'page_123',
                name: 'Test Business Page',
                instagram_business_account: {
                  id: 'ig_123',
                  username: 'testbusiness'
                }
              }]
            }
          }
        });

      const { prisma } = await import('../../src/models/index.js');
      (prisma.businessProfile.upsert as jest.MockedFunction<any>).mockResolvedValue({
        id: 'business_123',
        igUsername: 'testbusiness',
        businessName: 'testbusiness',
        instagramAccessToken: 'long_lived_token_456',
      });

      await MetaOAuthController.handleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify axios calls were made correctly
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
      
      // First call: Exchange code for token
      expect(mockedAxios.get).toHaveBeenNthCalledWith(1, 
        'https://graph.facebook.com/v19.0/oauth/access_token',
        expect.objectContaining({
          params: expect.objectContaining({
            client_id: 'test_meta_app_id',
            client_secret: 'test_meta_app_secret',
            code: 'test_auth_code_123',
            redirect_uri: 'http://localhost:3000/api/meta/oauth/callback',
          })
        })
      );

      // Second call: Exchange for long-lived token
      expect(mockedAxios.get).toHaveBeenNthCalledWith(2,
        'https://graph.facebook.com/v19.0/oauth/access_token',
        expect.objectContaining({
          params: expect.objectContaining({
            grant_type: 'fb_exchange_token',
            fb_exchange_token: 'short_lived_token_123',
          })
        })
      );

      // Third call: Get user info
      expect(mockedAxios.get).toHaveBeenNthCalledWith(3,
        'https://graph.facebook.com/v19.0/me',
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: 'long_lived_token_456',
          })
        })
      );

      // Verify database upsert was called
      expect(prisma.businessProfile.upsert).toHaveBeenCalledWith({
        where: { igUsername: 'testbusiness' },
        update: {
          instagramAccessToken: 'long_lived_token_456',
          updatedAt: expect.any(Date),
        },
        create: {
          igUsername: 'testbusiness',
          businessName: 'testbusiness',
          instagramAccessToken: 'long_lived_token_456',
        },
      });

      // Verify success response
      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('Instagram Connected Successfully'));
      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('@testbusiness'));
    });

    it('should handle OAuth API errors gracefully', async () => {
      mockRequest = {
        query: {
          code: 'invalid_code',
        },
      };

      // Mock axios error
      mockedAxios.get.mockRejectedValue(new Error('OAuth API Error'));

      await MetaOAuthController.handleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('Connection Failed'));
    });

    it('should handle missing Instagram business account', async () => {
      mockRequest = {
        query: {
          code: 'test_code',
        },
      };

      mockedAxios.get
        .mockResolvedValueOnce({
          data: { access_token: 'short_lived_token' }
        })
        .mockResolvedValueOnce({
          data: { access_token: 'long_lived_token' }
        })
        .mockResolvedValueOnce({
          data: {
            accounts: {
              data: [{
                id: 'page_123',
                name: 'Test Page',
                // No instagram_business_account property
              }]
            }
          }
        });

      await MetaOAuthController.handleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('Connection Failed'));
      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('Instagram Business Account'));
    });
  });
});