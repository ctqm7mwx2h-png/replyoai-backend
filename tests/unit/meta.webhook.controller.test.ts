import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { MetaWebhookController } from '../../src/controllers/meta.webhook.controller.js';

describe('MetaWebhookController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.MockedFunction<any>;
  let statusSpy: jest.MockedFunction<any>;
  let sendSpy: jest.MockedFunction<any>;

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy, send: jest.fn() });
    sendSpy = jest.fn();
    
    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
      send: sendSpy,
    };
  });

  describe('verifyWebhook', () => {
    it('should verify webhook with correct token and return challenge', async () => {
      mockRequest = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_verify_token_12345',
          'hub.challenge': 'challenge_string_123',
        },
      };

      // Mock the send method on the status return value
      statusSpy.mockReturnValue({ send: sendSpy });

      await MetaWebhookController.verifyWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(sendSpy).toHaveBeenCalledWith('challenge_string_123');
    });

    it('should reject webhook with incorrect token', async () => {
      mockRequest = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_string_123',
        },
      };

      await MetaWebhookController.verifyWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden'
      });
    });

    it('should reject webhook with missing token', async () => {
      mockRequest = {
        query: {
          'hub.mode': 'subscribe',
          'hub.challenge': 'challenge_string_123',
        },
      };

      await MetaWebhookController.verifyWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden'
      });
    });

    it('should reject webhook with wrong mode', async () => {
      mockRequest = {
        query: {
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'test_verify_token_12345',
          'hub.challenge': 'challenge_string_123',
        },
      };

      await MetaWebhookController.verifyWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden'
      });
    });
  });

  describe('handleWebhook', () => {
    it('should handle POST webhook and return success', async () => {
      mockRequest = {
        body: {
          object: 'page',
          entry: [
            {
              id: '12345',
              time: 1234567890,
              messaging: [
                {
                  sender: { id: 'user123' },
                  recipient: { id: 'page123' },
                  timestamp: 1234567890,
                  message: { mid: 'mid123', text: 'Hello' }
                }
              ]
            }
          ]
        },
        headers: {
          'user-agent': 'Meta/1.0',
          'content-type': 'application/json',
          'x-hub-signature-256': 'sha256=abcd1234'
        }
      };

      await MetaWebhookController.handleWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Webhook received'
      });
    });

    it('should handle errors gracefully and still return 200', async () => {
      mockRequest = {
        body: { test: 'data' },
        headers: {
          'content-type': 'application/json'
        }
      };

      // Mock the logger to throw an error
      const { defaultLogger } = await import('../../src/utils/logger.js');
      const originalInfo = defaultLogger.info;
      defaultLogger.info = jest.fn().mockImplementation(() => {
        throw new Error('Logger error');
      });

      await MetaWebhookController.handleWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Error processed'
      });

      // Restore original logger
      defaultLogger.info = originalInfo;
    });
  });
});