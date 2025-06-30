# Test Vault

This is a test vault used for E2E testing of the Obsidian Granola Sync plugin.

## Purpose

This vault provides a clean, controlled environment for automated testing:
- E2E tests run against this vault
- It contains minimal configuration
- Tests can modify this vault without affecting development

## Important Notes

- This vault should remain minimal
- Don't add personal notes or configurations here
- Any changes made during tests should be cleaned up
- The `.obsidian` directory contains required Obsidian configuration files

## Test Files

Test files created during E2E tests will appear in this directory and should be automatically cleaned up by the test suite.