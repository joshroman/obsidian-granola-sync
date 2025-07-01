# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0-beta] - 2025-07-01

### 🎉 Major Features
- **Daily Note Backlinking**: Enhanced frontmatter generation with automatic daily note links
- **Comprehensive Test Infrastructure**: Robust testing setup with proper CI/CD pipeline

### ✨ Improvements
- **CSS Isolation**: Fixed file explorer interference with properly scoped selectors
- **Test Environment**: Self-healing test vault setup with automatic validation
- **Documentation**: Added comprehensive E2E test guide and troubleshooting

### 🔧 Technical Changes
- Separated Jest and WebdriverIO test configurations
- Added proper test environment validation
- Implemented automatic test vault directory creation
- Enhanced frontmatter with meeting metadata

### 🐛 Bug Fixes
- Fixed CSS conflicts affecting Obsidian's file explorer
- Resolved test runner conflicts between unit and E2E tests
- Fixed missing test vault directory in CI environments
- Corrected ES module import issues

### 📚 Documentation
- Added comprehensive E2E test guide (`test/E2E_TEST_GUIDE.md`)
- Created pull request template with testing checklist
- Enhanced project documentation with testing requirements

### 🔄 CI/CD Improvements
- Fixed GitHub Actions pipeline to run reliably
- Properly separated unit tests (CI) from E2E tests (local)
- Added automatic environment validation before test execution

## [0.2.0-beta] - Previous Release
- Core sync functionality
- Basic Obsidian integration
- Initial plugin structure